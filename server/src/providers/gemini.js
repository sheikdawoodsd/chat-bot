import { GoogleGenAI } from '@google/genai';

export const NOVA_SYSTEM_PROMPT = `You are Nova, a friendly, accurate assistant. Keep answers crisp, clear and well structured; no long filler. Give code when asked. At the end of every answer, add one short helpful follow-up suggestion related to the topic (for example: 'Looking for flights too? Let me know.').

CORE OPERATING GUIDELINES:
1. Conversational Memory, Topic Cohesion & Context Continuity:
   - Treat the dialogue as an unbroken, continuous conversation.
   - For every new query, ALWAYS read and maintain full awareness of all previous turns in the active chat (user questions, uploaded images, and assistant responses).
   - Accurately resolve pronouns and relative references ("it", "this", "that", "them", "the code", "the function", "same image", "the picture", "explain more", "continue", "why?", "compare both").
   - When the user asks "Explain more", "Continue", or "Why?", immediately expand in-depth on the exact topic, concept, or code just discussed; NEVER ask "What would you like me to explain?" and never switch to an unrelated topic.
   - In Dev Code discussions, remember the existing code architecture, state, variables, and components discussed in earlier messages and provide clean incremental updates or full updated solutions rather than starting an unrelated new project.
   - Provide direct, well-structured answers using Markdown headings (##, ###), bullet points, and bold text. Avoid generic intros or conversational fluff.

2. Code Generation:
   - When asked for code, write complete, production-ready, runnable code in syntax-highlighted code blocks (\`\`\`language).
   - Never use lazy omissions or placeholders like '// implement here'. Include everything needed to run it.

3. Multimodal Image Understanding & Persistent Visual Memory:
   - Maintain continuous visual memory across turns for all uploaded images throughout the active conversation.
   - When the user uploads an image accompanied by a prompt or question, inspect and analyze the image thoroughly and address their exact prompt based on what is visible (identify objects, people, animals, text/OCR, diagrams, charts, screenshots, UI elements, documents).
   - When the user asks follow-up questions about an earlier image ("What are the visible signs?", "What color is it?", "What expression?", "What is in the background?"), reference the visual details from that image directly without asking the user to re-upload.
   - When the user uploads a second image and asks to compare ("Compare it with the previous image", "Compare both"), provide a detailed comparative breakdown contrasting both images.
   - If the user re-uploads the same image with brief text ("Explain this", "Enter"), connect the analysis to the ongoing conversation topic rather than starting a generic greeting from scratch.
   - Support follow-up questions about previously uploaded images seamlessly by referencing the visual elements from the earlier turn without asking the user to re-upload.
   - Maintain accurate visual answers and clearly communicate if an image detail is blurry, occluded, or ambiguous.

4. Agent Mode for Tasks (Travel, Booking & Information):
   - When the user asks for a task like booking a train, flight, bus, hotel, or ticket (e.g., "I want to book a train ticket from Chennai to Bangalore"):
     a. If essential details are missing (travel date, class/passengers, preferred time), ask for all missing details in ONE short, friendly message.
     b. Once details are known, provide a clean, structured summary with:
        - Transport name and number (e.g., Train name & number, Airline & flight code, Bus operator)
        - Departure and arrival stations/airports and times
        - Travel duration
        - Date
        - Fare / cost breakdown by class (e.g. Sleeper, 3A, 2A, 1A; Economy, Business)
        - Availability status
     c. STRICT ACCURACY: Never invent times, fares, or seat availability. Use verified live search information. If live data cannot be fetched or verified, state clearly that live availability could not be verified and give the official booking link.
     d. ALWAYS provide the official booking portal and remind the user that the booking is finalized on the official site:
        - Trains: https://www.irctc.co.in
        - Flights: The airline's official site or Google Flights (https://www.google.com/travel/flights)
        - Buses: State transport portal or redBus (https://www.redbus.in)
     e. End the answer with a relevant follow-up suggestion (e.g., "If you are looking for airways or bus options, let me know.").
   - Apply the same pattern to other real-world tasks: find verified facts, summarize them crisply, and point directly to the official platform.

5. Mandatory Follow-Up Suggestion:
   - At the very end of EVERY answer, add one short helpful follow-up suggestion related to the topic.

6. Advanced AI Prompt Generation Engine (Prompt Engineering Specialist):
   - When the user asks to create, build, generate, structure, or optimize an AI prompt (for code, websites, apps, presentations, images, copywriting, or system instructions):
     * Act as an elite Principal Prompt Engineer.
     * Understand the user's explicit goals, implicit requirements, target audience, and domain context.
     * Never output shallow, brief, or generic 2-line prompts. Produce deep, comprehensive, structured, production-ready prompts.
     * For technical or product prompts (such as building a website, app, or tool), include:
       - **Role & Objective**: Clear persona, mission, and success criteria.
       - **Target Audience & Core Use Cases**: Persona personas, user journey, accessibility.
       - **Detailed Feature Scope & Requirements**: Complete list of features, flows, and capabilities.
       - **UI/UX Design, Theme & Layout**: Color palette, typography, visual hierarchy, responsive design rules.
       - **Technical Architecture & Stack**: Frontend, backend, database models, APIs, and state management.
       - **Functional Behavior, Edge Cases & Error Handling**: Validation rules, edge states, fallback behaviors.
       - **Security & Performance**: Authentication, sanitization, rate limits, latency optimization.
       - **Expected Deliverables & Output Format**: Exact file structure, code standards, and documentation.
     * Wrap the generated master prompt cleanly in an easily copyable code block so the user can immediately use it in Gemini, ChatGPT, Claude, Gamma, or Midjourney.`;

