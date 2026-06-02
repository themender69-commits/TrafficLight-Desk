const fs = require('fs');
const path = require('path');
const os = require('os');

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function tryRealpath(dir) {
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
}

function dirExists(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function buildCandidate(envVar, ...defaults) {
  const candidates = [];
  if (process.env[envVar]) {
    candidates.push(process.env[envVar]);
  }
  candidates.push(...defaults);
  return [...new Set(candidates.map((p) => path.resolve(p)))];
}

function detectConfigDir(envVar, defaultSubdir) {
  const home = getHomeDir();
  const candidates = buildCandidate(envVar, path.join(home, defaultSubdir));

  for (const candidate of candidates) {
    const resolved = tryRealpath(candidate);
    if (dirExists(resolved)) {
      return {
        found: true,
        configDir: resolved,
        source: process.env[envVar] && candidate.startsWith(process.env[envVar])
          ? envVar
          : 'default',
      };
    }
  }

  return {
    found: false,
    configDir: path.join(home, defaultSubdir),
    source: 'missing',
    hint: `未找到配置目录。若使用 ${envVar}，请确认环境变量；否则请先启动一次对应应用。`,
  };
}

function detectCursor() {
  const home = getHomeDir();
  const defaultDir = path.join(home, '.cursor');
  const loadDir = dirExists(defaultDir) ? tryRealpath(defaultDir) : null;
  const envDir = process.env.CURSOR_CONFIG_DIR
    ? tryRealpath(process.env.CURSOR_CONFIG_DIR)
    : null;

  const configDir = loadDir || (envDir && dirExists(envDir) ? envDir : null);

  if (!configDir) {
    return {
      found: false,
      tool: 'cursor',
      configDir: defaultDir,
      source: 'missing',
      hooksFile: path.join(defaultDir, 'hooks.json'),
      hooksDir: path.join(defaultDir, 'hooks', 'trafficlight-desk'),
      supportsHooks: true,
      hint: '未找到 ~/.cursor 目录。请先启动一次 Cursor，或设置 CURSOR_CONFIG_DIR。',
    };
  }

  return {
    found: true,
    tool: 'cursor',
    configDir,
    source: loadDir ? 'default' : 'CURSOR_CONFIG_DIR',
    hooksFile: path.join(configDir, 'hooks.json'),
    hooksDir: path.join(configDir, 'hooks', 'trafficlight-desk'),
    hooksFileExists: fileExists(path.join(configDir, 'hooks.json')),
    supportsHooks: true,
    installHint: `将合并 ${path.join(configDir, 'hooks.json')}，并复制脚本到 hooks/trafficlight-desk/`,
    note:
      loadDir && envDir && loadDir !== envDir
        ? `检测到 CURSOR_CONFIG_DIR=${envDir}，Cursor IDE 实际加载 ${loadDir}。`
        : undefined,
  };
}

function detectCodex() {
  const cursor = detectCursor();
  return {
    ...cursor,
    tool: 'codex',
    label: 'Codex（经 Cursor Hooks）',
    note: 'Codex 在 Cursor 内运行时，复用 Cursor 的 Hook 接入。',
    requiresCursor: true,
  };
}

function detectClaude() {
  const home = getHomeDir();
  const defaultDir = path.join(home, '.claude');
  const loadDir = dirExists(defaultDir) ? tryRealpath(defaultDir) : null;
  const envDir = process.env.CLAUDE_CONFIG_DIR
    ? tryRealpath(process.env.CLAUDE_CONFIG_DIR)
    : null;
  const configDir = loadDir || (envDir && dirExists(envDir) ? envDir : null);

  if (!configDir) {
    return {
      found: false,
      tool: 'claude',
      configDir: defaultDir,
      source: 'missing',
      settingsFile: path.join(defaultDir, 'settings.json'),
      hooksDir: path.join(defaultDir, 'hooks', 'trafficlight-desk'),
      supportsHooks: true,
      hint: '未找到 ~/.claude 目录。请先启动一次 Claude Code，或设置 CLAUDE_CONFIG_DIR。',
    };
  }

  return {
    found: true,
    tool: 'claude',
    configDir,
    source: loadDir ? 'default' : 'CLAUDE_CONFIG_DIR',
    settingsFile: path.join(configDir, 'settings.json'),
    hooksDir: path.join(configDir, 'hooks', 'trafficlight-desk'),
    settingsFileExists: fileExists(path.join(configDir, 'settings.json')),
    supportsHooks: true,
    installHint: `将合并 ${path.join(configDir, 'settings.json')}，并复制脚本到 hooks/trafficlight-desk/`,
  };
}

function detectTrae() {
  const home = getHomeDir();
  const env = process.env.TRAE_ENV === 'cn' ? '.trae-cn' : '.trae';
  const base = detectConfigDir('TRAE_CONFIG_DIR', env);
  const altEnv = env === '.trae' ? '.trae-cn' : '.trae';
  const altPath = path.join(home, altEnv);
  const altFound = dirExists(tryRealpath(altPath));

  return {
    ...base,
    tool: 'trae',
    altConfigDir: altFound ? tryRealpath(altPath) : null,
    supportsHooks: false,
    unsupportedReason:
      'Trae 目前没有类似 Cursor 的官方 Agent Hook，暂无法自动监控状态。',
  };
}

function detectTool(toolId) {
  switch (toolId) {
    case 'cursor':
      return detectCursor();
    case 'codex':
      return detectCodex();
    case 'claude':
      return detectClaude();
    case 'trae':
      return detectTrae();
    default:
      return { found: false, tool: toolId, supportsHooks: false };
  }
}

function detectAllTools() {
  return ['cursor', 'codex', 'claude', 'trae'].map((id) => detectTool(id));
}

module.exports = {
  getHomeDir,
  detectTool,
  detectAllTools,
  detectCursor,
  detectCodex,
  detectClaude,
  detectTrae,
};
