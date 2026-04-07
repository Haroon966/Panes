# TerminalAI: after each interactive command, emit private OSCs (stripped client-side before paint).
# exit: ESC ] 773 ; exit ; <code> BEL
# pwd:  ESC ] 773 ; pwd ; <base64 of pwd -P> BEL — persisted agent/workspace cwd (change only via cd in shell)
function __terminalai_fish_postexec --on-event fish_postexec
    printf '\033]773;exit;%s;\007' $status
    set -l d (pwd -P 2>/dev/null)
    if test -n "$d"
        # Join base64 lines without external `tr` (Fish has no `string tr`; avoid stale `string tr` typos).
        set -l pb (string join '' (printf '%s' "$d" | command base64 2>/dev/null))
        if test -n "$pb"
            printf '\033]773;pwd;%s;\007' "$pb"
        end
    end
end

# Rename the current terminal tab in TerminalAI (UTF-8-safe via base64). Example: terminalai-tab-name my project
function terminalai-tab-name --description 'Set TerminalAI tab title'
    set -l t (string trim -- (string join ' ' $argv))
    if test -z "$t"
        echo 'Usage: terminalai-tab-name <name>' >&2
        return 1
    end
    set -l b (string join '' (printf '%s' "$t" | command base64 2>/dev/null))
    if test -z "$b"
        echo 'terminalai-tab-name: base64 failed' >&2
        return 1
    end
    printf '\033]773;tab;%s;\007' "$b"
end
