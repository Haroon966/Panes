import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { agentApiRouter } from './routes/agent';
import { chatApiRouter } from './routes/chat';
import { fishConfigRouter } from './routes/fishConfig';
import { modelsApiRouter } from './routes/models';
import { createPtySession, logFishAvailability } from './pty';
import { attachPtyToWebSocket } from './shellBridge';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', modelsApiRouter);
app.use('/api', chatApiRouter);
app.use('/api', agentApiRouter);
app.use('/api', fishConfigRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/terminal' });

wss.on('connection', (ws) => {
  try {
    const { pty, meta } = createPtySession({ cols: 80, rows: 24 });
    attachPtyToWebSocket(pty, ws, meta);
  } catch (e) {
    console.error('[TerminalAI] PTY spawn failed:', e);
    ws.close(1011, 'pty-spawn-failed');
  }
});

server.listen(port, () => {
  console.log(`TerminalAI server http://localhost:${port}`);
  logFishAvailability();
});
