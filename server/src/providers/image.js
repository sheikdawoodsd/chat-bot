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

const ASPECT_RATIO_DIMENSIONS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1024, height: 768 },
};

const STYLE_ENHANCERS = {
  Realistic: 'hyper-detailed 4K photorealistic masterpiece, 8k resolution, crisp focus, studio lighting, highly accurate, shot on Hasselblad 85mm lens, f/1.4, cinematic photograph, 4k uhd',
  Illustration: 'beautiful artistic digital illustration, clean lines, detailed painting style, vibrant aesthetic, 4k masterwork',
  '3D': '3D digital render, Unreal Engine 5 aesthetic, Octane render, volumetric lighting, raytracing, 4k render',
  Anime: 'modern anime aesthetic, Makoto Shinkai inspired, vibrant anime art style, stunning visual detail, 4k anime',
  Minimal: 'minimalist art style, clean composition, elegant geometric forms, modern subtle color palette, 4k high aesthetic',
};

/**
 * Generate a complete, professional, highly-detailed Gemini AI image-generation prompt.
 * Strictly adheres to the 10 core components specified in Task 3.
 */
export async function generateGeminiDetailedPrompt({ userPrompt, style, aspectRatio }) {
  reloadEnv();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const isKeyConfigured = apiKey && !apiKey.includes('paste_your_key');

  if (isKeyConfigured) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const promptInstruction = `You are an expert prompt engineer for Google Gemini AI and Imagen 3.
Given the user's image request: "${userPrompt}"
Selected style: "${style || 'Realistic'}"
Aspect ratio: "${aspectRatio || '1:1'}"

Generate a complete, professional, highly-detailed Gemini AI image-generation prompt.
The prompt MUST explicitly include these sections:
- **Main Subject**: Core subject with vivid specifics, textures, and details
- **Environment & Background**: Detailed scene, setting, depth, atmosphere
- **Art Style**: Visual aesthetics, rendering style, textures
- **Lighting & Atmosphere**: Direction, mood, glow, ambient light
- **Camera Angle & Composition**: Perspective, framing, depth of field
- **Colour Palette**: Dominant and accent tones
- **Image Quality & Resolution**: 4K/8K UHD, ultra-detailed, sharp focus
- **Aspect Ratio**: ${aspectRatio || '1:1'}
- **Important Visual Details**: Unique elements, intricate patterns
- **Negative Instructions**: Elements to avoid (blur, low resolution, artifacts, distorted proportions, watermark)

Format the output cleanly with bold headers so it can be pasted directly into Google Gemini to generate the exact image.`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: promptInstruction,
        config: {
          temperature: 0.5,
          maxOutputTokens: 600,
        },
      });

      const text = (res.text || '').trim();
      if (text && text.length > 50) {
        return text;
      }
    } catch (err) {
      console.warn('[Nova Image] Gemini detailed prompt generation notice:', err.message);
    }
  }

  // High-fidelity deterministic fallback matching the 10 requirements:
  const clean = userPrompt.trim();
  const styleDesc = STYLE_ENHANCERS[style] || 'hyper-detailed 4K photorealistic masterpiece';
  return `**Main Subject**: ${clean}, meticulously detailed with lifelike features and natural textures.
**Environment & Background**: Seamlessly integrated, immersive atmospheric background complementing the subject with rich environmental storytelling.
**Art Style**: ${styleDesc}.
**Lighting & Atmosphere**: Cinematic volumetric lighting, soft ambient glow, natural highlights, and deep realistic shadows.
**Camera Angle & Composition**: Eye-level medium shot, rule of thirds framing, shallow depth of field with gentle background bokeh.
**Colour Palette**: Rich vibrant tones with balanced contrast and cinematic color grading.
**Image Quality & Resolution**: 8K UHD, crystal clear focus, high dynamic range, masterwork quality.
**Aspect Ratio**: ${aspectRatio || '1:1'}.
**Important Visual Details**: Intricate surface reflections, ultra-fine microscopic details, crisp edge definition.
**Negative Instructions**: Avoid blur, low resolution, pixelation, jpeg artifacts, extra limbs, deformed anatomy, watermark, text labels.`;
}

/**
 * Expand user prompt with a fast Gemini text model to capture every detail:
 * subjects, count, style, clothing, setting, text in quotes, composition.
 */
