import type { LanguageModel } from 'ai';

/** Real routing lives in `server/lib/modelFactory.ts`; UI calls `/api/chat`. */
export function createOpenAIProvider(apiKey: string, modelId: string): LanguageModel {
  void apiKey;
  void modelId;
  return null as unknown as LanguageModel;
}
