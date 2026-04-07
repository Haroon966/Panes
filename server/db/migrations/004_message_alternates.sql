PRAGMA foreign_keys = ON;

ALTER TABLE messages ADD COLUMN alternates_json TEXT NOT NULL DEFAULT '[]';
