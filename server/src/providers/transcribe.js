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
  'Transcribe this audio verbatim into plain text. Automatically recognize the spoken language (including Tamil, Hindi, English, Tanglish, Hinglish, or mixed multilingual speech). Accurately transcribe Tamil words in Tamil script (தமிழ்), Hindi words in Devanagari script (हिन्दी), and English in English script. Do not translate. Output ONLY the exact words spoken without introductory remarks, formatting, timestamps, quotes, or conversational commentary.';

/**
 * Transcribe recorded microphone audio using Gemini's native multimodal audio capabilities
 */
export async function transcribeAudio({ buffer, mimeType }) {
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
  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Nova Transcribe] Transcribing with model ${model} (${normalizedMime}, ${buffer.length} bytes)...`);
      const response = await ai.models.generateContent({
        model,
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
                text: TRANSCRIPTION_PROMPT,
              },
            ],
          },
        ],
      });

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
    }
  }

  throw new Error(`Audio transcription failed: ${lastError?.message || 'Unable to process audio'}`);
}

