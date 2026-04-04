import Database from 'better-sqlite3';
import { resolveDbFilePath } from './paths';
import { runMigrations } from './migrate';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized; call openDb() first');
  }
  return db;
}

export function openDb(): Database.Database {
  if (db) return db;
  const path = resolveDbFilePath();
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
