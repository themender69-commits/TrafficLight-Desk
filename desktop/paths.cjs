const path = require('path');

/** 共享 Hook 脚本源码（Cursor / Codex / Claude 安装时均复制此目录） */
function getHooksSourceDir() {
  try {
    const { app } = require('electron');
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'agent-hooks');
    }
  } catch {
    /* not in electron main */
  }
  return path.join(__dirname, '..', 'agent-hooks');
}

module.exports = { getHooksSourceDir };
