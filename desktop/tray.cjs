const { Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { detectTool } = require('./path-resolver.cjs');
const {
  installToolHooks,
  uninstallTool,
  readConnection,
} = require('./hook-installer.cjs');
const { TOOL_LABELS } = require('./http-server.cjs');

const TOOL_IDS = ['cursor', 'codex', 'claude', 'trae'];

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

    const consent = await dialog.showMessageBox({
      type: 'question',
      buttons: ['取消', '仅此授权'],
      defaultId: 1,
      cancelId: 0,
      title: `连接 ${TOOL_LABELS[toolId]}`,
      message: `将监控 ${TOOL_LABELS[toolId]} 的 Agent 状态`,
      detail: [
        detection.installHint || '',
        detection.note || '',
        '',
        '仅写入 Hook 配置与本机状态文件。',
        '不访问网络、不读取项目代码、不需要管理员权限。',
        '可随时从菜单断开并撤销。',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    if (consent.response !== 1) {
      return;
    }

    try {
      const current = readConnection(stateDir);
      if (current && current.tool !== toolId) {
        uninstallTool(stateDir, current.tool);
      }
      installToolHooks(stateDir, toolId);
      writeState({ tool: toolId, status: 'idle' });
      await dialog.showMessageBox({
        type: 'info',
        title: '已连接',
        message: `${TOOL_LABELS[toolId]} 监控已启用`,
        detail: '若状态未更新，请重启对应 AI 工具。',
      });
      rebuildMenu();
    } catch (error) {
      await dialog.showMessageBox({
        type: 'error',
        title: '连接失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  async function disconnectTool() {
    const current = readConnection(stateDir);
    if (!current) {
      return;
    }
    uninstallTool(stateDir, current.tool);
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
      const prefix = !detection.supportsHooks ? '· ' : '';
      return {
        label: `${prefix}${TOOL_LABELS[toolId]}${suffix}`,
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
  tray.setToolTip('TrafficLight Desk');
  tray.on('click', rebuildMenu);
  rebuildMenu();

  return {
    tray,
    rebuildMenu,
    connectTool,
    disconnectTool,
  };
}

module.exports = { createTray };
