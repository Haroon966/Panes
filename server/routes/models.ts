import { Router, type Request, type Response } from 'express';
import { getGroqKeyFromDb } from '../lib/appPrefs';

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

async function fetchOllamaTags(base: string): Promise<{ models: string[]; reachable: boolean }> {
  try {
    const u = `${base.replace(/\/$/, '')}/api/tags`;
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { models: [], reachable: false };
    const j = (await r.json()) as { models?: { name: string }[] };
    const models = (j.models ?? []).map((m) => m.name).filter(Boolean);
    return { models, reachable: true };
  } catch {
    return { models: [], reachable: false };
  }
}

async function fetchLMStudioModels(base: string): Promise<{ models: string[]; reachable: boolean }> {
  try {
    const u = `${base.replace(/\/$/, '')}/v1/models`;
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { models: [], reachable: false };
    const j = (await r.json()) as { data?: { id: string }[] };
    const models = (j.data ?? []).map((m) => m.id).filter(Boolean);
    return { models, reachable: true };
  } catch {
    return { models: [], reachable: false };
  }
}

/** Groq OpenAI-compatible listing; same shape as https://api.openai.com/v1/models */
async function fetchGroqModels(apiKey: string): Promise<{ models: string[]; reachable: boolean }> {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { models: [], reachable: false };
    const j = (await r.json()) as { data?: { id: string }[] };
    const raw = (j.data ?? []).map((m) => m.id).filter(Boolean);
    // Drop speech/TTS entries; they are not valid for chat completions in this app.
    const models = raw.filter((id) => {
      const x = id.toLowerCase();
      return !x.includes('whisper') && !x.includes('playai');
    });
    models.sort((a, b) => a.localeCompare(b));
    return { models, reachable: true };
  } catch {
    return { models: [], reachable: false };
  }
}

export const modelsApiRouter = Router();

modelsApiRouter.get('/models', async (req: Request, res: Response) => {
  const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const lmBase = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234';
  const groqKey = (
    req.get('x-groq-api-key') ||
    getGroqKeyFromDb() ||
    process.env.GROQ_API_KEY ||
    ''
  ).trim();

  const [ollamaResult, lmResult, groqResult] = await Promise.all([
    fetchOllamaTags(ollamaBase),
    fetchLMStudioModels(lmBase),
    groqKey ? fetchGroqModels(groqKey) : Promise.resolve({ models: [] as string[], reachable: false }),
  ]);

  const staticModels =
    groqKey && groqResult.reachable && groqResult.models.length > 0
      ? { ...STATIC_MODELS, groq: groqResult.models }
      : STATIC_MODELS;

  res.json({
    static: staticModels,
    local: {
      ollama: ollamaResult.models,
      lmstudio: lmResult.models,
      ollamaReachable: ollamaResult.reachable,
      lmstudioReachable: lmResult.reachable,
    },
  });
});
