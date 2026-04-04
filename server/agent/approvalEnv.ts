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