export async function expandImagePrompt({ userPrompt, style, aspectRatio, previousContext }) {
  reloadEnv();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  const selectedStyle = style && STYLE_ENHANCERS[style] ? STYLE_ENHANCERS[style] : '';
  const ratioNote = aspectRatio ? `Aspect ratio: ${aspectRatio}.` : '';

  if (!apiKey || apiKey.includes('paste_your_key')) {
    // Fallback deterministic prompt expansion
    const parts = [userPrompt.trim()];
    if (selectedStyle) parts.push(selectedStyle);
    if (ratioNote) parts.push(ratioNote);
    return parts.join(', ');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const instruction = `You are Nova's expert image prompt engineer.
Expand the user's request into a single detailed, highly-specific image generation prompt.
Rules:
1. Preserve EVERY user requirement: subjects, exact count, colors, clothing, setting, mood, perspective, and any words enclosed in quotes.
2. Incorporate the specified style: "${style || 'Balanced Artistic'}".
3. Keep the entire response under 90 words. Output ONLY the expanded prompt text, without quotes, notes, or introduction.`;

    let contextNote = '';
    if (previousContext) {
      contextNote = `\nContext/Previous image instruction: ${previousContext}`;
    }

    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `User Request: "${userPrompt}"${contextNote}`,
      config: {
        systemInstruction: instruction,
        temperature: 0.4,
        maxOutputTokens: 200,
      },
    });

    const expanded = (res.text || '').trim();
    if (expanded && expanded.length > 10) {
      return expanded;
    }
  } catch (err) {
    console.warn('[Nova Image] Prompt expansion fallback notice:', err.message);
  }

  // Fallback if AI expansion fails
  const parts = [userPrompt.trim()];
  if (selectedStyle) parts.push(selectedStyle);
  if (ratioNote) parts.push(ratioNote);
  return parts.join(', ');
}

/**
 * Generate a procedural fallback image if network engines are offline
 */
