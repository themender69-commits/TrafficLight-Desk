const { dialog } = require('electron');

const TOOL_LABELS = {
  cursor: 'Cursor',
  codex: 'Codex',
  claude: 'Claude Code',
};

function toolLabel(toolId) {
  return TOOL_LABELS[toolId] || toolId;
}

function buildConnectDetail(detection, currentToolId) {
  const target = toolLabel(detection.tool);
  const lines = [];

  if (currentToolId && currentToolId !== detection.tool) {
    lines.push(
      `将停止监控 ${toolLabel(currentToolId)}，改为监控 ${target}。`,
    );
  } else {
    lines.push(`通过本地 Hook 监控 ${target} 的 Agent 状态。`);
  }

  lines.push('仅写入本机配置，不联网。可随时「断开连接」撤销。');

  if (detection.note) {
    lines.push(detection.note);
  }

  return lines.join('\n');
}

function buildConnectOptions(detection, currentToolId) {
  const target = toolLabel(detection.tool);
  const isSwitch = Boolean(currentToolId && currentToolId !== detection.tool);

  return {
    type: 'question',
    buttons: ['取消', '确认'],
    defaultId: 1,
    cancelId: 0,
    title: isSwitch ? `切换至 ${target}` : `连接 ${target}`,
    message: isSwitch
      ? `从 ${toolLabel(currentToolId)} 切换监控对象。`
      : '安装本地 Hook 以驱动桌面红绿灯。',
    detail: buildConnectDetail(detection, currentToolId),
  };
}

function buildSuccessOptions(toolId) {
  return {
    type: 'info',
    title: '已连接',
    message: `${toolLabel(toolId)} 监控已启用。开始对话后指示灯会变绿。`,
  };
}

async function showConnectConfirm(getMainWindow, detection, currentToolId) {
  const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
  const options = buildConnectOptions(detection, currentToolId);
  const result = await dialog.showMessageBox(
    win && !win.isDestroyed() ? win : null,
    options,
  );
  return result.response === 1;
}

async function showConnectSuccess(getMainWindow, toolId) {
  const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
  await dialog.showMessageBox(
    win && !win.isDestroyed() ? win : null,
    buildSuccessOptions(toolId),
  );
}

module.exports = {
  TOOL_LABELS,
  showConnectConfirm,
  showConnectSuccess,
};
