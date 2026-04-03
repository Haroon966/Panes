export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

export interface SelectedModel {
  provider: ProviderId;
  modelId: string;
}