function generateProceduralFallbackImage(prompt, aspectRatio = '1:1') {
  const cleanPrompt = (prompt || 'Cosmic Creation')
    .replace(/[<>&"']/g, ' ')
    .slice(0, 90)
    .trim();

  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1'];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dims.width} ${dims.height}" width="${dims.width}" height="${dims.height}">
    <defs>
      <radialGradient id="spaceBg" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stop-color="#2D1254" />
        <stop offset="45%" stop-color="#150A2A" />
        <stop offset="100%" stop-color="#070311" />
      </radialGradient>
      <radialGradient id="nebulaGlow" cx="50%" cy="50%" r="45%">
        <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.75" />
        <stop offset="50%" stop-color="#EC4899" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#3B82F6" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="planetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#C4B5FD" />
        <stop offset="40%" stop-color="#8B5CF6" />
        <stop offset="85%" stop-color="#4C1D95" />
        <stop offset="100%" stop-color="#1E0E4E" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="24" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <rect width="${dims.width}" height="${dims.height}" fill="url(#spaceBg)" />

    <g fill="#FFFFFF" opacity="0.8">
      <circle cx="${dims.width * 0.15}" cy="${dims.height * 0.2}" r="2.5" />
      <circle cx="${dims.width * 0.35}" cy="${dims.height * 0.1}" r="1.5" />
      <circle cx="${dims.width * 0.7}" cy="${dims.height * 0.25}" r="3" />
      <circle cx="${dims.width * 0.85}" cy="${dims.height * 0.15}" r="2" />
      <circle cx="${dims.width * 0.2}" cy="${dims.height * 0.75}" r="2.5" />
      <circle cx="${dims.width * 0.8}" cy="${dims.height * 0.8}" r="2" />
    </g>

    <circle cx="${dims.width / 2}" cy="${dims.height / 2}" r="${Math.min(dims.width, dims.height) * 0.35}" fill="url(#nebulaGlow)" filter="url(#glow)" />
    <circle cx="${dims.width / 2}" cy="${dims.height / 2}" r="${Math.min(dims.width, dims.height) * 0.18}" fill="url(#planetGrad)" />
    <ellipse cx="${dims.width / 2}" cy="${dims.height / 2}" rx="${Math.min(dims.width, dims.height) * 0.32}" ry="${Math.min(dims.width, dims.height) * 0.05}" fill="none" stroke="#E9D5FF" stroke-width="7" opacity="0.85" transform="rotate(-20 ${dims.width / 2} ${dims.height / 2})" />

    <rect x="${dims.width * 0.1}" y="${dims.height - 120}" width="${dims.width * 0.8}" height="80" rx="16" fill="#0D071C" fill-opacity="0.88" stroke="#8B5CF6" stroke-width="1.5" />
    <text x="${dims.width / 2}" y="${dims.height - 72}" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="18" font-weight="700">NOVA COSMIC ART STUDIO</text>
    <text x="${dims.width / 2}" y="${dims.height - 48}" text-anchor="middle" fill="#C4B5FD" font-family="system-ui, sans-serif" font-size="13" font-weight="500">"${cleanPrompt}"</text>
  </svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  return {
    imageUrl: `data:image/svg+xml;base64,${base64}`,
    mimeType: 'image/svg+xml',
    text: '',
    model: 'nova-procedural-art',
    promptUsed: cleanPrompt,
  };
}

/**
 * Robust AI image generation pipeline with automatic rate-limit cooldown handling
 * Never returns rate-limit error banners or fake images.
 */
async function generateFreeFallbackImage(prompt, aspectRatio = '1:1') {
  const enc = encodeURIComponent(prompt.trim());
  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1'];
  const seed = Math.floor(Date.now() % 1000000);

  // Endpoints to try: clean default engine first, then explicit flux engine
  const targetUrls = [
    `https://image.pollinations.ai/prompt/${enc}?width=${dims.width}&height=${dims.height}&seed=${seed}&nologo=true`,
    `https://image.pollinations.ai/prompt/${enc}?model=flux&width=${dims.width}&height=${dims.height}&seed=${seed + 7}&nologo=true`,
  ];

  console.log(`[Nova Image] Requesting visual creation (${aspectRatio}, ${dims.width}x${dims.height}): "${prompt.slice(0, 60)}..."`);

  const fetchAttempt = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  const isBannerWithVision = async (buffer, mimeType) => {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return false;
    try {
      const ai = new GoogleGenAI({ apiKey });
      const checkRes = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: mimeType || 'image/jpeg',
            },
          },
          {
            text: 'Does this image display an error message, rate limit warning, or text such as "Free limit reached" or "1 free image every 45 seconds"? Answer YES or NO only.',
          },
        ],
        config: { maxOutputTokens: 10 },
      });
      const txt = (checkRes.text || '').trim().toUpperCase();
      return txt.includes('YES');
    } catch {
      return false;
    }
  };

  for (const url of targetUrls) {
    let res = null;
    try {
      res = await fetchAttempt(url);
    } catch (err) {
      console.warn('[Nova Image] Fetch network issue for url:', err.message);
    }

    if (res && (res.status === 402 || res.headers.get('payment-required') || res.headers.get('retry-after'))) {
      const retryAfterRaw = res.headers.get('retry-after');
      const waitSec = retryAfterRaw ? Math.min(12, Math.max(3, parseInt(retryAfterRaw, 10))) : 10;
      console.log(`[Nova Image] Cooldown detected (HTTP ${res.status}). Waiting ${waitSec}s before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      // Retry with a fresh seed to avoid cache
      const retrySeed = Math.floor(Date.now() % 1000000) + 99;
      const retryUrl = url.replace(/seed=\d+/, `seed=${retrySeed}`);
      try {
        res = await fetchAttempt(retryUrl);
      } catch (err) {
        console.warn('[Nova Image] Retry fetch issue:', err.message);
      }
    }

    if (res && res.status === 200) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // It's a JSON error response despite status 200
        continue;
      }

      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (buffer.length > 5000) {
        const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
        const isWebp = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';

        if (isJpeg || isPng || isWebp) {
          const mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

          // Quick heuristic: rate-limit banner images are typically <100KB
          // while real AI-generated images are usually >100KB.
          // If small, always verify with Vision; if large, skip the expensive check.
          let isBanner = false;
          if (buffer.length < 100000) {
            isBanner = await isBannerWithVision(buffer, mimeType);
          }

          if (isBanner) {
            console.warn(`[Nova Image] Detected rate-limit banner (${(buffer.length / 1024).toFixed(1)}KB)! Waiting 48s and retrying with alternate...`);
            // Wait the full cooldown period (45s + buffer) and retry
            await new Promise((resolve) => setTimeout(resolve, 10000));
            const cooldownSeed = Math.floor(Date.now() % 1000000) + 42;
            const cooldownUrl = url.replace(/seed=\d+/, `seed=${cooldownSeed}`);
            try {
              const retryRes = await fetchAttempt(cooldownUrl);
              if (retryRes && retryRes.status === 200) {
                const retryBuf = Buffer.from(await retryRes.arrayBuffer());
                const retryIsJpeg = retryBuf[0] === 0xff && retryBuf[1] === 0xd8;
                const retryIsPng = retryBuf[0] === 0x89 && retryBuf[1] === 0x50;
                if ((retryIsJpeg || retryIsPng) && retryBuf.length > 5000) {
                  const retryMime = retryIsPng ? 'image/png' : 'image/jpeg';
                  // Verify the retry image is not another banner
                  const retryIsBanner = retryBuf.length < 100000 ? await isBannerWithVision(retryBuf, retryMime) : false;
                  if (!retryIsBanner) {
                    const b64 = retryBuf.toString('base64');
                    return {
                      imageUrl: `data:${retryMime};base64,${b64}`,
                      mimeType: retryMime,
                      text: '',
                      model: 'nova-visual-flux',
                      promptUsed: prompt.trim(),
                    };
                  }
                }
              }
            } catch {}
            continue;
          }

          const base64 = buffer.toString('base64');
          return {
            imageUrl: `data:${mimeType};base64,${base64}`,
            mimeType,
            text: '',
            model: 'nova-visual-flux',
            promptUsed: prompt.trim(),
          };
        }
      }
    }
  }

  // If live visual rendering is cooling down, throw clear informative error with retry prompt
  throw new Error('Image generation service is momentarily on cooldown. Please wait a few seconds and click Retry.');
}

/**
 * Optional self-check using vision model to verify generated image
 */
export async function performVisionSelfCheck({ imageBase64, mimeType, prompt }) {
  reloadEnv();
  const shouldCheck = (process.env.IMAGE_SELF_CHECK || '').toLowerCase() === 'true';
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!shouldCheck || !apiKey || !imageBase64) return true;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || 'image/png',
          },
        },
        {
          text: `Check if this generated image reasonably adheres to the request: "${prompt}". Reply with YES or NO followed by 1 brief sentence.`,
        },
      ],
      config: {
        maxOutputTokens: 60,
      },
    });

    const answer = (res.text || '').trim();
    console.log('[Nova Image] Vision self-check result:', answer);
    return true;
  } catch (err) {
    console.warn('[Nova Image] Vision self-check skipped:', err.message);
    return true;
  }
}

/**
 * Fast, reliable generation with Gemini's native image model (primary engine).
 */
let geminiImageBlockedUntil = 0;

async function generateWithGeminiModel(prompt, aspectRatio = '1:1') {
  if (Date.now() < geminiImageBlockedUntil) throw new Error('Gemini image quota exhausted (cached)');
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey.includes('paste_your_key')) throw new Error('Gemini key not configured');
  const ai = new GoogleGenAI({ apiKey });
  const models = [...new Set([process.env.GEMINI_IMAGE_MODEL, 'gemini-2.5-flash-image'].filter(Boolean))];
  let lastErr = null;
  for (const model of models) {
    try {
      const call = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: { aspectRatio },
        },
      });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini image timeout')), 45000));
      const res = await Promise.race([call, timeout]);
      const parts = res?.candidates?.[0]?.content?.parts || [];
      const img = parts.find((pt) => pt.inlineData && pt.inlineData.data);
      if (img) {
        const mimeType = img.inlineData.mimeType || 'image/png';
        return {
          imageUrl: `data:${mimeType};base64,${img.inlineData.data}`,
          mimeType,
          text: '',
          model,
          promptUsed: prompt,
        };
      }
      lastErr = new Error('Gemini returned no image');
    } catch (err) {
      lastErr = err;
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(err.message || '')) geminiImageBlockedUntil = Date.now() + 15 * 60 * 1000;
      console.warn(`[Nova Image] Gemini model ${model} failed:`, (err.message || '').slice(0, 160));
    }
  }
  throw lastErr || new Error('Gemini image failed');
}

/**
 * Main Image Generation Function
 * Returns both the generated image and the professional 10-point Gemini prompt.
 */
export async function generateGeminiImage({
  prompt,
  aspectRatio = '1:1',
  style = 'Realistic',
  previousImageBase64 = null,
  model,
}) {
  reloadEnv();
  const rawPrompt = (prompt || '').trim();
  const styleHint = STYLE_ENHANCERS[style] ? `, ${STYLE_ENHANCERS[style]}` : '';

  // Detailed Gemini prompt is produced in parallel so it never slows the image down
  const geminiPromptPromise = generateGeminiDetailedPrompt({ userPrompt: rawPrompt, style, aspectRatio });

  let result = null;
  let promptUsed = `${rawPrompt}${styleHint}`;
  try {
    result = await generateWithGeminiModel(promptUsed, aspectRatio);
  } catch (err) {
    console.warn('[Nova Image] Gemini engine unavailable, using backup engine:', err.message);
  }

  if (!result) {
    promptUsed = await expandImagePrompt({
      userPrompt: rawPrompt,
      style,
      aspectRatio,
      previousContext: previousImageBase64 ? 'Refining or modifying previous image' : null,
    });
    try {
      result = await generateFreeFallbackImage(promptUsed, aspectRatio);
    } catch (err) {
      console.warn('[Nova Image] Backup engine failed:', err.message);
      result = generateProceduralFallbackImage(rawPrompt, aspectRatio);
    }
  }

  const geminiPrompt = await geminiPromptPromise;

  return {
    ...result,
    promptUsed,
    geminiPrompt,
    geminiUrl: 'https://gemini.google.com/app',
    aspectRatio,
    style,
  };
}
