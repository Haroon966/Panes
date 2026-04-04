import { Router, type Request, type Response } from 'express';
import { streamAgentPlainText } from '../agent/runAgent';
import { streamErrorToolHint } from '../agent/toolErrorHints';
import { resolveAgentAuthFromPrefs, resolveWorkspaceRootFromPrefs } from '../lib/appPrefs';
import { createChatModel } from '../lib/chatModelFactory';
import type { ProviderId } from '../lib/modelFactory';

export const agentApiRouter = Router();

function isClientConfigError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return (
    m.includes('API key missing') ||
    m.includes('requires baseUrl') ||
    m.includes('Unknown provider') ||
    m.includes('Custom provider requires')
  );
}

agentApiRouter.post('/agent', async (req: Request, res: Response) => {
  const body = req.body as {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    provider: ProviderId;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    terminalContext?: string;
    errorContext?: string;
    /** Absolute path on the server host (optional; else AGENT_WORKSPACE_ROOT or API cwd). */
    workspaceRoot?: string;
    /** Focused terminal tab; agent shell runs in that PTY when connected. */
    terminalSessionId?: string;
  };

  if (!body?.messages?.length || !body.provider || !body.model) {
    res.status(400).json({ error: 'messages, provider, and model are required' });
    return;
  }

  const enable = process.env.ENABLE_AGENT !== 'false';
  if (!enable) {
    res.status(403).json({ error: 'Agent disabled (ENABLE_AGENT=false)' });
    return;
  }

  const auth = resolveAgentAuthFromPrefs({
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
  });

  let llm;
  try {
    llm = createChatModel(auth);
  } catch (e) {
    const status = isClientConfigError(e) ? 400 : 500;
    res.status(status).json({ error: e instanceof Error ? e.message : 'Model config error' });
    return;
  }

  const ac = new AbortController();
  // Do NOT use req.on('close') for abort: for POST, 'close' fires when the body
  // stream ends (normal), which would abort the graph before any tokens stream.
  const onResClose = () => {
    if (!res.writableEnded) {
      ac.abort();
    }
  };
  const onReqAborted = () => ac.abort();
  res.on('close', onResClose);
  req.on('aborted', onReqAborted);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    for await (const chunk of streamAgentPlainText({
      auth,
      llm,
      messages: body.messages,
      ctx: {
        terminalContext: body.terminalContext,
        errorContext: body.errorContext,
        terminalSessionId: body.terminalSessionId,
      },
      workspaceRootHint: resolveWorkspaceRootFromPrefs(body.workspaceRoot),
      signal: ac.signal,
    })) {
      if (res.writableEnded) break;
      res.write(chunk);
    }
    res.end();
  } catch (e) {
    const aborted =
      e instanceof Error &&
      (e.name === 'AbortError' || (typeof DOMException !== 'undefined' && e instanceof DOMException));
    if (aborted) {
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    console.error('[TerminalAI] /api/agent failed:', e);
    if (!res.headersSent) {
      const status = isClientConfigError(e) ? 400 : 500;
      const base = e instanceof Error ? e.message : 'Agent stream failed';
      const hint = streamErrorToolHint(e, {});
      res.status(status).json({ error: base + hint });
    } else if (!res.writableEnded) {
      try {
        res.write(streamErrorToolHint(e, {}));
      } catch {
        /* ignore */
      }
      res.end();
    }
  } finally {
    res.off('close', onResClose);
    req.off('aborted', onReqAborted);
  }
});
