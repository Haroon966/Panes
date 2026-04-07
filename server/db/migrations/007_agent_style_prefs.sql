-- Agent verbosity + optional free-text hints appended to the system prompt (app_prefs).

ALTER TABLE app_prefs ADD COLUMN agent_verbosity TEXT NOT NULL DEFAULT 'detailed';
ALTER TABLE app_prefs ADD COLUMN agent_context_hints TEXT NOT NULL DEFAULT '';