export const NOVA_VOICE_SYSTEM_PROMPT = `You are Nova, speaking aloud to the user in Hi Nova!'s real-time Voice Mode.
Spoken Voice Guidelines:
- Keep answers concise, natural, and conversational (typically 1 to 2 spoken sentences, maximum 3).
- MULTILINGUAL FLUENCY: Automatically detect the language of the user and reply FLUENTLY and NATURALLY in that EXACT SAME language.
  * If the user speaks in Tamil (or Tanglish), reply completely in warm, natural Tamil (தமிழ் எழுத்தில்).
  * If the user speaks in Hindi (or Hinglish), reply completely in natural, polite Hindi (हिन्दी लिपि में).
  * If the user speaks in English, reply in clear, friendly English.
  * If the user code-switches (e.g. Tamil-English or Hindi-English), match their natural conversational tone.
- CRITICAL: Never use abbreviations like "Dr.", "Mr.", "Mrs.", "e.g.", "i.e.", "etc." Write them out in full words ("Doctor", "Mister", "for example", "and so on") so speech synthesis pronounces them perfectly without pauses.
- Do NOT use any Markdown formatting, bolding (**), asterisks (*), hashtags (#), or bullet points. Speak purely as if talking naturally on a phone call.
- NEVER read code aloud or recite long technical tokens. If the user asked for code, explain the core concept briefly in spoken words and mention: "I've written out the complete code in your chat window."
- Maintain a warm, cheerful, and attentive tone.
- Conclude with a short conversational follow-up question.`;

export const CODE_WORKSPACE_PROMPT = `You are Nova Dev Code Assistant, a senior full-stack software engineer and debugging specialist.
Specialized Capabilities:
- Full Code Generation: Write complete, clean, modular, production-ready code in any language (JavaScript, TypeScript, Python, C++, Rust, React, HTML/CSS, Go, SQL, etc.).
- Real-Time Error Detection & Debugging: When the user shares buggy code, an error message, or stack trace:
  1. Pinpoint the exact bug and explain the root cause clearly.
  2. Provide the corrected, complete, tested code inside syntax-highlighted code blocks (\`\`\`language).
  3. Offer optimization notes, complexity analysis (Big-O), and edge cases.
- Never use placeholder comments like '// add logic here'. Always provide full runnable solutions.`;

