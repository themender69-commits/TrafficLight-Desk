const { Menu, Tray, nativeImage, dialog } = require('electron');
const { detectTool } = require('./path-resolver.cjs');
const {
  installToolHooks,
  uninstallTool,
  readConnection,
  uninstallPreviousTool,
} = require('./hook-installer.cjs');
const { TOOL_LABELS, showConnectConfirm, showConnectSuccess } = require('./connect-dialog.cjs');
const { clearHookActivity } = require('./monitor-health.cjs');

const TOOL_IDS = ['cursor', 'codex', 'claude'];

function buildTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="11" cy="5" r="4" fill="#666"/>
      <circle cx="11" cy="11" r="4" fill="#f5a623"/>
      <circle cx="11" cy="17" r="4" fill="#666"/>
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  );
}

function createTray({ stateDir, writeState, getMainWindow }) {
  let tray = null;

  async function connectTool(toolId) {
    const detection = detectTool(toolId);
    if (!detection.supportsHooks) {
      await dialog.showMessageBox({
        type: 'info',
        title: '暂不支持',
        message: detection.unsupportedReason || `${TOOL_LABELS[toolId]} 暂不支持自动监控`,
      });
      return;
    }

    if (!detection.found) {
      await dialog.showMessageBox({
        type: 'warning',
        title: '未找到配置',
        message: detection.hint || `未找到 ${TOOL_LABELS[toolId]} 的配置目录`,
      });
      return;
    }

    const current = readConnection(stateDir);
    const consent = await showConnectConfirm(
      getMainWindow,
      detection,
      current?.tool || null,
    );

    if (!consent) {
      return;
    }

    try {
      const previousTool =
        current && current.tool !== toolId ? current.tool : null;
      const result = installToolHooks(stateDir, toolId);
      if (previousTool) {
        uninstallPreviousTool(stateDir, previousTool, result.manifest);
      }
      clearHookActivity(stateDir);
      writeState({ tool: toolId, status: 'idle' });
      await showConnectSuccess(getMainWindow, toolId);
      rebuildMenu();
    } catch (error) {
      await dialog.showMessageBox({
        type: 'error',
        title: '连接失败',
        message: '无法完成 Hook 安装',
        detail: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  async function disconnectTool() {
    const current = readConnection(stateDir);
    if (!current) {
      return;
    }
    uninstallTool(stateDir, current.tool);
    clearHookActivity(stateDir);
    writeState({ status: 'idle' });
    rebuildMenu();
  }

  function rebuildMenu() {
    if (!tray) {
      return;
    }
    const connection = readConnection(stateDir);
    const toolItems = TOOL_IDS.map((toolId) => {
      const detection = detectTool(toolId);
      const connected = connection?.tool === toolId;
      const suffix = connected ? ' ✓' : detection.found ? '' : '（未安装）';
      return {
        label: `${TOOL_LABELS[toolId]}${suffix}`,
        enabled: detection.supportsHooks,
        click: () => connectTool(toolId),
      };
    });

    const menu = Menu.buildFromTemplate([
      { label: 'TrafficLight Desk', enabled: false },
      { type: 'separator' },
      ...toolItems,
      { type: 'separator' },
      {
        label: '断开连接',
        enabled: Boolean(connection),
        click: () => disconnectTool(),
      },
      {
        label: '显示红绿灯',
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
          }
        },
      },
      { type: 'separator' },
      { role: 'quit', label: '退出' },
    ]);
    tray.setContextMenu(menu);
  }

  tray = new Tray(buildTrayIcon());
  tray.setToolTip('TrafficLight Desk — 点击显示红绿灯');
  tray.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
    rebuildMenu();
    tray.popUpContextMenu();
  });
  rebuildMenu();

  return {
    tray,
    rebuildMenu,
    connectTool,
    disconnectTool,
  };
}

module.exports = { createTray };
