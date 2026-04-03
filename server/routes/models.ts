import { Router, type Request, type Response } from 'express';

const STATIC_MODELS = {
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
};

async function fetchOllamaTags(base: string): Promise<string[]> {
  try {
    const u = `${base.replace(/\/$/, '')}/api/tags`;
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { models?: { name: string }[] };
    return (j.models ?? []).map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchLMStudioModels(base: string): Promise<string[]> {
  try {
    const u = `${base.replace(/\/$/, '')}/v1/models`;
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: { id: string }[] };
    return (j.data ?? []).map((m) => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

export const modelsApiRouter = Router();

modelsApiRouter.get('/models', async (_req: Request, res: Response) => {
  const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const lmBase = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234';

  const [ollamaModels, lmModels] = await Promise.all([
    fetchOllamaTags(ollamaBase),
    fetchLMStudioModels(lmBase),
  ]);

  res.json({
    static: STATIC_MODELS,
    local: {
      ollama: ollamaModels,
      lmstudio: lmModels,
      ollamaReachable: ollamaModels.length > 0,
      lmstudioReachable: lmModels.length > 0,
    },
  });
});