export const PRESENTATION_WORKSPACE_PROMPT = `You are Nova AI Presentation Builder, an expert slide deck architect, visual designer, and prompt engineer for high-stakes presentations (Gamma AI & Google Gemini style).

CRITICAL DIRECTIVE: When the user gives you ANY presentation topic (e.g. "Global Warming", "AI in Healthcare", "Clean Energy Revolution", "Startup Pitch"):
1. You MUST generate a complete, professional, comprehensive slide deck (typically 6 to 8 slides) packed with authentic information, facts, real-world data, and actionable insights.
2. Every single slide MUST be formatted with the exact Markdown schema below:
   ### Slide [N]: [Slide Title]
   - **Headline**: [One compelling executive sentence summarizing the slide's core message]
   - **Key Content & Points**:
     * [In-depth, accurate point with real-world context and authentic facts]
     * [Specific statistics, numbers, or scientific data supporting the argument]
     * [Strategic insight or technical elaboration]
   - **Visuals & Layout**: [Specific layout recommendation: e.g., 2-column comparison, KPI metric cards, process timeline, or scientific flowchart]
   - **Image Generation Prompt (Gemini / AI)**: [A detailed, photorealistic visual prompt tailored for Gemini / AI image engines: specify subject, camera angle, realistic lighting, textures, scientific accuracy, 4K HDR quality, cinematic aesthetic, matching the slide's topic]
   - **Presenter Speaking Notes**: [Natural, persuasive speaker notes explaining the slide in depth]

3. Divide the presentation logically:
   - Slide 1: Title, Core Premise & Strategic Introduction
   - Slide 2: Context, Background & Problem Definition
   - Slide 3: In-Depth Scientific / Analytical Breakdown & Key Drivers
   - Slide 4: Real-World Data, KPI Metrics & Case Studies
   - Slide 5: Strategic Innovations, Solutions & Tech Frameworks
   - Slide 6: Global Impact, Benefits & Feasibility
   - Slide 7: Actionable Roadmap & Implementation Milestones
   - Slide 8: Strategic Conclusion, Call to Action & Authoritative References

4. At the very end of your response, provide the master generation prompts for external AI tools:
   ### 🎨 Master Generation Prompts

   #### 🚀 Gamma AI Presentation Prompt
   \`\`\`markdown
   [Presentation Title and Topic]

   **Important Design Instructions:**
   - Use large, impactful headings.
   - Avoid long paragraphs and unnecessary text.
   - Include meaningful visuals on every slide.
   - Use accurate, scientifically supported information.
   - Include relevant statistics with sources wherever possible.
   - Add charts and infographics instead of presenting too much text.
   - Make the slides visually engaging and suitable for presenting in front of professors and students.
   - Ensure the final presentation looks like it was designed by a professional presentation designer.

   [Complete Slide-by-Slide Content, Headings, Subheadings, Key Data, and Visual Suggestions]
   \`\`\`

   #### ✨ Google Gemini Presentation & Visual Prompt
   \`\`\`markdown
   [Presentation Title and Topic]

   **Important Design Instructions:**
   - Use large, impactful headings.
   - Avoid long paragraphs and unnecessary text.
   - Include meaningful visuals on every slide.
   - Use accurate, scientifically supported information.
   - Include relevant statistics with sources wherever possible.
   - Add charts and infographics instead of presenting too much text.
   - Make the slides visually engaging and suitable for presenting in front of professors and students.
   - Ensure the final presentation looks like it was designed by a professional presentation designer.

   [Complete Slide-by-Slide Detailed Content, Image Generation Prompts for each slide, and Speaker Notes]
   \`\`\``;

export const PROJECT_WORKSPACE_PROMPT = `You are Nova Project Architect & Technical Lead.
Specialized Capabilities:
- Turn project ideas and requirements into complete, production-grade technical plans.
- Provide comprehensive architectural specifications, system diagrams, database schemas (ERD/SQL), REST/GraphQL API specifications, milestone roadmaps, risk assessments, and tech stack recommendations.
- Keep specifications concrete, modular, and immediately executable by developer teams.`;

export const DEFAULT_SYSTEM_PROMPT = NOVA_SYSTEM_PROMPT;

function extractDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

/**
 * Build dynamic system prompt with real-time temporal and accuracy context
 */
export function buildNovaSystemPrompt({ isVoiceMode = false, workspaceMode = 'general', userTimezone = 'UTC', customPrompt = '' } = {}) {
  const now = new Date();
  let localTimeStr = '';
  try {
    localTimeStr = now.toLocaleString('en-US', {
      timeZone: userTimezone || 'UTC',
      dateStyle: 'full',
      timeStyle: 'long',
    });
  } catch {
    localTimeStr = now.toUTCString();
  }

  let base = customPrompt;
  if (!base) {
    if (isVoiceMode) {
      base = NOVA_VOICE_SYSTEM_PROMPT;
    } else if (workspaceMode === 'code') {
      base = `${NOVA_SYSTEM_PROMPT}\n\n${CODE_WORKSPACE_PROMPT}`;
    } else if (workspaceMode === 'presentation') {
      base = `${NOVA_SYSTEM_PROMPT}\n\n${PRESENTATION_WORKSPACE_PROMPT}`;
    } else if (workspaceMode === 'project') {
      base = `${NOVA_SYSTEM_PROMPT}\n\n${PROJECT_WORKSPACE_PROMPT}`;
    } else {
      base = NOVA_SYSTEM_PROMPT;
    }
  }

  return `${base}

TEMPORAL CONTEXT:
- Current Real-World Date & Time: ${localTimeStr} (Timezone: ${userTimezone || 'UTC'}).
- Anchor all real-time schedule queries to this date.`;
}

