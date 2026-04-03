import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { registerTerminalErrorLinks } from './terminalErrorLinks';
import { useTerminalStore } from '@/store/terminalStore';

const WS_PATH = '/ws/terminal';

function getWebSocketUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

export interface TerminalInstanceProps {
  sessionId: string;
}

export function TerminalInstance({ sessionId }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      theme: {
        background: '#0a0e13',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new SearchAddon());
    term.loadAddon(new Unicode11Addon());
    (term.options as { unicodeVersion?: string }).unicodeVersion = '11';

    term.open(container);
    fit.fit();

    const linkDisp = registerTerminalErrorLinks(term);

    const ws = new WebSocket(getWebSocketUrl());
    ws.binaryType = 'arraybuffer';

    let outBuf = '';
    let sessionHandled = false;

    const appendPtyText = (s: string) => {
      outBuf += s;
      let idx: number;
      while ((idx = outBuf.indexOf('\n')) >= 0) {
        const line = outBuf.slice(0, idx).replace(/\r$/, '');
        outBuf = outBuf.slice(idx + 1);
        const st = useTerminalStore.getState();
        if (st.focusedSessionId === sessionId || st.activeSessionId === sessionId) {
          st.appendOutputLine(line);
        }
      }
    };

    const sendResize = () => {
      const dims = fit.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    };

    ws.onopen = () => {
      sendResize();
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      if (typeof ev.data === 'string') {
        if (!sessionHandled) {
          try {
            const j = JSON.parse(ev.data) as {
              type?: string;
              fishPreferredMissing?: boolean;
              fishInstallHint?: string;
            };
            if (j.type === 'session') {
              sessionHandled = true;
              if (j.fishPreferredMissing && j.fishInstallHint) {
                term.writeln(
                  `\r\n\x1b[38;2;240;136;62m${j.fishInstallHint}\x1b[0m\r\n`
                );
              }
              return;
            }
          } catch {
            sessionHandled = true;
          }
        }
        appendPtyText(ev.data);
        term.write(ev.data);
        return;
      }
      const text = new TextDecoder().decode(ev.data);
      appendPtyText(text);
      term.write(text);
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[33m[Disconnected from shell]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    const enc = new TextEncoder();
    const controller = {
      write: (data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(enc.encode(data));
      },
      pasteAndRun: (cmd: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(enc.encode(`${cmd}\r`));
        }
      },
      clear: () => term.clear(),
      resize: () => {
        fit.fit();
        sendResize();
      },
    };

    useTerminalStore.getState().registerController(sessionId, controller);

    const ro = new ResizeObserver(() => {
      fit.fit();
      sendResize();
    });
    ro.observe(container);

    const onMouseDown = () => {
      useTerminalStore.getState().setFocused(sessionId);
      term.focus();
    };
    container.addEventListener('mousedown', onMouseDown);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      ro.disconnect();
      linkDisp.dispose();
      useTerminalStore.getState().unregisterController(sessionId);
      ws.close();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[200px] w-full overflow-hidden rounded border border-terminalai-border bg-terminalai-terminal"
    />
  );
}
