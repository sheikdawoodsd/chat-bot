import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

function reloadEnv() {
  try {
    dotenv.config({ path: envPath, override: true });
  } catch {}
}

/**
 * Convert 16-bit linear PCM buffer into standard playable RIFF WAV buffer
 */
export function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  // File length minus RIFF header
  buffer.writeUInt32LE(36 + dataSize, 4);
  // RIFF type WAVE
  buffer.write('WAVE', 8);

  // Format chunk marker 'fmt '
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // Data chunk header
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Copy raw PCM audio bytes
  pcmBuffer.copy(buffer, headerSize);
  return buffer;
}

/**
 * Clean text for spoken voice: strip markdown, code blocks, URLs, markdown symbols
 */
export function cleanSpokenText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    // Replace code blocks with spoken note
    .replace(/```[\s\S]*?```/g, ' The complete code is shown in your chat. ')
    // Replace inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove Markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove markdown headers, bold, italics, quotes, lists
    .replace(/[#*_~`>]/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Replace multiple spaces and newlines
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate real spoken audio using Gemini TTS model
 */

// ---- Free fallback voice (used when the Gemini TTS free quota is exhausted) ----
let geminiTtsBlockedUntil = 0;

function pickFallbackLang(text, lang) {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (lang && lang !== 'auto') return String(lang).split('-')[0];
  return 'en';
}

function splitForFallback(text, max = 180) {
  const parts = [];
  const sentences = text.match(/[^.!?।\n]+[.!?।]?/g) || [text];
  let cur = '';
  for (const raw of sentences) {
    const sn = raw.trim();
    if (!sn) continue;
    if ((cur + ' ' + sn).trim().length <= max) cur = (cur + ' ' + sn).trim();
    else {
      if (cur) parts.push(cur);
      if (sn.length <= max) cur = sn;
      else {
        const words = sn.split(/\s+/);
        cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length <= max) cur = (cur + ' ' + w).trim();
          else { if (cur) parts.push(cur); cur = w; }
        }
      }
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

async function fallbackTTS(text, lang) {
  const tl = pickFallbackLang(text, lang);
  const chunks = splitForFallback(text);
  const buffers = await Promise.all(
    chunks.map(async (q) => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`fallback TTS ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    })
  );
  const mp3 = Buffer.concat(buffers);
  if (mp3.length < 200) throw new Error('fallback TTS empty');
  return {
    audioUrl: `data:audio/mpeg;base64,${mp3.toString('base64')}`,
    mimeType: 'audio/mpeg',
    model: 'fallback-tts',
    voice: tl,
    text,
  };
}

export async function generateTTS({ text, voice = 'Kore', model, lang = 'auto' }) {
  reloadEnv();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey || apiKey === 'paste_your_key_here' || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is required for text-to-speech.');
  }

  const cleanText = cleanSpokenText(text);
  if (!cleanText) {
    throw new Error('No speakable text provided.');
  }

  // Build a language-aware TTS prompt so Gemini speaks in the right language
  const langMap = {
    'ta-IN': 'Tamil',
    'hi-IN': 'Hindi',
    'te-IN': 'Telugu',
    'kn-IN': 'Kannada',
    'ml-IN': 'Malayalam',
    'bn-IN': 'Bengali',
    'mr-IN': 'Marathi',
    'gu-IN': 'Gujarati',
    'pa-IN': 'Punjabi',
    'fr-FR': 'French',
    'de-DE': 'German',
    'es-ES': 'Spanish',
    'pt-BR': 'Portuguese',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'zh-CN': 'Chinese (Mandarin)',
    'ar-SA': 'Arabic',
  };
  const langName = langMap[lang] || null;
  const ttsContents = langName
    ? `Say the following in ${langName} with a natural accent and tone. Do not translate — speak exactly these words in ${langName}:\n\n${cleanText}`
    : cleanText;

  // Model hierarchy for TTS
  const preferredModel = (model || process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts').trim();
  const candidateModels = Array.from(
    new Set([
      preferredModel,
      'gemini-2.5-flash-preview-tts',
      'gemini-3.1-flash-tts-preview',
      'gemini-3.8-flash-tts',
      'gemini-2.5-pro-preview-tts',
    ])
  );

  if (Date.now() < geminiTtsBlockedUntil) {
    return await fallbackTTS(cleanText, lang);
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError = null;

  for (const modelToTry of candidateModels) {
    try {
      // Abort after 12s timeout to prevent hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await ai.models.generateContent({
        model: modelToTry,
        contents: ttsContents,
        config: {
          abortSignal: controller.signal,
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice || 'Kore',
              },
            },
          },
        },
      });

      clearTimeout(timeout);

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const rawMime = part.inlineData.mimeType || '';
          const pcmBase64 = part.inlineData.data;
          const pcmBuffer = Buffer.from(pcmBase64, 'base64');

          // Extract sample rate if present (e.g. rate=24000)
          let sampleRate = 24000;
          const matchRate = rawMime.match(/rate=(\d+)/i);
          if (matchRate) {
            sampleRate = parseInt(matchRate[1], 10);
          }

          // Convert PCM into playable standard WAV
          const wavBuffer = pcmToWav(pcmBuffer, sampleRate, 1, 16);
          const wavBase64 = wavBuffer.toString('base64');

          return {
            audioUrl: `data:audio/wav;base64,${wavBase64}`,
            mimeType: 'audio/wav',
            sampleRate,
            model: modelToTry,
            voice: voice || 'Kore',
            text: cleanText,
          };
        }
      }
    } catch (err) {
      lastError = err;
      if (/RESOURCE_EXHAUSTED|\b429\b/.test(err.message || '')) {
        geminiTtsBlockedUntil = Date.now() + 30 * 60 * 1000; // quota gone: skip Gemini TTS for 30 min
        break;
      }
      console.warn(`[Nova TTS] Model ${modelToTry} attempt failed: ${err.message}. Trying next...`);
    }
  }

  try {
    return await fallbackTTS(cleanText, lang);
  } catch (e2) {
    console.warn('[Nova TTS] fallback voice failed:', e2.message);
  }
  throw new Error(`TTS generation failed: ${lastError?.message || 'No audio returned'}`);
}

