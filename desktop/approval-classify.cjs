/** Port of agent-hooks/tl-approval-lib.py — single source for wait/skip/schedule */
const WAIT_TOOLS = new Set([
  'AskQuestion',
  'AskUserQuestion',
  'SwitchMode',
  'ExitPlanMode',
  'Task',
  'GenerateImage',
]);

const SAFE_SHELL = [
  /^(ls|pwd|echo|cat|head|tail|wc|which|command\s+-v|test\s+)/,
  /^git\s+(status|diff|log|show|rev-parse|branch)/,
  /^(swift\s+build|swift\s+test|swift\s+run)/,
  /^(find|rg|grep)\s+/,
  /^(chmod|cp|mv|mkdir|touch)\s+/,
  /^pgrep\s+/,
  /^open\s+"/,
  /^cd\s+/,
];

function autoRunShellSegment(cmd) {
  const trimmed = (cmd || '').trim();
  if (!trimmed) {
    return true;
  }
  return SAFE_SHELL.some((re) => re.test(trimmed));
}

function autoRunShell(cmd) {
  const trimmed = (cmd || '').trim();
  if (!trimmed) {
    return true;
  }
  const parts = trimmed.split(/\s*&&\s*|\s*;\s*/);
  if (parts.length === 1) {
    return autoRunShellSegment(trimmed);
  }
  return parts.every((p) => !p.trim() || autoRunShellSegment(p));
}

function shellCommand(payload) {
  if (payload.command) {
    return payload.command;
  }
  const toolInput = payload.tool_input || {};
  return toolInput.command || '';
}

/** @returns {'skip' | 'immediate' | 'schedule'} */
function classify(payload) {
  const event = payload.hook_event_name || '';

  if (event === 'beforeShellExecution') {
    return autoRunShell(shellCommand(payload)) ? 'skip' : 'schedule';
  }
  if (event === 'beforeMCPExecution') {
    return 'schedule';
  }
  if (event === 'subagentStart') {
    return 'immediate';
  }
  if (event === 'Notification') {
    const t = payload.notification_type;
    if (t === 'permission_prompt' || t === 'elicitation_dialog') {
      return 'immediate';
    }
    return 'skip';
  }
  if (event === 'PermissionRequest') {
    return 'immediate';
  }

  const eventLower = event.toLowerCase();
  if (eventLower === 'pretooluse' || event === 'preToolUse') {
    const tool = (payload.tool_name || '').trim();
    if (WAIT_TOOLS.has(tool)) {
      return 'immediate';
    }
    if (tool === 'Shell') {
      return autoRunShell(shellCommand(payload)) ? 'skip' : 'schedule';
    }
    if (tool.startsWith('MCP:')) {
      return 'schedule';
    }
  }

  return 'skip';
}

module.exports = {
  classify,
  autoRunShell,
};
