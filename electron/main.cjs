'use strict';

const { app, BrowserWindow, shell, dialog, Menu } = require('electron');

// Linux: Electron's setuid chrome-sandbox is often missing root:4755 on local npm installs.
// Without this, startup fails with setuid_sandbox_host.cc. Opt in with ELECTRON_USE_SANDBOX=1
// after fixing sandbox per https://www.electronjs.org/docs/latest/tutorial/sandbox
if (process.platform === 'linux' && process.env.ELECTRON_USE_SANDBOX !== '1') {
  app.commandLine.appendSwitch('--no-sandbox');
}

const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

/** When false, API is expected already (e.g. npm run app with dev:server). */
function shouldSpawnServer() {
  if (app.isPackaged) return true;
  return process.env.ELECTRON_START_SERVER === '1';
}

function projectRoot() {
  return app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
}

function apiPort() {
  return Number(process.env.PORT) || 3001;
}

function waitForHealth(port, maxMs = 120_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs;
    const tryOnce = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        schedule();
      });
      req.on('error', schedule);
    };
    function schedule() {
      if (Date.now() >= deadline) {
        reject(new Error(`API not reachable on port ${port} within ${maxMs}ms`));
        return;
      }
      setTimeout(tryOnce, 250);
    }
    tryOnce();
  });
}

let serverChild = null;

function startApiServer() {
  const root = projectRoot();
  const port = apiPort();
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  if (app.isPackaged) {
    const entry = path.join(root, 'dist-server', 'index.cjs');
    const fs = require('fs');
    if (!fs.existsSync(entry)) {
      console.error('[TerminalAI] Missing dist-server bundle:', entry);
      app.quit();
      return;
    }
    serverChild = spawn('node', [entry], {
      cwd: root,
      env: { ...env, NODE_ENV: 'production' },
      stdio: 'inherit',
    });
  } else {
    const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const fs = require('fs');
    if (!fs.existsSync(tsxCli)) {
      console.error('[TerminalAI] Missing tsx; run npm install');
      app.quit();
      return;
    }
    serverChild = spawn('node', [tsxCli, 'server/index.ts'], {
      cwd: root,
      env,
      stdio: 'inherit',
    });
  }

  serverChild.on('error', (err) => {
    console.error('[TerminalAI] API server spawn failed:', err);
  });
  serverChild.on('exit', (code, signal) => {
    if (code != null && code !== 0) {
      console.error('[TerminalAI] API server exited with code', code);
    }
    if (signal) {
      console.error('[TerminalAI] API server killed by signal', signal);
    }
  });
}

function stopApiServer() {
  if (!serverChild) return;
  try {
    serverChild.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  serverChild = null;
}

function loadUrlForWindow(win) {
  const port = apiPort();
  const devUi = process.env.ELECTRON_DEV_URL || 'http://127.0.0.1:5173';
  const useDevUi = !app.isPackaged && process.env.ELECTRON_USE_VITE_DEV === '1';
  const url = useDevUi ? devUi : `http://127.0.0.1:${port}/`;
  return win.loadURL(url);
}

async function createWindow() {
  if (shouldSpawnServer()) {
    startApiServer();
  }

  try {
    await waitForHealth(apiPort());
  } catch (e) {
    console.error('[TerminalAI]', e.message);
    dialog.showMessageBoxSync({
      type: 'error',
      message: 'TerminalAI could not reach the API server.',
      detail: String(e.message),
      buttons: ['Quit'],
    });
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await loadUrlForWindow(win);
}

/** Drop the default File / Edit / View / Window / Help bar (in-window on Linux/Windows). */
function setApplicationMenuMinimal() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ])
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}

app.whenReady().then(() => {
  setApplicationMenuMinimal();
  void createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopApiServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopApiServer();
});
