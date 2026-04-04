import type { IPty } from 'node-pty';
import { WebSocket } from 'ws';
import type { ShellSessionMeta } from './pty';
import { registerPtySession, unregisterPtySession } from './ptySessionRegistry';

/**
 * Wire PTY I/O to a browser WebSocket.
 * - First outbound message (text): JSON session meta for UI hints
 * - Binary frames: raw keystrokes / paste (UTF-8) → PTY input
 * - Text frames after: JSON `{ type: "resize", cols, rows }` only
 */
export function attachPtyToWebSocket(
  ptyProcess: IPty,
  ws: WebSocket,
  sessionMeta: ShellSessionMeta,
  /** When set, agent shell tools can run commands in this PTY (see chat `terminalSessionId`). */
  browserSessionId?: string
): void {
  let cleanedUp = false;
  if (browserSessionId) {
    registerPtySession(browserSessionId, ptyProcess, sessionMeta.shellLabel);
  }

  const sessionPayload = JSON.stringify({
    type: 'session',
    shellLabel: sessionMeta.shellLabel,
  });
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(sessionPayload);
  } else {
    ws.once('open', () => ws.send(sessionPayload));
  }

  const dataDisposable = ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  const exitRef: { d: { dispose: () => void } | null } = { d: null };

  const onMessage = (data: WebSocket.RawData, isBinary: boolean) => {
    if (isBinary) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      ptyProcess.write(buf.toString('utf8'));
      return;
    }
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    try {
      const msg = JSON.parse(text) as { type?: string; cols?: number; rows?: number };
      if (msg.type === 'resize' && typeof msg.cols === 'number' && typeof msg.rows === 'number') {
        ptyProcess.resize(Math.max(2, msg.cols), Math.max(2, msg.rows));
        return;
      }
    } catch {
      //
    }
  };

  const onClose = () => cleanup(true);
  const onError = () => cleanup(true);

  function cleanup(killPty: boolean) {
    if (cleanedUp) return;
    cleanedUp = true;
    if (browserSessionId) {
      unregisterPtySession(browserSessionId, ptyProcess);
    }
    dataDisposable.dispose();
    exitRef.d?.dispose();
    exitRef.d = null;
    ws.removeListener('message', onMessage);
    ws.removeListener('close', onClose);
    ws.removeListener('error', onError);
    if (killPty) {
      try {
        ptyProcess.kill();
      } catch {
        //
      }
    }
  }

  exitRef.d = ptyProcess.onExit(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'pty-exited');
    }
    cleanup(false);
  });

  ws.on('message', onMessage);
  ws.on('close', onClose);
  ws.on('error', onError);
}
