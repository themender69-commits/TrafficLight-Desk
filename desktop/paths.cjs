const fs = require('fs');
const path = require('path');

/** 共享 Hook 脚本源码（Cursor / Codex / Claude 安装时均复制此目录） */
function getHooksSourceDir() {
  const candidates = [];

  try {
    const { app } = require('electron');
    if (app.isPackaged) {
      candidates.push(path.join(process.resourcesPath, 'agent-hooks'));
      candidates.push(path.join(process.resourcesPath, 'cursor-hooks'));
    } else {
      candidates.push(path.join(app.getAppPath(), 'agent-hooks'));
      candidates.push(path.join(app.getAppPath(), 'cursor-hooks'));
    }
  } catch {
    /* not in electron main */
  }

  candidates.push(path.join(__dirname, '..', 'agent-hooks'));
  candidates.push(path.join(__dirname, '..', 'cursor-hooks'));

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return path.join(__dirname, '..', 'agent-hooks');
}

module.exports = { getHooksSourceDir };
