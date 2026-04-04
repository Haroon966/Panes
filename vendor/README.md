# Vendor mirrors

## Cline (git submodule)

The [Cline](https://github.com/cline/cline) repository is included as a **git submodule**
at `vendor/cline` (pinned in git to tag **`v3.77.0`**; see parent repo history).
Licensed under **Apache-2.0**. TerminalAI is a separate project; see root **`NOTICE`**
and **`docs/cline-architecture-audit.md`**.

Initialize after clone:

```bash
git submodule update --init --recursive
cd vendor/cline && git checkout v3.77.0   # if detached SHA differs
```

## Optional UI / terminal references (manual clone)

Clone these repos here if you want local copies (see `CHECKLIST.md` Phase 2):

```bash
git clone --depth 1 https://github.com/mckaywrigley/chatbot-ui vendor/chat-ui
git clone --depth 1 https://github.com/rohanchandra/react-terminal-component vendor/terminal
```

`nicholasgasior/react-terminal-ui` from the PRD was unavailable; use `react-terminal-component` as the documented alternative.

`vendor/chat-ui` and `vendor/terminal` remain gitignored in this repo to keep clones optional.
