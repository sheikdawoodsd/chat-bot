import { DEFAULT_SYSTEM_PROMPT } from './gemini.js';

/**
 * Stream responses from Anthropic Claude
 * Uses native fetch with SSE streaming
 */
export async function streamClaude({ messages, systemPrompt, model, onChunk, signal }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'Anthropic API key is missing. Set AI_PROVIDER=claude and add ANTHROPIC_API_KEY in server/.env.'
    );
  }

  const modelName = model || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
  const instruction = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  // Keep last 20 messages, filter system, format for Claude
  const contextMessages = messages.slice(-20);
  const claudeMessages = contextMessages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 4096,
      system: instruction,
      messages: claudeMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Claude returned status ${response.status}`;
    throw new Error(`Claude Error: ${message}`);
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

      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text);
        } else if (parsed.type === 'message_stop') {
          return;
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
