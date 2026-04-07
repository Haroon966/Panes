import { Router, type Request, type Response } from 'express';
import { executeApproved } from '../agent/executeApproval';
import { rejectPending } from '../agent/pendingApprovalsStore';
import { requireApprovalForShell, requireApprovalForWrites, shellToolEnabled } from '../agent/approvalEnv';
import { loadAgentRuntimePrefs } from '../lib/agentStylePrefs';
import type { AgentHitlStatusResponse } from '../agent/hitlTypes';
import { redactLikelySecrets } from '../lib/agentSecretLeak';

export const agentHitlRouter = Router();

agentHitlRouter.get('/agent/hitl/status', (_req: Request, res: Response) => {
  const prefs = loadAgentRuntimePrefs();
  const writesNeed = requireApprovalForWrites() || !prefs.agentAutoMode;
  let shell: string;
  if (!shellToolEnabled()) shell = 'disabled';
  else if (requireApprovalForShell() || !prefs.agentAutoMode) shell = 'approval';
  else shell = 'auto';
  const body: AgentHitlStatusResponse = {
    supported: true,
    phase: 'writes_shell',
    message: `Approvals: writes_and_patches=${writesNeed ? 'required' : 'off'}, shell=${shell}`,
  };
  res.json(body);
});

agentHitlRouter.post('/agent/hitl/approve', async (req: Request, res: Response) => {
  const id = typeof req.body?.approvalId === 'string' ? req.body.approvalId.trim() : '';
  if (!id) {
    res.status(400).json({ ok: false, error: 'approvalId required' });
    return;
  }
  const result = await executeApproved(id, {
    clientWorkspaceDirtyPaths: req.body?.workspaceDirtyPaths,
  });
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  const { text } = redactLikelySecrets(result.message);
  res.json({ ok: true, message: text });
});

agentHitlRouter.post('/agent/hitl/reject', (req: Request, res: Response) => {
  const id = typeof req.body?.approvalId === 'string' ? req.body.approvalId.trim() : '';
  if (!id) {
    res.status(400).json({ ok: false, error: 'approvalId required' });
    return;
  }
  const removed = rejectPending(id);
  if (!removed) {
    res.status(404).json({ ok: false, error: 'Unknown or expired approval id' });
    return;
  }
  res.json({ ok: true, message: 'Rejected; pending action discarded.' });
});
