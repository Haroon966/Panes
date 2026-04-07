export function requireApprovalForWrites(): boolean {
  const v = process.env.AGENT_REQUIRE_APPROVAL_FOR_WRITES?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function requireApprovalForShell(): boolean {
  const v = process.env.AGENT_REQUIRE_APPROVAL_FOR_SHELL?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

export function shellToolEnabled(): boolean {
  const v = process.env.AGENT_ALLOW_SHELL?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** When true, workspace mutating tools and the shell tool are not registered (see `createWorkspaceTools`, `createShellTools`). */
export function agentReadOnlyMode(): boolean {
  const v = process.env.AGENT_READ_ONLY?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * When true, mutating workspace tools refuse paths not yet touched this run by
 * **read_workspace_file** or **get_workspace_file_outline** (see `workspaceReadBeforeWrite.ts`).
 */
export function enforceReadBeforeWrite(): boolean {
  const v = process.env.AGENT_ENFORCE_READ_BEFORE_WRITE?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
