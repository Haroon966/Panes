import './env.js';
import fs from 'node:fs';
import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { agentApiRouter } from './routes/agent';
import { agentHitlRouter } from './routes/agentHitl';
import { clineAgentRouter } from './routes/clineAgent';
import { fishConfigRouter } from './routes/fishConfig';
import { modelsApiRouter } from './routes/models';
import { openDb, getDb } from './db/client';
import { createPtySession, logFishAvailability } from './pty';
import { persistenceRouter } from './routes/persistence';
import { updateCheckRouter } from './routes/updateCheck';
import { attachPtyToWebSocket } from './shellBridge';

const app = express();
const port = Number(process.env.PORT) || 3001;

openDb();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  try {
    getDb().prepare('SELECT 1 AS ok').get();
    res.json({ ok: true, db: true });
  } catch {
    res.json({ ok: true, db: false });
  }
});

app.use('/api', modelsApiRouter);
app.use('/api', agentApiRouter);
app.use('/api', agentHitlRouter);
app.use('/api', clineAgentRouter);
app.use('/api', fishConfigRouter);
app.use('/api', persistenceRouter);
app.use('/api', updateCheckRouter);

const distDir = path.resolve(process.cwd(), 'dist');
const serveUi =
  process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'index.html'));

if (serveUi) {
  app.use(express.static(distDir, { index: false, fallthrough: true }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      next();
      return;
    }
    if (res.headersSent) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', (ws, req: IncomingMessage) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const browserSessionId = url.searchParams.get('sessionId')?.trim() || undefined;
    const { pty, meta } = createPtySession({ cols: 80, rows: 24 });
    attachPtyToWebSocket(pty, ws, meta, browserSessionId);
  } catch (e) {
    console.error('[TerminalAI] PTY spawn failed:', e);
    ws.close(1011, 'pty-spawn-failed');
  }
});

server.listen(port, () => {
  console.log(`TerminalAI server http://localhost:${port}`);
  logFishAvailability();
});
