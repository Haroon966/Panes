import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, phase: 0 });
});

app.listen(port, () => {
  console.log(`TerminalAI server http://localhost:${port}`);
});
