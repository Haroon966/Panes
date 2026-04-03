export interface ModelsApiResponse {
  static: Record<string, string[]>;
  local: {
    ollama: string[];
    lmstudio: string[];
    ollamaReachable: boolean;
    lmstudioReachable: boolean;
  };
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
