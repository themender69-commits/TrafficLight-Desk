const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { createHttpServer } = require('./desktop/http-server.cjs');
const { createTray } = require('./desktop/tray.cjs');
const { createWindowLayout } = require('./desktop/window-layout.cjs');
const { showConnectConfirm } = require('./desktop/connect-dialog.cjs');
const { playApprovalSound } = require('./desktop/approval-sound.cjs');
const { startPendingApprovalWatcher } = require('./desktop/pending-watch.cjs');

const STATE_DIR = path.join(app.getPath('home'), '.trafficlight-desk');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const DEFAULT_STATE = {
  status: 'idle',
  tool: 'cursor',
  updatedAt: Date.now(),
};

let mainWindow = null;
let watchers = [];
let windowLayout = null;

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(partial) {
  ensureStateDir();
  const prev = readState();
  const next = { ...prev, ...partial, updatedAt: Date.now() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  if (partial.status === 'waiting' && prev.status !== 'waiting') {
    playApprovalSound();
  }
  return next;
}

function watchStateFile() {
  ensureStateDir();
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }

  const watcher = fs.watch(STATE_FILE, () => {
    /* renderer polls HTTP */
  });
  watchers.push(watcher);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = mainWindow;
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  });
}

function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  windowLayout = createWindowLayout(() => mainWindow);
  const bounds = windowLayout.getInitialBounds(screenW);

  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  mainWindow.setAlwaysOnTop(true, 'floating');

  const isDev = process.env.TRAFFICLIGHT_DEV === '1';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!gotTheLock) {
    return;
  }
  ensureStateDir();
  watchStateFile();
  startPendingApprovalWatcher(STATE_DIR, readState, writeState);
  createHttpServer({
    stateDir: STATE_DIR,
    readState,
    writeState,
    onRestart: () => {
      app.relaunch();
      app.exit(0);
    },
    onQuit: () => {
      app.quit();
    },
    setMenuOpen: (open) => {
      if (windowLayout) {
        windowLayout.setMenuOpen(open);
      }
    },
    showConnectConfirm: (detection, currentToolId) =>
      showConnectConfirm(() => mainWindow, detection, currentToolId),
  });
  createWindow();
  createTray({
    stateDir: STATE_DIR,
    writeState,
    getMainWindow: () => mainWindow,
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  watchers.forEach((w) => w.close());
});
