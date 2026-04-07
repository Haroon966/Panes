-- Workspace-relative paths always inlined into the agent system prompt (JSON array).

ALTER TABLE app_prefs ADD COLUMN agent_pinned_paths_json TEXT NOT NULL DEFAULT '[]';
