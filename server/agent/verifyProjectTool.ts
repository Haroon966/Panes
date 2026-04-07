import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { agentReadOnlyMode, requireApprovalForShell, shellToolEnabled } from './approvalEnv';
import { registerPendingShell } from './pendingApprovalsStore';
import { executeShellCommand } from './shellTool';

const MAX_VERIFY_COMMAND_LEN = 2048;

/** Comma-separated substrings; if non-empty, command string must include one (same as shell). */
function allowlistOk(command: string): boolean {
  const raw = process.env.AGENT_SHELL_ALLOWLIST?.trim();
  if (!raw) return true;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.some((p) => command.includes(p));
}

export function createVerifyProjectTool(
  workspaceRootAbs: string,
  opts: {
    agentVerifyCommand: string;
    terminalSessionId?: string;
    userAlwaysConfirmMutations?: boolean;
  }
) {
  if (agentReadOnlyMode()) return [];
  if (!shellToolEnabled()) return [];

  const root = path.resolve(workspaceRootAbs);
  const cmd = opts.agentVerifyCommand.trim();
  if (!cmd) return [];

  const terminalSessionId = opts.terminalSessionId;
  const shellNeedApproval =
    !!opts?.userAlwaysConfirmMutations || requireApprovalForShell();

  return [
    tool(
      async () => {
        if (cmd.length > MAX_VERIFY_COMMAND_LEN) {
          return `Refused: verify command exceeds ${MAX_VERIFY_COMMAND_LEN} characters.`;
        }
        const argv = ['sh', '-c', cmd];
        if (!allowlistOk(cmd)) {
          return `Refused: command not allowed by AGENT_SHELL_ALLOWLIST.`;
        }
        const preview = cmd;
        if (shellNeedApproval) {
          const id = registerPendingShell({
            workspaceRootAbs: root,
            argv,
            terminalSessionId,
          });
          return `PENDING_APPROVAL:${JSON.stringify({ id, command: preview })}`;
        }
        return executeShellCommand(root, argv, terminalSessionId);
      },
      {
        name: 'run_project_verify_command',
        description:
          'Run the user-configured **project verify** command once in the workspace root (e.g. npm test, npm run lint). Same rules and approval flow as run_workspace_command. Only available when the user saved a non-empty verify command in settings and AGENT_ALLOW_SHELL=1.',
        schema: z.object({}),
      }
    ),
  ];
}
