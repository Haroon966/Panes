CREATE VIRTUAL TABLE IF NOT EXISTS workspace_fts USING fts5(
  relpath UNINDEXED,
  body,
  tokenize = 'porter unicode61'
);
