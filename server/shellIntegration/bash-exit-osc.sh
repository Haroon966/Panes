# Optional bash: source this from ~/.bashrc or run: source /path/to/bash-exit-osc.sh
# Emits TerminalAI private OSC after each command (exit code in $?).
__terminalai_bash_precmd() {
  local code=$?
  printf '\033]773;exit;%s;\007' "$code"
}
case "$-" in
  *i*) PROMPT_COMMAND="__terminalai_bash_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
esac

# Rename the current terminal tab in TerminalAI. Example: terminalai_tab_name "my project"
terminalai_tab_name() {
  local t="$*"
  t=$(printf '%s' "$t" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [ -z "$t" ]; then
    echo 'Usage: terminalai_tab_name <name>' >&2
    return 1
  fi
  local b
  b=$(printf '%s' "$t" | base64 | tr -d '\n')
  printf '\033]773;tab;%s;\007' "$b"
}
