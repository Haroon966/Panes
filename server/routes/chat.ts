import { Router, type Request, type Response } from 'express';
import { streamText, type CoreMessage } from 'ai';
import { createLanguageModel, type ProviderId } from '../lib/modelFactory';

const AGENT_SYSTEM = `You are TerminalAI agent. You help the user with their shell and project.
You may receive recent terminal output and error context — use it to give precise answers.
When suggesting shell commands, put each runnable command in its own fenced code block with language tag bash.
Never claim you executed a command; the user runs commands via the Run button.
If a command could be destructive (rm -rf, DROP TABLE, mkfs, etc.), prefix the block with a warning line.`;

export const chatApiRouter = Router();

interface ChatBody {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  errorContext?: string;
  terminalContext?: string;
  agentMode?: boolean;
}

chatApiRouter.post('/chat', async (req: Request, res: Response) => {
  const body = req.body as ChatBody;
  if (!body?.messages?.length || !body.provider || !body.model) {
    res.status(400).json({ error: 'messages, provider, and model are required' });
    return;
  }

  let model;
  try {
    model = createLanguageModel({
      provider: body.provider,
      model: body.model,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Model config error' });
    return;
  }

  const parts: string[] = [];
  if (body.agentMode) {
    parts.push(AGENT_SYSTEM);
  }
  if (body.terminalContext) {
    parts.push('Recent terminal output:\n```\n' + body.terminalContext + '\n```');
  }
  if (body.errorContext) {
    parts.push('Error context from user:\n```\n' + body.errorContext + '\n```');
  }
  const system = parts.length ? parts.join('\n\n') : undefined;

  const messages: CoreMessage[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const maxSteps = body.agentMode
    ? Math.min(20, Math.max(1, Number(process.env.AGENT_MAX_STEPS) || 5))
    : 1;

  try {
    const result = streamText({
      model,
      system,
      messages,
      maxSteps,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const chunk of result.textStream) {
      res.write(chunk);
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Stream failed' });
    } else {
      res.end();
    }
  }
});
