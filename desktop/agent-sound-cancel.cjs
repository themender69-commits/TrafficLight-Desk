const fs = require('fs');
const path = require('path');
const os = require('os');

/** Cancel agent-sound delayed Glass to avoid double chime after TrafficLight plays Glass */
function cancelAgentSoundGlass() {
  const dir = path.join(os.homedir(), '.cursor/hooks/agent-sound/state');
  if (!fs.existsSync(dir)) {
    return;
  }
  const genFile = path.join(dir, 'glass-gen');
  const pidFile = path.join(dir, 'glass-waiter.pid');
  try {
    if (fs.existsSync(genFile)) {
      const gen = Number.parseInt(fs.readFileSync(genFile, 'utf8'), 10) || 0;
      fs.writeFileSync(genFile, String(gen + 1));
    }
    if (fs.existsSync(pidFile)) {
      const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf8'), 10);
      if (Number.isFinite(pid)) {
        try {
          process.kill(pid);
        } catch {
          /* already dead */
        }
      }
      fs.unlinkSync(pidFile);
    }
  } catch {
    /* ignore */
  }
}

module.exports = {
  cancelAgentSoundGlass,
};
