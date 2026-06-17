const fs = require('fs');
const path = require('path');
const { getHooksSourceDir } = require('./paths.cjs');

function readAppVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    );
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readHooksVersion() {
  for (const base of [getHooksSourceDir(), path.join(__dirname, '..', 'agent-hooks')]) {
    const file = path.join(base, 'VERSION');
    try {
      return fs.readFileSync(file, 'utf8').trim();
    } catch {
      /* try next */
    }
  }
  return readAppVersion();
}

function readInstalledHookVersion(stateDir) {
  try {
    const raw = fs.readFileSync(path.join(stateDir, 'connection.json'), 'utf8');
    const conn = JSON.parse(raw);
    if (conn.hooksVersion) {
      return conn.hooksVersion;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function versionStatus(stateDir) {
  const app = readAppVersion();
  const hooksSource = readHooksVersion();
  const installed = readInstalledHookVersion(stateDir);
  const aligned = installed ? installed === hooksSource && hooksSource === app : null;
  return {
    app,
    hooksSource,
    installed,
    aligned,
  };
}

module.exports = {
  readAppVersion,
  readHooksVersion,
  readInstalledHookVersion,
  versionStatus,
};
