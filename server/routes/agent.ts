import { Router, type Request, type Response } from 'express';
import { streamAgentPlainText } from '../agent/runAgent';
import { streamErrorToolHint } from '../agent/toolErrorHints';
import { resolveAgentAuthFromPrefs, resolveWorkspaceRootFromPrefs } from '../lib/appPrefs';
import { createChatModel } from '../lib/chatModelFactory';
import type { ProviderId } from '../lib/modelFactory';
import {
  attachAgentTextStream,
  CHAT_MESSAGES_REQUIRED,
  getChatMessagesValidationError,
} from './agentRequestShared';

export const agentApiRouter = Router();

/** Validates POST /api/agent body before streaming. Exported for unit tests. */
export function getAgentPostBodyValidationError(body: unknown): string | null {
  const b = body as {
    messages?: unknown;
    provider?: unknown;
    model?: unknown;
  };
  const msgErr = getChatMessagesValidationError(b.messages);
  if (msgErr) {
    return msgErr === CHAT_MESSAGES_REQUIRED
      ? 'messages, provider, and model are required'
      : msgErr;
  }
  if (typeof b.provider !== 'string' || !b.provider) {
    return 'messages, provider, and model are required';
  }
  if (typeof b.model !== 'string' || !b.model) {
    return 'messages, provider, and model are required';
  }
  return null;
}

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
    /** Ephemeral system instruction for this completion only (regenerate / rewrite response). */
    regenerationHint?: string;
    /** Client-reported paths with unsaved workspace editor buffers (optional). */
    workspaceDirtyPaths?: unknown;
  };

  const bodyErr = getAgentPostBodyValidationError(req.body);
  if (bodyErr) {
    res.status(400).json({ error: bodyErr });
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

  const { signal, dispose } = attachAgentTextStream(req, res, 'langgraph');

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
      signal,
      regenerationHint: body.regenerationHint,
      workspaceDirtyPaths: body.workspaceDirtyPaths,
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
    dispose();
  }
});
