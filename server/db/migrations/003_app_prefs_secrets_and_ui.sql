-- API keys as JSON map (provider id -> key). Plaintext on disk; same risk class as .env.
ALTER TABLE app_prefs ADD COLUMN api_keys_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE app_prefs ADD COLUMN custom_base_url TEXT NOT NULL DEFAULT '';
ALTER TABLE app_prefs ADD COLUMN workspace_root TEXT NOT NULL DEFAULT '';
ALTER TABLE app_prefs ADD COLUMN cline_local_base_url TEXT NOT NULL DEFAULT '';
ALTER TABLE app_prefs ADD COLUMN cline_agent_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE app_prefs ADD COLUMN cline_auto_fallback_on_error INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_prefs ADD COLUMN agent_panel_open INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_prefs ADD COLUMN history_panel_open INTEGER NOT NULL DEFAULT 1;
