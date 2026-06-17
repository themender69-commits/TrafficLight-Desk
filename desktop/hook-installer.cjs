const fs = require('fs');
const path = require('path');
const { detectTool } = require('./path-resolver.cjs');
const { getHooksSourceDir } = require('./paths.cjs');
const { readHooksVersion } = require('./version-info.cjs');

const MARKER = 'trafficlight-desk';

const CURSOR_HOOK_ENTRIES = {
  beforeSubmitPrompt: ['tl-on-prompt.sh'],
  postToolUse: ['tl-on-tool.sh'],
  preToolUse: [{ script: 'tl-on-wait.sh', matcher: 'AskQuestion|AskUserQuestion|SwitchMode|ExitPlanMode|Task|GenerateImage|Shell|MCP:' }],
  beforeShellExecution: ['tl-on-wait.sh'],
  beforeMCPExecution: ['tl-on-wait.sh'],
  postToolUseFailure: ['tl-on-tool-failure.sh'],
  subagentStart: ['tl-on-wait.sh'],
  stop: ['tl-on-stop.sh'],
  sessionEnd: ['tl-on-session-end.sh'],
};

const CLAUDE_HOOK_ENTRIES = {
  UserPromptSubmit: ['tl-on-prompt.sh'],
  PostToolUse: ['tl-on-tool.sh'],
  PreToolUse: [
    {
      script: 'tl-on-wait.sh',
      matcher: 'AskQuestion|AskUserQuestion|SwitchMode|ExitPlanMode',
    },
  ],
  Notification: [
    { script: 'tl-on-wait.sh', matcher: 'permission_prompt|elicitation_dialog' },
  ],
  PermissionRequest: ['tl-on-wait.sh'],
  Stop: ['tl-on-stop.sh'],
  SessionEnd: ['tl-on-session-end.sh'],
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyHookScripts(targetDir) {
  ensureDir(targetDir);
  const hooksSource = getHooksSourceDir();
  if (!fs.existsSync(hooksSource)) {
    throw new Error(`未找到 Hook 脚本目录：${hooksSource}`);
  }
  const scripts = fs
    .readdirSync(hooksSource)
    .filter(
      (name) =>
        name.endsWith('.sh') ||
        name.endsWith('.py') ||
        name.endsWith('.ps1') ||
        name === 'VERSION' ||
        name === 'approval-catalog.json',
    );
  const installed = [];

  for (const name of scripts) {
    const src = path.join(hooksSource, name);
    const dest = path.join(targetDir, name);
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);
    installed.push(dest);
  }

  return installed;
}

function hookCommand(configDir, scriptName) {
  return `./hooks/${MARKER}/${scriptName}`;
}

function hookCommandAbsolute(hooksDir, scriptName) {
  return path.join(hooksDir, scriptName);
}

/** Windows 上 Hook 脚本需经 bash 执行（Git Bash / Cursor 内置） */
function hookCommandResolved(hooksDir, configDir, scriptName) {
  if (process.platform === 'win32') {
    const posix = hookCommandAbsolute(hooksDir, scriptName).replace(/\\/g, '/');
    return `bash "${posix}"`;
  }
  return hookCommand(configDir, scriptName);
}

