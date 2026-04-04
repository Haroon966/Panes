import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function resolveDbFilePath(): string {
  const file = process.env.TERMINALAI_DB_PATH?.trim()
    ? process.env.TERMINALAI_DB_PATH.trim()
    : join(
        process.env.TERMINALAI_DATA_DIR?.trim() || join(homedir(), '.config', 'terminalai'),
        'terminalai.db'
      );
  mkdirSync(dirname(file), { recursive: true });
  return file;
}
