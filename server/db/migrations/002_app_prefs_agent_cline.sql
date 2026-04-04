ALTER TABLE app_prefs ADD COLUMN agent_backend TEXT NOT NULL DEFAULT 'langchain';
ALTER TABLE app_prefs ADD COLUMN cline_model TEXT NOT NULL DEFAULT '';
