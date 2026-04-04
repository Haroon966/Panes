PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_prefs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  selected_provider TEXT NOT NULL DEFAULT 'openai',
  selected_model TEXT NOT NULL DEFAULT 'gpt-4o',
  agent_mode INTEGER NOT NULL DEFAULT 0,
  active_conversation_id TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS terminal_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO app_prefs (id, selected_provider, selected_model, agent_mode)
VALUES (1, 'openai', 'gpt-4o', 0);

INSERT OR IGNORE INTO terminal_state (id, payload) VALUES (1, '{}');
