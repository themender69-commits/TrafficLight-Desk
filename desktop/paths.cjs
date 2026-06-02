const path = require('path');

function getHooksSourceDir() {
  try {
    const { app } = require('electron');
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'cursor-hooks');
    }
  } catch {
    /* not in electron main */
  }
  return path.join(__dirname, '..', 'cursor-hooks');
}

module.exports = { getHooksSourceDir };
