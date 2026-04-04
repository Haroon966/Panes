/* eslint-disable no-control-regex -- skip CSI / OSC while tracking typed command */
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { createExitOscCarry, stripTerminalAiExitOsc } from '@/lib/terminalExitOsc';
import { useTerminalStore } from '@/store/terminalStore';
import { registerTerminalErrorLinks } from './terminalErrorLinks';
import { TerminalSessionStatusBar } from './TerminalSessionStatusBar';

const WS_PATH = '/ws/terminal';

/** xterm breaks if open/fit/write run while the element has no box (e.g. inactive tab `hidden`). */
function hasUsableLayout(el: HTMLElement): boolean {
  return el.clientWidth > 2 && el.clientHeight > 2;
}

function getWebSocketUrl(sessionId: string): string {
  const explicit = (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/$/, '');
  const base = explicit
    ? explicit
    : (() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}${WS_PATH}`;
      })();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * Track typed command line locally so empty Enter does not flip to Running.
 * Enter is detected on `\r` only (paste newlines do not submit).
 */
function consumeUserKeystrokes(data: string, sessionId: string, inputScratch: { s: string }): void {
  const st = useTerminalStore.getState();
  let i = 0;
  while (i < data.length) {
    const c = data[i];
    if (c === '\x1b') {
      const rest = data.slice(i);
      const csi = rest.match(/^\x1b\[[\d;?]*[ -/]*[@-~]/);
      if (csi) {
        i += csi[0].length;
        continue;
      }
      const osc = rest.match(/^\x1b\][^\x07]*\x07/);
      if (osc) {
        i += osc[0].length;
        continue;
      }
      const oscSt = rest.match(/^\x1b\][^\x1b\\]*(\x1b\\|\x9c)/);
      if (oscSt) {
        i += oscSt[0].length;
        continue;
      }
      i++;
      continue;
    }
    if (c === '\r') {
      const line = inputScratch.s.trim();
      inputScratch.s = '';
      if (line.length > 0) st.reportUserSubmittedNonEmptyCommand(sessionId, line);
      i++;
      continue;
    }
    if (c === '\n') {
      i++;
      continue;
    }
    if (c === '\x7f' || c === '\b') {
      inputScratch.s = inputScratch.s.slice(0, -1);
      i++;
      continue;
    }
    const code = data.codePointAt(i)!;
    if (code >= 0x20) {
      inputScratch.s += String.fromCodePoint(code);
      const cur = st.terminalSessionStatuses[sessionId];
      if (cur?.kind === 'success' || cur?.kind === 'error') {
        st.reportUserTyping(sessionId);
      }
      i += code > 0xffff ? 2 : 1;
    } else {
      i++;
    }
  }
}

export interface TerminalInstanceProps {
  sessionId: string;
}

export function TerminalInstance({ sessionId }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;

    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      theme: {
        background: '#0a0a0f',
        foreground: '#e8e8f0',
        cursor: '#7c6af7',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new SearchAddon());
    term.loadAddon(new Unicode11Addon());
    (term.options as { unicodeVersion?: string }).unicodeVersion = '11';

    let opened = false;
    let linkDisp: { dispose: () => void } | null = null;
    let pendingWrite = '';

    const oscCarry = createExitOscCarry();
    const inputScratch = { s: '' };

    const safeWrite = (chunk: string) => {
      if (!active) return;
      if (!opened || !hasUsableLayout(container)) {
        pendingWrite += chunk;
        return;
      }
      try {
        term.write(chunk);
      } catch {
        pendingWrite += chunk;
      }
    };

    const flushPendingWrites = () => {
      if (!active || !opened || !hasUsableLayout(container) || pendingWrite.length === 0) return;
      const chunk = pendingWrite;
      pendingWrite = '';
      try {
        term.write(chunk);
      } catch {
        pendingWrite = chunk;
      }
    };

    const tryOpenAndFit = () => {
      if (!active || !hasUsableLayout(container)) return false;
      if (!opened) {
        term.open(container);
        linkDisp = registerTerminalErrorLinks(term);
        opened = true;
      }
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
      flushPendingWrites();
      return true;
    };

    const ws = new WebSocket(getWebSocketUrl(sessionId));
    ws.binaryType = 'arraybuffer';

    let outBuf = '';
    let sessionHandled = false;

    const appendPtyText = (s: string) => {
      outBuf += s;
      useTerminalStore.getState().reportTerminalLogicalTail(sessionId, outBuf);
      let idx: number;
      while ((idx = outBuf.indexOf('\n')) >= 0) {
        const line = outBuf.slice(0, idx).replace(/\r$/, '');
        outBuf = outBuf.slice(idx + 1);
        const st = useTerminalStore.getState();
        if (st.focusedSessionId === sessionId || st.activeSessionId === sessionId) {
          st.appendOutputLine(line);
        }
        st.reportTerminalOutputLine(sessionId, line);
      }
    };

    const processIncomingPty = (raw: string) => {
      const { text, exitCodes, tabTitles } = stripTerminalAiExitOsc(raw, oscCarry);
      if (exitCodes.length > 0) {
        const last = exitCodes[exitCodes.length - 1]!;
        useTerminalStore.getState().reportShellExitCode(sessionId, last);
      }
      const st = useTerminalStore.getState();
      for (const rawTitle of tabTitles) {
        const t = rawTitle.trim().slice(0, 256);
        if (t) st.renameSession(sessionId, t);
      }
      appendPtyText(text);
      safeWrite(text);
    };

    const sendResize = () => {
      if (!active || !opened) return;
      const dims = fit.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    };

    ws.onopen = () => {
      if (!active) {
        if (ws.readyState === WebSocket.OPEN) ws.close();
        return;
      }
      tryOpenAndFit();
      sendResize();
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      if (!active) return;
      if (typeof ev.data === 'string') {
        if (!sessionHandled) {
          try {
            const j = JSON.parse(ev.data) as { type?: string };
            if (j.type === 'session') {
              sessionHandled = true;
              return;
            }
          } catch {
            sessionHandled = true;
          }
        }
        processIncomingPty(ev.data);
        return;
      }
      const text = new TextDecoder().decode(ev.data);
      processIncomingPty(text);
    };

    ws.onclose = () => {
      if (!active) return;
      useTerminalStore.getState().reportTerminalDisconnected(sessionId);
      safeWrite('\r\n\x1b[33m[Disconnected from shell]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (!active || ws.readyState !== WebSocket.OPEN) return;
      if (!opened) return;
      consumeUserKeystrokes(data, sessionId, inputScratch);
      ws.send(new TextEncoder().encode(data));
    });

    const enc = new TextEncoder();
    const controller = {
      write: (data: string) => {
        if (!active || ws.readyState !== WebSocket.OPEN) return;
        ws.send(enc.encode(data));
      },
      pasteAndRun: (cmd: string) => {
        if (!active || ws.readyState !== WebSocket.OPEN) return;
        ws.send(enc.encode(`${cmd}\r`));
      },
      clear: () => {
        if (active && opened) term.clear();
      },
      resize: () => {
        if (!active || !opened || !hasUsableLayout(container)) return;
        try {
          fit.fit();
          sendResize();
        } catch {
          /* terminal disposed or no layout */
        }
      },
    };

    useTerminalStore.getState().registerController(sessionId, controller);

    const ro = new ResizeObserver(() => {
      if (!active) return;
      if (!hasUsableLayout(container)) return;
      tryOpenAndFit();
      try {
        fit.fit();
        sendResize();
      } catch {
        /* xterm viewport can throw if disposed mid-sync */
      }
    });
    ro.observe(container);

    const onWindowResize = () => {
      if (!active || !opened || !hasUsableLayout(container)) return;
      try {
        fit.fit();
        sendResize();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', onWindowResize);

    const onMouseDown = () => {
      useTerminalStore.getState().setFocused(sessionId);
      if (opened) term.focus();
    };
    container.addEventListener('mousedown', onMouseDown);

    requestAnimationFrame(() => {
      if (active) tryOpenAndFit();
    });

    return () => {
      active = false;
      window.removeEventListener('resize', onWindowResize);
      container.removeEventListener('mousedown', onMouseDown);
      ro.disconnect();
      linkDisp?.dispose();
      useTerminalStore.getState().unregisterController(sessionId);
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener('open', () => ws.close(), { once: true });
      }
      try {
        term.dispose();
      } catch {
        /* not opened or already torn down */
      }
    };
  }, [sessionId]);

  return (
    <div className="flex h-full min-h-[200px] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-terminalai-border bg-terminalai-base">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
      <TerminalSessionStatusBar sessionId={sessionId} />
    </div>
  );
}
