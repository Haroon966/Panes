-- Persisted LangGraph tool / phase timeline per assistant message (JSON array).
ALTER TABLE messages ADD COLUMN agent_trace_json TEXT NOT NULL DEFAULT '[]';
