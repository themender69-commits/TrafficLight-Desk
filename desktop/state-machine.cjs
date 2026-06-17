const fs = require('fs');
const path = require('path');
const { classify } = require('./approval-classify.cjs');
const { playApprovalSound, playDoneSound } = require('./approval-sound.cjs');
const { cancelAgentSoundGlass } = require('./agent-sound-cancel.cjs');

const STUB_MS = 1000;
const DONE_DEBOUNCE_COMPLETED_MS = 40;
const DONE_DEBOUNCE_DEFAULT_MS = 80;

function normalizeEventName(payload) {
  return String(payload.hook_event_name || '').toLowerCase();
}

function readConnectionTool(stateDir) {
  try {
    const raw = fs.readFileSync(path.join(stateDir, 'connection.json'), 'utf8');
    return JSON.parse(raw).tool || 'cursor';
  } catch {
    return 'cursor';
  }
}

function postToolVerdict(payload) {
  const tool = (payload.tool_name || '').trim();
  if (tool !== 'Shell' && !tool.startsWith('MCP:')) {
    return 'ignore';
  }
  const duration = Number(payload.duration) || 0;
  let output = '';
  const raw = payload.tool_output || '';
  if (typeof raw === 'string' && raw) {
    try {
      output = JSON.parse(raw).output || '';
    } catch {
      output = raw;
    }
  }
  if (duration < STUB_MS && !String(output).trim()) {
    return 'waiting';
  }
  return 'approved';
}

function shouldScheduleDone(payload) {
  if (payload.stop_hook_active === true) {
    return false;
  }
  const status = String(payload.status || '').toLowerCase();
  if (['aborted', 'cancelled', 'error', 'failed'].includes(status)) {
    return false;
  }
  if (status === 'completed') {
    return true;
  }
  const event = normalizeEventName(payload);
  return event === 'stop' || event === 'subagentstop';
}

function doneDebounceMs(payload) {
  const status = String(payload.status || '').toLowerCase();
  return status === 'completed' ? DONE_DEBOUNCE_COMPLETED_MS : DONE_DEBOUNCE_DEFAULT_MS;
}

function createStateMachine({
  stateDir,
  readState,
  writeState,
  broadcast,
  trace,
  recordHookActivity,
}) {
  const pendingFile = path.join(stateDir, 'pending-approval');
  let doneTimer = null;
  let doneGen = 0;

  function clearDoneTimer() {
    if (doneTimer) {
      clearTimeout(doneTimer);
      doneTimer = null;
    }
  }

  function hasPending() {
    return fs.existsSync(pendingFile);
  }

  function setPending() {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(pendingFile, String(Math.floor(Date.now() / 1000)));
  }

  function clearPending() {
    try {
      fs.unlinkSync(pendingFile);
    } catch {
      /* ignore */
    }
  }

  function markActive() {
    doneGen += 1;
    clearDoneTimer();
  }

  function setStatus(status, reason) {
    const prev = readState();
    if (prev.status === status) {
      return prev;
    }
    const tool = readConnectionTool(stateDir);
    const next = writeState({ status, tool });
    trace.push({
      event: 'status',
      from: prev.status,
      to: status,
      detail: reason,
    });

    if (status === 'waiting') {
      cancelAgentSoundGlass();
      playApprovalSound();
    } else if (status === 'done') {
      cancelAgentSoundGlass();
      playDoneSound();
    }

    broadcast('status', next);
    return next;
  }

  function scheduleDone(payload) {
    const gen = ++doneGen;
    const delay = doneDebounceMs(payload);
    clearDoneTimer();
    doneTimer = setTimeout(() => {
      doneTimer = null;
      if (gen !== doneGen) {
        return;
      }
      if (hasPending()) {
        return;
      }
      if (readState().status === 'waiting') {
        return;
      }
      setStatus('done', 'stop-debounce');
    }, delay);
  }

  function reset(reason = 'reset') {
    markActive();
    clearPending();
    clearDoneTimer();
    trace.push({ event: 'reset', detail: reason });
  }

  function handlePrompt() {
    recordHookActivity();
    markActive();
    clearPending();
    setStatus('working', 'prompt');
  }

  function handleWait(payload) {
    recordHookActivity();
    const action = classify(payload);
    if (action === 'skip') {
      trace.push({ event: 'wait-skip', detail: payload.hook_event_name });
      return readState();
    }
    if (action === 'schedule') {
      setPending();
      markActive();
      return setStatus('waiting', 'schedule');
    }
    clearPending();
    markActive();
    return setStatus('waiting', 'immediate');
  }

  function handleToolUse(payload) {
    recordHookActivity();
    const current = readState().status;

    if (current === 'done') {
      trace.push({ event: 'tool-ignore', detail: 'already-done' });
      return readState();
    }

    if (hasPending()) {
      const verdict = postToolVerdict(payload);
      if (verdict === 'ignore') {
        return readState();
      }
      if (verdict === 'waiting') {
        return setStatus('waiting', 'stub-postToolUse');
      }
      markActive();
      clearPending();
      return setStatus('working', 'approved-shell');
    }

    markActive();
    clearPending();
    return setStatus('working', 'postToolUse');
  }

  function handleToolFailure() {
    recordHookActivity();
    if (!hasPending()) {
      return readState();
    }
    clearPending();
    markActive();
    if (readState().status === 'waiting') {
      return setStatus('working', 'tool-failure');
    }
    return readState();
  }

  function handleStop(payload) {
    recordHookActivity();

    if (hasPending()) {
      const current = readState().status;
      if (current === 'working' || current === 'done') {
        return setStatus('waiting', 'stop-with-pending');
      }
      return readState();
    }

    if (!shouldScheduleDone(payload)) {
      trace.push({ event: 'stop-skip', detail: payload.status });
      return readState();
    }

    const current = readState().status;
    if (current === 'waiting') {
      return readState();
    }

    scheduleDone(payload);
    trace.push({ event: 'stop-schedule-done', detail: String(doneDebounceMs(payload)) });
    return readState();
  }

  function handleSessionEnd() {
    recordHookActivity();
    reset('sessionEnd');
    return setStatus('idle', 'sessionEnd');
  }

  function handleHookEvent(payload) {
    const event = normalizeEventName(payload);

    if (event === 'beforesubmitprompt' || event === 'userpromptsubmit') {
      return handlePrompt();
    }
    if (
      event === 'pretooluse' ||
      event === 'beforeshellexecution' ||
      event === 'beforemcpexecution' ||
      event === 'subagentstart' ||
      event === 'notification' ||
      event === 'permissionrequest'
    ) {
      return handleWait(payload);
    }
    if (event === 'posttooluse') {
      return handleToolUse(payload);
    }
    if (event === 'posttoolusefailure') {
      return handleToolFailure();
    }
    if (event === 'stop' || event === 'subagentstop') {
      return handleStop(payload);
    }
    if (event === 'sessionend') {
      return handleSessionEnd();
    }

    trace.push({ event: 'unknown-hook', detail: payload.hook_event_name });
    return readState();
  }

  function applyExternalState(partial) {
    if (partial.status === 'idle') {
      reset('external-idle');
    }
    const next = writeState(partial);
    broadcast('status', next);
    return next;
  }

  return {
    handleHookEvent,
    applyExternalState,
    reset,
    getSnapshot: () => ({
      hasPending: hasPending(),
      doneGen,
      status: readState().status,
    }),
  };
}

module.exports = {
  createStateMachine,
};
