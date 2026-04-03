import type { LanguageModel } from 'ai';

export function createCustomOpenAICompatProvider(
  baseUrl: string,
  apiKey: string,
  modelId: string
): LanguageModel {
  void baseUrl;
  void apiKey;
  void modelId;
  return null as unknown as LanguageModel;
}
