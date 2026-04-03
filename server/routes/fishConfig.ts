import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Router, type Request, type Response } from 'express';

export const fishConfigRouter = Router();

fishConfigRouter.get('/fish-config', (_req: Request, res: Response) => {
  const p = join(homedir(), '.config/fish/config.fish');
  if (!existsSync(p)) {
    res.status(404).json({ error: 'File not found', path: p });
    return;
  }
  try {
    const content = readFileSync(p, 'utf8');
    res.json({ path: p, content });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Read failed' });
  }
});
