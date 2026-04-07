import { getDb } from '../db/client';
import type { ModelRequestAuth, ProviderId } from './modelFactory';

const PROVIDER_IDS: ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'groq',
  'mistral',
  'ollama',
  'lmstudio',
  'custom',
];

/** Secrets live in SQLite as plaintext; same practical risk as .env on the same host. */
export type AppPrefsSecretsRow = {
  api_keys_json: string;
  custom_base_url: string;
  workspace_root: string;
  cline_local_base_url: string;
  cline_agent_id: string;
  cline_auto_fallback_on_error: number;
  agent_panel_open: number;
  history_panel_open: number;
};

export function parseApiKeysJson(raw: string): Partial<Record<ProviderId, string>> {
  if (!raw || raw === '{}') return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== 'object') return {};
    const out: Partial<Record<ProviderId, string>> = {};
    for (const id of PROVIDER_IDS) {
      const v = o[id];
      if (typeof v === 'string' && v.trim()) out[id] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function mergeApiKeysPatch(
  existing: Partial<Record<ProviderId, string>>,
  patch: Record<string, string> | undefined
): Partial<Record<ProviderId, string>> {
  if (!patch) return existing;
  const next: Partial<Record<ProviderId, string>> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (!PROVIDER_IDS.includes(k as ProviderId)) continue;
    const pid = k as ProviderId;
    if (v.trim() === '') delete next[pid];
    else next[pid] = v.trim();
  }
  return next;
}

export function stringifyApiKeys(m: Partial<Record<ProviderId, string>>): string {
  const plain: Record<string, string> = {};
  for (const id of PROVIDER_IDS) {
    const v = m[id];
    if (v && v.trim()) plain[id] = v.trim();
  }
  return JSON.stringify(plain);
}

export function keyPresenceFromKeys(keys: Partial<Record<ProviderId, string>>): Record<ProviderId, boolean> {
  return {
    openai: !!(keys.openai?.trim()),
    anthropic: !!(keys.anthropic?.trim()),
    google: !!(keys.google?.trim()),
    groq: !!(keys.groq?.trim()),
    mistral: !!(keys.mistral?.trim()),
    ollama: !!(keys.ollama?.trim()),
    lmstudio: !!(keys.lmstudio?.trim()),
    custom: !!(keys.custom?.trim()),
  };
}

export function loadAppPrefsSecretsRow(db = getDb()): AppPrefsSecretsRow {
  const row = db
    .prepare(
      `SELECT api_keys_json, custom_base_url, workspace_root, cline_local_base_url,
              cline_agent_id, cline_auto_fallback_on_error, agent_panel_open, history_panel_open
       FROM app_prefs WHERE id = 1`
    )
    .get() as AppPrefsSecretsRow | undefined;
  if (!row) {
    return {
      api_keys_json: '{}',
      custom_base_url: '',
      workspace_root: '',
      cline_local_base_url: '',
      cline_agent_id: 'default',
      cline_auto_fallback_on_error: 1,
      agent_panel_open: 1,
      history_panel_open: 1,
    };
  }
  return row;
}

export function getGroqKeyFromDb(db = getDb()): string {
  const keys = parseApiKeysJson(loadAppPrefsSecretsRow(db).api_keys_json);
  return (keys.groq ?? '').trim();
}

/** Body → DB-stored → omit (env handled in createChatModel). */
export function resolveAgentAuthFromPrefs(
  body: { provider: ProviderId; model: string; apiKey?: string; baseUrl?: string },
  db = getDb()
): ModelRequestAuth {
  const row = loadAppPrefsSecretsRow(db);
  const keys = parseApiKeysJson(row.api_keys_json);
  const dbKey = (keys[body.provider] ?? '').trim();
  const dbCustomBase = row.custom_base_url.trim();
  return {
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey?.trim() || dbKey || undefined,
    baseUrl:
      body.baseUrl?.trim() ||
      (body.provider === 'custom' && dbCustomBase ? dbCustomBase : undefined) ||
      undefined,
  };
}

export function resolveWorkspaceRootFromPrefs(
  bodyWorkspace: string | undefined,
  db = getDb()
): string | undefined {
  const w = bodyWorkspace?.trim() || loadAppPrefsSecretsRow(db).workspace_root.trim();
  return w || undefined;
}
