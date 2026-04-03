import { Router, type Request, type Response } from 'express';
import { streamText, type CoreMessage } from 'ai';
import { createLanguageModel, type ProviderId } from '../lib/modelFactory';

/** Same transport as /api/chat but defaults agentMode behavior on the client; server accepts explicit flag. */
export const agentApiRouter = Router();

agentApiRouter.post('/agent', async (req: Request, res: Response) => {
  const body = req.body as {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    provider: ProviderId;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    terminalContext?: string;
    errorContext?: string;
  };

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

  const maxSteps = Math.min(20, Math.max(1, Number(process.env.AGENT_MAX_STEPS) || 5));
  const enable = process.env.ENABLE_AGENT !== 'false';

  if (!enable) {
    res.status(403).json({ error: 'Agent disabled (ENABLE_AGENT=false)' });
    return;
  }

  const systemParts = [
    'You are TerminalAI agent with access to the following terminal snapshot. Answer concisely.',
    body.terminalContext
      ? 'Terminal output:\n```\n' + body.terminalContext.slice(-12000) + '\n```'
      : '',
    body.errorContext ? 'Error:\n```\n' + body.errorContext + '\n```' : '',
    'Put shell commands in ```bash blocks. Do not auto-run commands.',
  ].filter(Boolean);

  const messages: CoreMessage[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const result = streamText({
      model,
      system: systemParts.join('\n\n'),
      messages,
      maxSteps,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    for await (const chunk of result.textStream) {
      res.write(chunk);
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Agent stream failed' });
    } else {
      res.end();
    }
  }
});
