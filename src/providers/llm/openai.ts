import type { LanguageModel } from 'ai';

/** Real routing lives in `server/lib/modelFactory.ts` / `server/lib/chatModelFactory.ts`; UI calls `/api/agent`. */
export function createOpenAIProvider(apiKey: string, modelId: string): LanguageModel {
  void apiKey;
  void modelId;
  return null as unknown as LanguageModel;
}
