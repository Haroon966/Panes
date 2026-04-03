import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createPtySession, logFishAvailability } from './pty';
import { attachPtyToWebSocket } from './shellBridge';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', (ws) => {
  let ptyProcess;
  try {
    ptyProcess = createPtySession({ cols: 80, rows: 24 });
  } catch (e) {
    console.error('[TerminalAI] PTY spawn failed:', e);
    ws.close(1011, 'pty-spawn-failed');
    return;
  }
  attachPtyToWebSocket(ptyProcess, ws);
});

server.listen(port, () => {
  console.log(`TerminalAI server http://localhost:${port}`);
  logFishAvailability();
});
