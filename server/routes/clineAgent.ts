import { Router, type Request, type Response } from 'express';
import { streamAgentPlainText } from '../agent/runAgent';
import {
  checkClineUpstreamHealth,
  getClineUpstreamKind,
  getResolvedBaseHostHint,
  getClineAuthToken,
  getDefaultClineChatPath,
  getDefaultClineStreamMode,
  isOllamaClineUpstream,
  listClineUpstreamModels,
  parseClineAgentIds,
  pickOllamaModelFromTags,
  resolveClineBaseUrl,
  resolveClineUpstreamModel,
  streamClinePlainText,
  type ClineChatMessage,
} from '../cline/clineStream';
import { streamErrorToolHint } from '../agent/toolErrorHints';
import { resolveEffectiveWorkspaceRoot } from '../agent/workspaceRoot';
import { getClineLocalBaseUrlFromDb, resolveWorkspaceRootFromPrefs } from '../lib/appPrefs';
import { createOpenAiCompatibleUpstreamChatModel } from '../lib/chatModelFactory';
import { attachAgentTextStream, getChatMessagesValidationError } from './agentRequestShared';

export const clineAgentRouter = Router();

function logClineProxyFailure(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const unreachable =
    msg.includes('Cannot connect to Cline bridge') || msg.includes('Cannot reach Cline bridge');
  if (unreachable && process.env.TERMINALAI_VERBOSE_CLINE !== '1') {
    return;
  }
  if (unreachable) {
    console.warn('[TerminalAI] /api/agent/cline:', msg);
    return;
  }
  console.error('[TerminalAI] /api/agent/cline failed:', err);
}

function optionalBodyBaseUrl(req: Request): string | undefined {
  const q = req.query.clineLocalBaseUrl;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return undefined;
}

clineAgentRouter.get('/agent/cline/options', (_req: Request, res: Response) => {
  const agents = parseClineAgentIds();
  const dbCline = getClineLocalBaseUrlFromDb();
  const base = resolveClineBaseUrl(undefined, dbCline);
  const payload: Record<string, unknown> = {
    agents,
    defaultAgent: agents[0] ?? 'default',
    streamMode: getDefaultClineStreamMode(),
    chatPath: getDefaultClineChatPath(),
    serverClineBaseConfigured: !!base,
  };
  if (base) {
    payload.upstreamKind = getClineUpstreamKind(base);
    payload.resolvedBaseHost = getResolvedBaseHostHint(base);
    payload.suggestedDefaultModel = resolveClineUpstreamModel(base, undefined, undefined);
  }
  res.json(payload);
});

clineAgentRouter.get('/agent/cline/models', async (req: Request, res: Response) => {
  const baseUrl = resolveClineBaseUrl(optionalBodyBaseUrl(req), getClineLocalBaseUrlFromDb());
  if (!baseUrl) {
    res.status(400).json({
      models: [],
      hint: 'No upstream base URL. Set server env or pass ?clineLocalBaseUrl=',
    });
    return;
  }
  const { models, hint } = await listClineUpstreamModels(baseUrl);
  res.json({ models, hint: hint ?? null, upstreamKind: getClineUpstreamKind(baseUrl) });
});

clineAgentRouter.get('/agent/cline/health', async (req: Request, res: Response) => {
  const baseUrl = resolveClineBaseUrl(optionalBodyBaseUrl(req), getClineLocalBaseUrlFromDb());
  if (!baseUrl) {
    res.json({
      ok: false,
      upstreamKind: 'custom',
      resolvedBaseHost: '',
      error: 'No Cline upstream URL configured',
    });
    return;
  }
  const h = await checkClineUpstreamHealth(baseUrl);
  res.json(h);
});

clineAgentRouter.post('/agent/cline', async (req: Request, res: Response) => {
  const body = req.body as {
    messages: ClineChatMessage[];
    model?: string;
    provider?: string;
    clineLocalBaseUrl?: string;
    clineAgentId?: string;
    /** Cline-only model (UI); preferred over main chat model when set. */
    clineModel?: string;
    terminalContext?: string;
    errorContext?: string;
    workspaceRoot?: string;
    terminalSessionId?: string;
    regenerationHint?: string;
    /** Same as POST /api/agent — unsaved workspace editor paths (LangGraph tools path only). */
    workspaceDirtyPaths?: unknown;
  };

  const msgErr = getChatMessagesValidationError(body.messages);
  if (msgErr) {
    res.status(400).json({ error: msgErr });
    return;
  }

  const enable = process.env.ENABLE_AGENT !== 'false';
  if (!enable) {
    res.status(403).json({ error: 'Agent disabled (ENABLE_AGENT=false)' });
    return;
  }

  const baseUrl = resolveClineBaseUrl(body.clineLocalBaseUrl, getClineLocalBaseUrlFromDb());
  if (!baseUrl) {
    res.status(400).json({
      error:
        'Cline upstream URL missing. Set CLINE_LOCAL_BASE_URL, or OLLAMA_BASE_URL / LMSTUDIO_BASE_URL on the server (see .env.example), or save “Cline local URL” in ⚙.',
    });
    return;
  }

  let model = resolveClineUpstreamModel(baseUrl, body.model, body.clineModel);
  if (
    isOllamaClineUpstream(baseUrl) &&
    !process.env.CLINE_DEFAULT_MODEL?.trim() &&
    !process.env.OLLAMA_MODEL?.trim() &&
    !body.clineModel?.trim()
  ) {
    const fromTags = await pickOllamaModelFromTags(baseUrl);
    if (fromTags) model = fromTags;
  }

  const plainProxyOnly = process.env.CLINE_AGENT_DISABLE_TOOLS === '1';
  const { signal, dispose } = attachAgentTextStream(
    req,
    res,
    plainProxyOnly ? 'cline_proxy' : 'langgraph'
  );

  const effectiveWorkspaceRoot = resolveEffectiveWorkspaceRoot({
    workspaceRootHint: resolveWorkspaceRootFromPrefs(body.workspaceRoot),
    terminalSessionId: body.terminalSessionId,
  });

  try {
    if (plainProxyOnly) {
      for await (const chunk of streamClinePlainText({
        baseUrl,
        chatPath: getDefaultClineChatPath(),
        streamMode: getDefaultClineStreamMode(),
        model,
        messages: body.messages,
        terminalContext: body.terminalContext,
        errorContext: body.errorContext,
        workspaceRoot: effectiveWorkspaceRoot,
        clineAgentId: body.clineAgentId,
        authToken: getClineAuthToken(baseUrl),
        signal,
        regenerationHint: body.regenerationHint,
      })) {
        if (res.writableEnded) break;
        res.write(chunk);
      }
    } else {
      const llm = createOpenAiCompatibleUpstreamChatModel(
        baseUrl,
        model,
        getClineAuthToken(baseUrl)
      );
      for await (const chunk of streamAgentPlainText({
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
    logClineProxyFailure(e);
    if (!res.headersSent) {
      const base = e instanceof Error ? e.message : 'Cline proxy failed';
      const hint = streamErrorToolHint(e, { cline: true });
      res.status(502).json({
        error: base + hint,
      });
    } else if (!res.writableEnded) {
      try {
        res.write(streamErrorToolHint(e, { cline: true }));
      } catch {
        /* ignore */
      }
      res.end();
    }
  } finally {
    dispose();
  }
});
