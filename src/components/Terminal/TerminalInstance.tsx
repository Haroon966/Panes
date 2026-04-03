import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';

const WS_PATH = '/ws/terminal';

function getWebSocketUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Dev: Vite proxies /ws → API server (see vite.config.ts)
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

/**
 * Live PTY terminal (xterm.js) — patterns informed by
 * vendor/rohanchandra/react-terminal-component (output/input structure),
 * with a real backend via node-pty (see server/).
 */
export function TerminalInstance() {
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
    // Unicode11Addon: enable when typings match @xterm/xterm major (see Phase 5 checklist)

    term.open(container);
    fit.fit();

    const ws = new WebSocket(getWebSocketUrl());
    ws.binaryType = 'arraybuffer';

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
      if (ev.data instanceof ArrayBuffer) {
        term.write(new TextDecoder().decode(ev.data));
      } else {
        term.write(ev.data);
      }
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[33m[Disconnected from shell]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      sendResize();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[240px] w-full overflow-hidden rounded border border-terminalai-border bg-terminalai-terminal"
    />
  );
}
