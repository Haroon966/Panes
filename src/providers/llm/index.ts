import type { ProviderId } from '@/types/models';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  custom: 'Custom (OpenAI-compatible)',
};

/** Static defaults; merged with /api/models at runtime */
export const DEFAULT_STATIC_MODELS: Record<Exclude<ProviderId, 'ollama' | 'lmstudio'>, string[]> = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o3-mini'],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  mistral: ['mistral-large-latest', 'codestral-latest'],
  custom: ['gpt-4o-mini'],
};

export const llmProviderRegistry = DEFAULT_STATIC_MODELS;
