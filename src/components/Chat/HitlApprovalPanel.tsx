import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChatStore, type HitlApprovalRow } from '@/store/chatStore';
import { useWorkbenchStore } from '@/store/workbenchStore';
import { cn } from '@/lib/utils';

async function postHitl(
  path: string,
  approvalId: string,
  workspaceDirtyPaths?: string[]
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approvalId,
      ...(workspaceDirtyPaths?.length ? { workspaceDirtyPaths } : {}),
    }),
  });
  const j = (await r.json()) as { ok?: boolean; message?: string; error?: string };
  if (!r.ok) {
    return { ok: false, error: j.error ?? r.statusText };
  }
  return { ok: true, message: j.message, error: j.error };
}

export function HitlApprovalCard({
  row,
  variant = 'panel',
  toolCallId,
}: {
  row: HitlApprovalRow;
  variant?: 'panel' | 'inline';
  /** When set (inline tool row), updates active tool activity when resolved. */
  toolCallId?: string;
}) {
  const resolveHitlApproval = useChatStore((s) => s.resolveHitlApproval);
  const appendAssistantChunkPersist = useChatStore((s) => s.appendAssistantChunkPersist);
  const markToolCallHitlResolved = useChatStore((s) => s.markToolCallHitlResolved);
  const dirtyWorkspacePaths = useWorkbenchStore((s) => s.dirtyWorkspacePaths);
  const [busy, setBusy] = useState(false);

  const disabled = row.status !== 'pending' || busy;

  const onApprove = async () => {
    setBusy(true);
    const res = await postHitl('/api/agent/hitl/approve', row.approvalId, dirtyWorkspacePaths);
    if (res.ok) {
      resolveHitlApproval(row.approvalId, 'approved', res.message);
      const note = res.message ? `\n\n**Approved** (${row.tool}): ${res.message}\n\n` : `\n\n**Approved** (${row.tool}).\n\n`;
      appendAssistantChunkPersist(note);
      if (toolCallId) {
        markToolCallHitlResolved(
          toolCallId,
          res.message ? `Approved — ${res.message}` : 'Approved'
        );
      }
    } else {
      resolveHitlApproval(row.approvalId, 'rejected', res.error);
      appendAssistantChunkPersist(`\n\n**Approve failed:** ${res.error ?? 'unknown error'}\n\n`);
      if (toolCallId) {
        markToolCallHitlResolved(toolCallId, `Approve failed: ${res.error ?? 'unknown'}`);
      }
    }
    setBusy(false);
  };

  const onReject = async () => {
    setBusy(true);
    const res = await postHitl('/api/agent/hitl/reject', row.approvalId);
    if (res.ok) {
      resolveHitlApproval(row.approvalId, 'rejected', res.message);
      appendAssistantChunkPersist(`\n\n**Rejected** (${row.tool}).\n\n`);
      if (toolCallId) {
        markToolCallHitlResolved(toolCallId, 'Rejected');
      }
    } else {
      resolveHitlApproval(row.approvalId, 'rejected', res.error);
      appendAssistantChunkPersist(`\n\n**Reject failed:** ${res.error ?? 'unknown error'}\n\n`);
      if (toolCallId) {
        markToolCallHitlResolved(toolCallId, `Reject failed: ${res.error ?? 'unknown'}`);
      }
    }
    setBusy(false);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-terminalai-border bg-terminalai-overlay text-[12px] leading-snug',
        variant === 'panel' ? 'px-3 py-2.5' : 'px-2.5 py-2',
        row.status === 'approved' && 'border-terminalai-success/40',
        row.status === 'rejected' && 'border-terminalai-border opacity-80'
      )}
      role="region"
      aria-label={`Approval for ${row.tool}`}
    >
      <div className="font-semibold text-terminalai-text">Action needs approval</div>
      <p className="mt-1 text-terminalai-muted">{row.summary}</p>
      {row.riskHint && <p className="mt-1 text-2xs text-terminalai-warning">{row.riskHint}</p>}
      {row.status === 'pending' ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 text-2xs"
            disabled={disabled}
            onClick={() => void onApprove()}
            aria-label={`Approve ${row.tool}`}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-2xs border-terminalai-border"
            disabled={disabled}
            onClick={() => void onReject()}
            aria-label={`Reject ${row.tool}`}
          >
            Reject
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-2xs font-medium text-terminalai-muted">
          {row.status === 'approved' ? 'Approved' : 'Rejected'}
          {row.feedback ? ` — ${row.feedback}` : ''}
        </p>
      )}
    </div>
  );
}

export function HitlApprovalPanel() {
  const rows = useChatStore((s) => s.hitlApprovals);
  const activeToolCalls = useChatStore((s) => s.activeToolCalls);

  const shownInInlinePanel = (r: HitlApprovalRow) =>
    r.status === 'pending' &&
    r.callId != null &&
    activeToolCalls.some(
      (c) => c.callId === r.callId && (c.phase === 'awaiting_approval' || c.phase === 'running')
    );

  const pending = rows.filter((r) => r.status === 'pending' && !shownInInlinePanel(r));
  const done = rows.filter((r) => r.status !== 'pending');

  if (rows.length === 0) return null;
  if (pending.length === 0 && done.length === 0) return null;

  return (
    <div className="shrink-0 space-y-2 border-t border-terminalai-borderSubtle bg-terminalai-surface px-3.5 py-2.5">
      {pending.length > 0 && (
        <>
          <div className="text-2xs font-semibold uppercase tracking-wide text-terminalai-mutedDeep">
            Pending approvals
          </div>
          {pending.map((row) => (
            <HitlApprovalCard key={row.approvalId} row={row} variant="panel" />
          ))}
        </>
      )}
      {done.length > 0 && (
        <details className="text-2xs text-terminalai-muted">
          <summary className="cursor-pointer select-none text-terminalai-mutedDeep">Recent decisions</summary>
          <div className="mt-1 space-y-1 pl-1">
            {done.map((row) => (
              <div key={row.approvalId}>
                {row.tool}: {row.status}
                {row.feedback ? ` — ${row.feedback.slice(0, 120)}` : ''}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
