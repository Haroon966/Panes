# TerminalAI: after each interactive command, emit a private OSC so the UI can use exit codes.
# Stripped client-side before paint. Format: ESC ] 773 ; exit ; <code> BEL
function __terminalai_fish_postexec --on-event fish_postexec
    printf '\033]773;exit;%s;\007' $status
end

# Rename the current terminal tab in TerminalAI (UTF-8-safe via base64). Example: terminalai-tab-name my project
function terminalai-tab-name --description 'Set TerminalAI tab title'
    set -l t (string trim -- (string join ' ' $argv))
    if test -z "$t"
        echo 'Usage: terminalai-tab-name <name>' >&2
        return 1
    end
    set -l b (printf '%s' "$t" | command base64 2>/dev/null | string tr -d '\n')
    if test -z "$b"
        echo 'terminalai-tab-name: base64 failed' >&2
        return 1
    end
    printf '\033]773;tab;%s;\007' "$b"
end
