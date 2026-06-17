const fs = require('fs');
const path = require('path');
const { playApprovalSound } = require('./approval-sound.cjs');

/** Hook 子进程可能被 Cursor 回收；由 App 兜底 pending → waiting + Tink */
function startPendingApprovalWatcher(stateDir, readState, writeState) {
  const pendingFile = path.join(stateDir, 'pending-approval');
  const delayMs = Number(process.env.TL_UI_WAIT_DELAY_SEC || 0.05) * 1000;
  let timer = null;

  const promoteWaiting = () => {
    if (!fs.existsSync(pendingFile)) {
      return;
    }
    const state = readState();
    if (state.status === 'done' || state.status === 'waiting') {
      return;
    }
    playApprovalSound();
    writeState({ status: 'waiting' });
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!fs.existsSync(pendingFile)) {
      return;
    }

    let createdAt = Date.now();
    try {
      const raw = fs.readFileSync(pendingFile, 'utf8').trim();
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        createdAt = parsed * 1000;
      }
    } catch {
      /* use now */
    }

    const waitMs = Math.max(0, delayMs - (Date.now() - createdAt));
    timer = setTimeout(() => {
      timer = null;
      promoteWaiting();
    }, waitMs);
  };

  try {
    fs.watch(stateDir, (_, filename) => {
      if (filename === 'pending-approval' || filename == null) {
        schedule();
      }
    });
  } catch {
    /* ignore */
  }

  setInterval(schedule, 200);
  schedule();
}

module.exports = {
  startPendingApprovalWatcher,
};
