import { streamGemini, NOVA_SYSTEM_PROMPT } from './gemini.js';
import { streamOpenAI } from './openai.js';
import { streamClaude } from './claude.js';

export const DEFAULT_SYSTEM_PROMPT = NOVA_SYSTEM_PROMPT;

export function getProvider(providerName) {
  const chosen = (providerName || process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

  switch (chosen) {
    case 'gemini':
      return {
        name: 'gemini',
        displayName: 'Google Gemini',
        stream: streamGemini,
      };
    case 'openai':
      return {
        name: 'openai',
        displayName: 'OpenAI GPT',
        stream: streamOpenAI,
      };
    case 'claude':
    case 'anthropic':
      return {
        name: 'claude',
        displayName: 'Anthropic Claude',
        stream: streamClaude,
      };
    default:
      throw new Error(
        `Unsupported AI provider: "${chosen}". Supported options are: "gemini", "openai", "claude".`
      );
  }
}
