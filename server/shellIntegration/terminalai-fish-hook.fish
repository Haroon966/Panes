# TerminalAI: after each interactive command, emit a private OSC so the UI can use exit codes.
# Stripped client-side before paint. Format: ESC ] 773 ; exit ; <code> BEL
function __terminalai_fish_postexec --on-event fish_postexec
    printf '\033]773;exit;%s;\007' $status
end
