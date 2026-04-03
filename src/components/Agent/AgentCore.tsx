import { useSettingsStore } from '@/store/settingsStore';

export function AgentCore() {
  const agentMode = useSettingsStore((s) => s.agentMode);
  const setAgentMode = useSettingsStore((s) => s.setAgentMode);

  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-terminalai-muted">
      <input
        type="checkbox"
        checked={agentMode}
        onChange={(e) => setAgentMode(e.target.checked)}
        className="rounded border-terminalai-border"
      />
      <span>Agent mode 🤖</span>
    </label>
  );
}