function hookCommandResolvedAbsolute(hooksDir, scriptName) {
  if (process.platform === 'win32') {
    const posix = hookCommandAbsolute(hooksDir, scriptName).replace(/\\/g, '/');
    return `bash "${posix}"`;
  }
  return hookCommandAbsolute(hooksDir, scriptName);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function mergeCursorHooks(hooksFile, hooksDir, configDir) {
  const data = readJson(hooksFile, { version: 1, hooks: {} });
  data.hooks = data.hooks || {};
  const added = {};

  for (const [event, items] of Object.entries(CURSOR_HOOK_ENTRIES)) {
    const existing = Array.isArray(data.hooks[event]) ? data.hooks[event] : [];
    const filtered = existing.filter(
      (entry) => !String(entry.command || '').includes(MARKER),
    );

    const newEntries = items.map((item) => {
      if (typeof item === 'string') {
        return { command: hookCommandResolved(hooksDir, configDir, item) };
      }
      return {
        command: hookCommandResolved(hooksDir, configDir, item.script),
        matcher: item.matcher,
      };
    });

    data.hooks[event] = [...filtered, ...newEntries];
    added[event] = newEntries;
  }

  writeJson(hooksFile, data);
  return added;
}

function mergeClaudeHooks(settingsFile, hooksDir) {
  const data = readJson(settingsFile, { hooks: {} });
  data.hooks = data.hooks || {};
  const added = {};

  for (const [event, items] of Object.entries(CLAUDE_HOOK_ENTRIES)) {
    const existing = Array.isArray(data.hooks[event]) ? data.hooks[event] : [];
    const filtered = existing.filter((group) => {
      const inner = group.hooks || [];
      return !inner.some((hook) => String(hook.command || '').includes(MARKER));
    });

    const newGroups = items.map((item) => {
      const script = typeof item === 'string' ? item : item.script;
      const group = {
        hooks: [
          {
            command: hookCommandResolvedAbsolute(hooksDir, script),
            type: 'command',
          },
        ],
      };
      if (typeof item !== 'string' && item.matcher) {
        group.matcher = item.matcher;
      }
      return group;
    });

    data.hooks[event] = [...filtered, ...newGroups];
    added[event] = newGroups;
  }

  writeJson(settingsFile, data);
  return added;
}

function removeCursorHooks(hooksFile) {
  if (!fs.existsSync(hooksFile)) {
    return;
  }
  const data = readJson(hooksFile, null);
  if (!data?.hooks) {
    return;
  }

  for (const event of Object.keys(data.hooks)) {
    data.hooks[event] = (data.hooks[event] || []).filter(
      (entry) => !String(entry.command || '').includes(MARKER),
    );
    if (data.hooks[event].length === 0) {
      delete data.hooks[event];
    }
  }

  writeJson(hooksFile, data);
}

function removeClaudeHooks(settingsFile) {
  if (!fs.existsSync(settingsFile)) {
    return;
  }
  const data = readJson(settingsFile, null);
  if (!data?.hooks) {
    return;
  }

  for (const event of Object.keys(data.hooks)) {
    data.hooks[event] = (data.hooks[event] || []).filter((group) => {
      const inner = group.hooks || [];
      return !inner.some((hook) => String(hook.command || '').includes(MARKER));
    });
    if (data.hooks[event].length === 0) {
      delete data.hooks[event];
    }
  }

  writeJson(settingsFile, data);
}

function getManifestPath(stateDir, tool) {
  return path.join(stateDir, 'manifests', `${tool}.json`);
}

function installForAdapter(stateDir, adapterId, activeTool) {
  const detection = detectTool(adapterId);

  if (!detection.found) {
    throw new Error(detection.hint || `未找到 ${adapterId} 配置目录`);
  }

  const installedFiles = copyHookScripts(detection.hooksDir);
  let hookEntries;

  if (adapterId === 'claude') {
    if (!fs.existsSync(detection.settingsFile)) {
      writeJson(detection.settingsFile, { hooks: {} });
    }
    hookEntries = mergeClaudeHooks(detection.settingsFile, detection.hooksDir);
  } else {
    if (!fs.existsSync(detection.hooksFile)) {
      writeJson(detection.hooksFile, { version: 1, hooks: {} });
    }
    hookEntries = mergeCursorHooks(
      detection.hooksFile,
      detection.hooksDir,
      detection.configDir,
    );
  }

  const manifest = {
    tool: activeTool,
    adapter: adapterId,
    configDir: detection.configDir,
    hooksDir: detection.hooksDir,
    hooksFile: detection.hooksFile || detection.settingsFile,
    installedFiles,
    hookEntries,
    hooksVersion: readHooksVersion(),
    installedAt: Date.now(),
  };

  ensureDir(path.join(stateDir, 'manifests'));
  writeJson(getManifestPath(stateDir, activeTool), manifest);

  const connection = {
    tool: activeTool,
    adapter: adapterId,
    configDir: detection.configDir,
    hooksFile: manifest.hooksFile,
    hooksVersion: manifest.hooksVersion,
    connectedAt: Date.now(),
  };
  writeJson(path.join(stateDir, 'connection.json'), connection);

  return { detection, manifest, connection };
}

function installToolHooks(stateDir, toolId) {
  const detection = detectTool(toolId);

  if (!detection.supportsHooks) {
    throw new Error(detection.unsupportedReason || '该工具暂不支持 Hook 监控');
  }

  if (toolId === 'codex') {
    if (!detection.found) {
      throw new Error('未找到 Cursor 配置目录，无法监控 Codex');
    }
    return installForAdapter(stateDir, 'cursor', 'codex');
  }

  return installForAdapter(stateDir, toolId, toolId);
}

function uninstallTool(stateDir, toolId) {
  const manifestFile = getManifestPath(stateDir, toolId);
  if (!fs.existsSync(manifestFile)) {
    return { removed: false };
  }

  const manifest = readJson(manifestFile, null);
  if (!manifest) {
    return { removed: false };
  }

  if (manifest.adapter === 'claude') {
    removeClaudeHooks(manifest.hooksFile);
  } else {
    removeCursorHooks(manifest.hooksFile);
  }

  for (const file of manifest.installedFiles || []) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }

  try {
    fs.unlinkSync(manifestFile);
  } catch {
    /* ignore */
  }

  const connection = readJson(path.join(stateDir, 'connection.json'), null);
  if (connection?.tool === toolId) {
    fs.unlinkSync(path.join(stateDir, 'connection.json'));
  }

  return { removed: true, manifest };
}

function readConnection(stateDir) {
  return readJson(path.join(stateDir, 'connection.json'), null);
}

function removeManifestOnly(stateDir, toolId) {
  const manifestFile = getManifestPath(stateDir, toolId);
  try {
    if (fs.existsSync(manifestFile)) {
      fs.unlinkSync(manifestFile);
    }
  } catch {
    /* ignore */
  }
}

/** 切换工具：Codex/Cursor 共用 hooks.json 时只删 manifest，不卸 Hook */
function uninstallPreviousTool(stateDir, previousTool, newManifest) {
  const prevManifest = readJson(getManifestPath(stateDir, previousTool), null);
  if (!prevManifest) {
    return;
  }
  const sameHooksFile =
    prevManifest.hooksFile &&
    newManifest?.hooksFile &&
    prevManifest.hooksFile === newManifest.hooksFile;
  if (sameHooksFile) {
    removeManifestOnly(stateDir, previousTool);
    return;
  }
  uninstallTool(stateDir, previousTool);
}

module.exports = {
  installToolHooks,
  uninstallTool,
  readConnection,
  uninstallPreviousTool,
};
