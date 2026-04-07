# Vendor mirrors

## Cline (optional local clone)

The [Cline](https://github.com/cline/cline) repository is **not** tracked in this repo (there is **no git submodule**; ignore any stale `.gitmodules` from older checkouts). Clone it locally when you want to compare upstream behavior, read extension code, or study UI patterns.

```bash
git clone --depth 1 --branch main https://github.com/cline/cline.git vendor/cline
```

For a stable snapshot, check out a tag after cloning (e.g. `git -C vendor/cline checkout v3.77.0`).

Licensed under **Apache-2.0**. TerminalAI is a separate project; see root **`NOTICE`**.

The directory `vendor/cline/` is listed in `.gitignore`.

## Optional UI / terminal references (manual clone)

Clone these repos here if you want local copies (see `CHECKLIST.md` Phase 2):

```bash
git clone --depth 1 https://github.com/mckaywrigley/chatbot-ui vendor/chat-ui
git clone --depth 1 https://github.com/rohanchandra/react-terminal-component vendor/terminal
```

`nicholasgasior/react-terminal-ui` from the PRD was unavailable; use `react-terminal-component` as the documented alternative.

`vendor/chat-ui` and `vendor/terminal` remain gitignored in this repo to keep clones optional.
