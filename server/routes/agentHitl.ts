import { Router, type Request, type Response } from 'express';
import { executeApproved } from '../agent/executeApproval';
import { rejectPending } from '../agent/pendingApprovalsStore';
import { requireApprovalForShell, requireApprovalForWrites, shellToolEnabled } from '../agent/approvalEnv';
import type { AgentHitlStatusResponse } from '../agent/hitlTypes';

export const agentHitlRouter = Router();

agentHitlRouter.get('/agent/hitl/status', (_req: Request, res: Response) => {
  const body: AgentHitlStatusResponse = {
    supported: true,
    phase: 'writes_shell',
    message: `Approvals: writes=${requireApprovalForWrites() ? 'required' : 'off'}, shell=${
      shellToolEnabled() ? (requireApprovalForShell() ? 'approval' : 'auto') : 'disabled'
    }`,
  };
  res.json(body);
});

agentHitlRouter.post('/agent/hitl/approve', async (req: Request, res: Response) => {
  const id = typeof req.body?.approvalId === 'string' ? req.body.approvalId.trim() : '';
  if (!id) {
    res.status(400).json({ ok: false, error: 'approvalId required' });
    return;
  }
  const result = await executeApproved(id);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
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
