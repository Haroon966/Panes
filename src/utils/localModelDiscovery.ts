import { DEFAULT_STATIC_MODELS } from '@/providers/llm';
import type { ProviderId } from '@/types/models';

/** Mirrors GET /api/models. `local.*Reachable` means HTTP success, including empty model lists. */
export interface ModelsApiResponse {
  static: Record<string, string[]>;
  local: {
    ollama: string[];
    lmstudio: string[];
    ollamaReachable: boolean;
    lmstudioReachable: boolean;
  };
}

type StaticProviderKey = Exclude<ProviderId, 'ollama' | 'lmstudio'>;

const STATIC_PROVIDER_KEYS: StaticProviderKey[] = [
  'openai',
  'anthropic',
  'google',
  'groq',
  'mistral',
  'custom',
];

/** Prefer server lists when the catalog has loaded; fall back to client defaults. */
export function getMergedStaticModels(
  catalog: ModelsApiResponse | null
): Record<StaticProviderKey, string[]> {
  if (!catalog?.static) return { ...DEFAULT_STATIC_MODELS };
  const out = { ...DEFAULT_STATIC_MODELS };
  for (const k of STATIC_PROVIDER_KEYS) {
    const arr = catalog.static[k];
    if (Array.isArray(arr) && arr.length > 0) {
      out[k] = arr;
    }
  }
  return out;
}

export async function fetchModelsCatalog(): Promise<ModelsApiResponse | null> {
  try {
    const base = import.meta.env.VITE_API_BASE_URL || '';
    const r = await fetch(`${base}/api/models`);
    if (!r.ok) return null;
    return (await r.json()) as ModelsApiResponse;
  } catch {
    return null;
  }
}