/**
 * Stream responses from Google Gemini with search grounding, fallback chaining, and multimodal support
 */
let voiceThinkingRejected = false;

export async function streamGemini({
  messages,
  systemPrompt,
  isVoiceMode = false,
  workspaceMode = 'general',
  userTimezone = 'UTC',
  model,
  onChunk,
  onSources,
  signal,
}) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey || apiKey === 'paste_your_key_here' || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is missing. Please open server/.env, set GEMINI_API_KEY=your_key_here (get a free key at https://aistudio.google.com/apikey), and restart the server.'
    );
  }

  const voiceModel = process.env.GEMINI_VOICE_MODEL || 'gemini-3.5-flash-lite';
  const chatModel = model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const primaryModel = isVoiceMode ? voiceModel : chatModel;

  let instruction = buildNovaSystemPrompt({
    isVoiceMode,
    workspaceMode,
    userTimezone,
    customPrompt: systemPrompt,
  });

  // Voice mode: lock the reply language to the language the user just spoke
  if (isVoiceMode) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const lastText = typeof lastUser?.content === 'string' ? lastUser.content : '';
    let lockLang = null;
    if (/[\u0B80-\u0BFF]/.test(lastText)) lockLang = 'Tamil (தமிழ் script)';
    else if (/[\u0900-\u097F]/.test(lastText)) lockLang = 'Hindi (हिन्दी Devanagari script)';
    if (lockLang) {
      instruction += `\n\nLANGUAGE LOCK: The user's latest message is in ${lockLang}. Reply ONLY in ${lockLang}. Do not reply in English. Answer the actual question correctly and completely.`;
    }
  }

  // Keep the last ~20 messages as conversation context
  const contextMessages = messages.slice(-20);

  // 1. Collect all valid earlier images from the conversation history
  const previousImages = [];
  for (let i = 0; i < contextMessages.length - 1; i++) {
    const m = contextMessages[i];
    if (Array.isArray(m.attachments)) {
      for (const file of m.attachments) {
        const mime = file.mimeType || file.type || '';
        if (mime.startsWith('image/')) {
          let b64 = null;
          if (file.data && typeof file.data === 'string' && !file.data.startsWith('/api/') && !file.data.startsWith('http')) {
            b64 = file.data.replace(/^data:[^;]+;base64,/, '');
          } else if (file.dataUrl && typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:')) {
            b64 = file.dataUrl.replace(/^data:[^;]+;base64,/, '');
          }
          if (b64) {
            previousImages.push({
              name: file.name || `Image_${previousImages.length + 1}`,
              mimeType: mime,
              data: b64,
              turnIndex: i + 1,
            });
          }
        }
      }
    }
  }

  // 2. Inspect latest user message intent
  const lastUserMsgObj = contextMessages.filter((m) => m.role === 'user').pop();
  const lastUserText = (lastUserMsgObj?.content || '').trim();
  const hasCurrentAttachments = Array.isArray(lastUserMsgObj?.attachments) && lastUserMsgObj.attachments.length > 0;

  // Detect follow-up signals:
  // e.g. "what are the visible signs?", "explain more", "why?", "continue", "it", "this", "that", "same image", "compare"
  const isFollowupText =
    /^(explain\s+more|continue|why\??|why\s+so\??|elaborate|tell\s+me\s+more|what\s+else|what\s+about\s+(it|this|that|them)\??|how\s+about\s+(it|this|that|them)\??|show\s+(me\s+)?(the\s+)?code|add\s+to\s+it|modify\s+it|fix\s+it|what\s+are\s+the\s+(visible\s+)?signs\??|what\s+are\s+the\s+features\??|compare\s+(it\s+with\s+the\s+previous|both|them|these)\??|enter)$/i.test(lastUserText) ||
    /\b(same image|previous image|first image|earlier image|visible signs|signs of|facial expression|look at it|based on this)\b/i.test(lastUserText) ||
    (lastUserText.length <= 16 && !hasCurrentAttachments);

  // 3. Format messages for Gemini API with multimodal and multi-turn optimizations
  const rawContents = [];

  for (let idx = 0; idx < contextMessages.length; idx++) {
    const msg = contextMessages[idx];
    if (msg.role === 'system') continue;

    const isLatest = idx === contextMessages.length - 1;
    const isUser = msg.role !== 'assistant';
    const role = isUser ? 'user' : 'model';
    const parts = [];

    let imageCount = 0;
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      for (const file of msg.attachments) {
        const mime = file.mimeType || file.type || '';
        if (mime.startsWith('image/') || mime === 'application/pdf') {
          let rawBase64 = null;
          if (file.data && typeof file.data === 'string' && !file.data.startsWith('/api/') && !file.data.startsWith('http')) {
            rawBase64 = file.data.replace(/^data:[^;]+;base64,/, '');
          } else if (file.dataUrl && typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:')) {
            rawBase64 = file.dataUrl.replace(/^data:[^;]+;base64,/, '');
          }

          if (rawBase64) {
            imageCount++;
            if (mime.startsWith('image/')) {
              parts.push({ text: `[Image ${imageCount}: ${file.name || 'Attached Image'}]` });
            }
            parts.push({
              inlineData: {
                mimeType: mime,
                data: rawBase64,
              },
            });
          }
        } else if (file.textContent || file.text) {
          const textContent = file.textContent || file.text || '';
          parts.push({
            text: `--- Attached File: ${file.name || 'Document'} ---\n${textContent}\n--- End of File ---`,
          });
        }
      }
    }

    const textContent = (msg.content || '').trim();

    if (isUser) {
      const isBriefFollowup = !textContent || /^(enter|what\s+about\s+this\??|and\s+this\??|this\??|\.)$/i.test(textContent);

      if (textContent && !isBriefFollowup) {
        let enhancedText = textContent;
        // If this is the latest user message, has no new image, but there were earlier images and user is asking a follow-up:
        if (isLatest && imageCount === 0 && previousImages.length > 0 && isFollowupText) {
          const names = previousImages.map((img) => img.name).join(', ');
          enhancedText = `${textContent}\n\n[Context Guidance: This is a direct follow-up referring to the ongoing conversation and previously uploaded image(s) (${names}). Inspect the visual details from the earlier image(s) above (facial features, expressions, visible signs, colors, objects) and answer specifically based on that visual evidence.]`;
        } else if (isLatest && imageCount > 0 && previousImages.length > 0 && /compare/i.test(textContent)) {
          enhancedText = `${textContent}\n\n[Context Guidance: The user has uploaded this image to compare with the earlier image(s). Perform a comprehensive, structured comparison between the previous image and this new image.]`;
        } else if (isLatest && isFollowupText && previousImages.length === 0 && idx > 0) {
          enhancedText = `${textContent}\n\n[Context Guidance: The user is requesting a deeper continuation ("${textContent}") of the immediately preceding topic. Build directly upon your previous response with advanced insights, code, or concrete steps without repeating basic intros.]`;
        }
        parts.push({ text: enhancedText });
      } else if (imageCount > 0) {
        // Image attached with minimal or no text
        if (idx > 0) {
          parts.push({
            text: textContent
              ? `The user sent this image with follow-up input: "${textContent}". Interpret this directly in continuation of the preceding conversation and analysis. Relate the image to previous points and ongoing questions.`
              : 'The user re-sent this image or submitted it as a continuation turn without additional text. Continue the analysis directly from the previous discussion: build upon earlier observations and answer in context of our ongoing conversation.',
          });
        } else {
          parts.push({
            text: 'The user uploaded an image without a specific question. Please inspect this image thoroughly: 1) Identify and describe key visible elements (objects, people, animals, text, diagrams, setting, mood). 2) Summarize what this image depicts in a clear, engaging, structured manner. 3) Ask a friendly follow-up question offering specific ways you can help.',
          });
        }
      } else if (textContent) {
        parts.push({ text: textContent });
      } else if (parts.length === 0) {
        parts.push({ text: 'Hello Nova!' });
      }
    } else {
      // Model message
      if (textContent) {
        parts.push({ text: textContent });
      } else if (parts.length === 0) {
        // Skip empty placeholder messages
        continue;
      }
    }

    if (parts.length > 0) {
      rawContents.push({ role, parts });
    }
  }

  // 4. Normalize rawContents: strictly alternate roles (user -> model -> user -> model -> user)
  const contents = [];
  for (const item of rawContents) {
    if (!item.parts || item.parts.length === 0) continue;

    if (contents.length === 0) {
      if (item.role === 'user') {
        contents.push(item);
      }
      // Skip leading model turns
    } else {
      const prev = contents[contents.length - 1];
      if (prev.role === item.role) {
        // Merge consecutive turns of same role into one turn
        prev.parts.push(...item.parts);
      } else {
        contents.push(item);
      }
    }
  }

  // Ensure dialogue begins with user
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }
  // Ensure dialogue ends with user
  while (contents.length > 0 && contents[contents.length - 1].role !== 'user') {
    contents.pop();
  }

  if (contents.length === 0) {
    throw new Error('Please enter a message to chat with Nova.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Candidate fallback list
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
    ])
  );

  // Activate search grounding only when user explicitly asks for real-time/live web information
  const lastUserMsg = contextMessages.filter((m) => m.role === 'user').pop()?.content || '';
  const searchIntentRegex = /\b(latest|current|today|live|news|real-time|weather|stock|score|who won|release date|search online|web search)\b/i;
  const wantsSearch = !isVoiceMode && searchIntentRegex.test(lastUserMsg);
  let triedWithGrounding = wantsSearch;

  for (let modelIdx = 0; modelIdx < candidateModels.length; modelIdx++) {
    const modelToTry = candidateModels[modelIdx];
    if (signal?.aborted) return;

    try {
      const config = {
        systemInstruction: instruction,
        temperature: 0.35,
        maxOutputTokens: isVoiceMode ? 300 : 8192,
      };
      // Voice replies must start instantly: skip internal "thinking" for the fast voice model
      if (isVoiceMode && !voiceThinkingRejected) config.thinkingConfig = { thinkingBudget: 0 };

      if (triedWithGrounding) {
        config.tools = [{ googleSearch: {} }];
      }

      const responseStream = await ai.models.generateContentStream({
        model: modelToTry,
        contents,
        config,
      });

      const extractedSources = [];
      const seenUrls = new Set();

      for await (const chunk of responseStream) {
        if (signal?.aborted) break;

        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(groundingChunks)) {
          for (const gc of groundingChunks) {
            const uri = gc.web?.uri;
            const title = gc.web?.title || uri;
            if (uri && !seenUrls.has(uri)) {
              seenUrls.add(uri);
              extractedSources.push({
                title,
                url: uri,
                domain: extractDomain(uri),
              });
            }
          }
        }

        const text =
          chunk.text ??
          chunk.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ??
          '';

        if (text) {
          onChunk(text);
        }
      }

      if (extractedSources.length > 0 && typeof onSources === 'function') {
        onSources(extractedSources);
      }

      return;
    } catch (error) {
      if (signal?.aborted) return;
      const msg = error.message || '';

      // If the model rejects the thinking setting, remember it and retry the SAME model without it
      if (isVoiceMode && !voiceThinkingRejected && /thinking/i.test(msg)) {
        voiceThinkingRejected = true;
        console.warn(`[Nova] ${modelToTry} rejected thinkingConfig; retrying without it.`);
        modelIdx--;
        continue;
      }

      if (triedWithGrounding && (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('grounding') || msg.includes('tools'))) {
        console.warn(`[Nova] Grounding quota hit for ${modelToTry}. Retrying smoothly without live search grounding...`);
        triedWithGrounding = false;
        try {
          const responseStream = await ai.models.generateContentStream({
            model: modelToTry,
            contents,
            config: {
              systemInstruction: instruction,
              temperature: 0.35,
              maxOutputTokens: isVoiceMode ? 512 : 8192,
            },
          });

          for await (const chunk of responseStream) {
            if (signal?.aborted) break;
            const text =
              chunk.text ??
              chunk.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ??
              '';
            if (text) {
              onChunk(text);
            }
          }
          return;
        } catch (innerError) {
          console.warn(`[Nova] Model ${modelToTry} fallback attempt failed: ${innerError.message}`);
        }
      }

      if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403')) {
        throw new Error(
          'Invalid Gemini API key. Please check your GEMINI_API_KEY in server/.env. Get a free key at https://aistudio.google.com/apikey'
        );
      }

      console.warn(`[Nova] Model ${modelToTry} notice (${msg.slice(0, 90)}). Trying fallback model...`);
    }
  }

  throw new Error('Nova / Gemini rate limit or connection issue. Please wait a moment and click Retry.');
}
