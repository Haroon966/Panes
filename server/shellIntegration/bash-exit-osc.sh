# Optional bash: source this from ~/.bashrc or run: source /path/to/bash-exit-osc.sh
# Emits TerminalAI private OSC after each command (exit code in $?).
__terminalai_bash_precmd() {
  local code=$?
  printf '\033]773;exit;%s;\007' "$code"
}
case "$-" in
  *i*) PROMPT_COMMAND="__terminalai_bash_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac
