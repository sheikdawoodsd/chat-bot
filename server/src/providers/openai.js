import { DEFAULT_SYSTEM_PROMPT } from './gemini.js';

/**
 * Stream responses from OpenAI (or any OpenAI-compatible API)
 * Uses native fetch with SSE streaming
 */
export async function streamOpenAI({ messages, systemPrompt, model, onChunk, signal }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'OpenAI API key is missing. Set AI_PROVIDER=openai and add OPENAI_API_KEY in server/.env.'
    );
  }

  const modelName = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const instruction = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  // Keep last 20 messages
  const contextMessages = messages.slice(-20);

  const formattedMessages = [
    { role: 'system', content: instruction },
    ...contextMessages.map((m) => ({
      role: m.role,
      content: m.content || '',
    })),
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: formattedMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `OpenAI returned status ${response.status}`;
    throw new Error(`OpenAI Error: ${message}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.replace('data: ', '').trim();
      if (dataStr === '[DONE]') return;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          onChunk(delta);
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
