const fs = require('fs');
const path = require('path');

/** Hook 回调在此时间内视为监控活跃 */
const ALIVE_THRESHOLD_MS = 5 * 60 * 1000;
/** 新连接宽限：尚未收到 Hook 时也短暂显示为监控中 */
const CONNECT_GRACE_MS = 2 * 60 * 1000;

function lastHookFile(stateDir) {
  return path.join(stateDir, 'last-hook.json');
}

function readLastHookAt(stateDir) {
  try {
    const data = JSON.parse(fs.readFileSync(lastHookFile(stateDir), 'utf8'));
    return typeof data.lastHookAt === 'number' ? data.lastHookAt : null;
  } catch {
    return null;
  }
}

function recordHookActivity(stateDir) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    lastHookFile(stateDir),
    `${JSON.stringify({ lastHookAt: Date.now() }, null, 2)}\n`,
  );
}

function clearHookActivity(stateDir) {
  try {
    fs.unlinkSync(lastHookFile(stateDir));
  } catch {
    /* ignore */
  }
}

function isMonitoringAlive(connection, stateDir, now = Date.now()) {
  if (!connection) {
    return false;
  }

  const lastHookAt = readLastHookAt(stateDir);
  const connectedAt = connection.connectedAt || 0;

  if (lastHookAt != null && now - lastHookAt < ALIVE_THRESHOLD_MS) {
    return true;
  }

  if (lastHookAt == null && connectedAt && now - connectedAt < CONNECT_GRACE_MS) {
    return true;
  }

  return false;
}

function buildConnectionStatus(connection, stateDir, now = Date.now()) {
  const connected = Boolean(connection);
  return {
    connected,
    monitoring: isMonitoringAlive(connection, stateDir, now),
    lastHookAt: readLastHookAt(stateDir),
  };
}

module.exports = {
  ALIVE_THRESHOLD_MS,
  CONNECT_GRACE_MS,
  readLastHookAt,
  recordHookActivity,
  clearHookActivity,
  isMonitoringAlive,
  buildConnectionStatus,
};
