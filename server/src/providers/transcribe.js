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

const TRANSCRIPTION_PROMPT =
  'You are a speech-to-text engine for an Indian user in Tamil Nadu. Transcribe this audio verbatim. The speaker is usually speaking Tamil (தமிழ்), Hindi (हिन्दी) or English, sometimes mixed (Tanglish/Hinglish). Listen carefully for Tamil: if the speech is Tamil, write it in Tamil script exactly as spoken; if Hindi, write in Devanagari; if English, write in English. NEVER write Tamil or Hindi speech as phonetic English letters or invent unrelated English words for sounds you do not recognise. Do not translate. Output ONLY the spoken words, with no remarks, quotes, labels or timestamps. If there is no clear speech, output <noise>.';

/**
 * Transcribe recorded microphone audio using Gemini's native multimodal audio capabilities
 */
const LANG_NAMES = { 'ta-IN': 'Tamil', 'hi-IN': 'Hindi', 'en-US': 'English', 'es-ES': 'Spanish', 'fr-FR': 'French' };

let thinkMode = 0; // 0 thinkingLevel low, 1 thinkingBudget, 2 none

export async function transcribeAudio({ buffer, mimeType, lang }) {
  reloadEnv();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey || apiKey === 'paste_your_key_here' || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is not configured for transcription.');
  }

  if (!buffer || buffer.length === 0) {
    return { text: '' };
  }

  // Normalize audio mime type for Gemini
  let normalizedMime = mimeType || 'audio/webm';
  if (normalizedMime.includes('webm')) {
    normalizedMime = 'audio/webm';
  } else if (normalizedMime.includes('wav')) {
    normalizedMime = 'audio/wav';
  } else if (normalizedMime.includes('mp4') || normalizedMime.includes('m4a')) {
    normalizedMime = 'audio/mp4';
  } else if (normalizedMime.includes('ogg')) {
    normalizedMime = 'audio/ogg';
  }

  const base64Audio = buffer.toString('base64');
  const ai = new GoogleGenAI({ apiKey });

  // Multimodal audio models to attempt in order of native audio comprehension
  // gemini-3.1-flash-lite hears Tamil correctly in a few seconds; gemini-3.5-flash-lite mishears it
  // and gemini-3.5-flash hangs for audio, so they are only fallbacks.
  const models = [
    'gemini-3.1-flash-lite',
    process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Nova Transcribe] Transcribing with model ${model} (${normalizedMime}, ${buffer.length} bytes)...`);
      const mkConfig = () => {
        const c = { temperature: 0 };
        if (thinkMode === 0) c.thinkingConfig = { thinkingLevel: 'low' };
        else if (thinkMode === 1) c.thinkingConfig = { thinkingBudget: 256 };
        return c;
      };
      const callConfig = mkConfig();
      const request = {
        model,
        config: callConfig,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: base64Audio,
                },
              },
              {
                text: LANG_NAMES[lang] ? `${TRANSCRIPTION_PROMPT} Hint: the speaker is most likely speaking ${LANG_NAMES[lang]}.` : TRANSCRIPTION_PROMPT,
              },
            ],
          },
        ],
      };
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 9000);
        request.config = { ...mkConfig(), abortSignal: ctl.signal };
        try {
          response = await ai.models.generateContent(request);
          clearTimeout(timer);
          break;
        } catch (e1) {
          clearTimeout(timer);
          if (thinkMode < 2 && (/thinking/i.test(e1.message || '') || /INVALID_ARGUMENT|\b400\b/.test(e1.message || ''))) {
            thinkMode++;
            continue;
          }
          throw e1;
        }
      }
      if (!response) throw new Error('No response');

      const text = (response.text || '').trim();
      if (!text || text === '<noise>' || text === '<applause>') {
        console.warn(`[Nova Transcribe] Model ${model} returned non-speech token: "${text}". Trying fallback...`);
        continue;
      }

      console.log('[Nova Transcribe] Successfully transcribed:', text.slice(0, 80));
      return { text };
    } catch (err) {
      console.warn(`[Nova Transcribe] Model ${model} failed:`, err.message);
      lastError = err;
      // A corrupted/empty clip fails on every model: stop retrying and let the client re-listen
      if (/empty, corrupted, or malformed/i.test(err.message || '')) {
        const e = new Error('Audio clip unreadable');
        e.retry = true;
        throw e;
      }
    }
  }

  throw new Error(`Audio transcription failed: ${lastError?.message || 'Unable to process audio'}`);
}

