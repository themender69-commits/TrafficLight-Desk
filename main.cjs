const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { createHttpServer } = require('./desktop/http-server.cjs');
const { createTray } = require('./desktop/tray.cjs');
const { createWindowLayout } = require('./desktop/window-layout.cjs');
const { showConnectConfirm } = require('./desktop/connect-dialog.cjs');
const { createStateMachine } = require('./desktop/state-machine.cjs');
const { createSseHub } = require('./desktop/sse-hub.cjs');
const { createTraceLog } = require('./desktop/trace-log.cjs');
const { versionStatus } = require('./desktop/version-info.cjs');
const {
  installToolHooks,
  readConnection,
} = require('./desktop/hook-installer.cjs');
const { recordHookActivity } = require('./desktop/monitor-health.cjs');

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
let sseHub = null;
let traceLog = null;
let stateMachine = null;

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
  return next;
}

function watchStateFile() {
  ensureStateDir();
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }

  const watcher = fs.watch(STATE_FILE, () => {
    /* SSE pushes updates */
  });
  watchers.push(watcher);
}

function syncHooksIfStale() {
  const connection = readConnection(STATE_DIR);
  if (!connection?.tool) {
    return;
  }
  const versions = versionStatus(STATE_DIR);
  if (versions.installed && versions.installed === versions.hooksSource) {
    return;
  }
  try {
    installToolHooks(STATE_DIR, connection.tool);
    console.log(
      `TrafficLight: Hook 已同步至 v${versions.hooksSource}（原 v${versions.installed || '未知'}）`,
    );
  } catch (error) {
    console.warn(
      'TrafficLight: Hook 版本同步失败',
      error instanceof Error ? error.message : error,
    );
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

function showMainWindow() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) {
    return false;
  }
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
  if (process.platform === 'darwin') {
    app.dock.show();
  }
  return true;
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
    skipTaskbar: process.platform !== 'darwin',
    show: false,
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

  mainWindow.once('ready-to-show', () => {
    showMainWindow();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    showMainWindow();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!gotTheLock) {
    return;
  }
  ensureStateDir();
  for (const name of ['pending-approval', 'pending-stub']) {
    try {
      fs.unlinkSync(path.join(STATE_DIR, name));
    } catch {
      /* ignore */
    }
  }

  sseHub = createSseHub();
  traceLog = createTraceLog();
  stateMachine = createStateMachine({
    stateDir: STATE_DIR,
    readState,
    writeState,
    broadcast: (event, data) => sseHub.broadcast(event, data),
    trace: traceLog,
    recordHookActivity: () => recordHookActivity(STATE_DIR),
  });

  watchStateFile();
  syncHooksIfStale();

  createHttpServer({
    stateDir: STATE_DIR,
    readState,
    writeState,
    stateMachine,
    sseHub,
    traceLog,
    versionStatus,
    showMainWindow,
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
    } else {
      showMainWindow();
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
