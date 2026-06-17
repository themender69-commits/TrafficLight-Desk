const http = require('http');
const { URL } = require('url');
const { detectAllTools, detectTool } = require('./path-resolver.cjs');
const {
  installToolHooks,
  uninstallTool,
  readConnection,
  uninstallPreviousTool,
} = require('./hook-installer.cjs');
const {
  buildConnectionStatus,
  clearHookActivity,
  recordHookActivity,
} = require('./monitor-health.cjs');

const TOOL_LABELS = {
  cursor: 'Cursor',
  codex: 'Codex',
  claude: 'Claude Code',
};

const SUPPORTED_TOOLS = new Set(Object.keys(TOOL_LABELS));

function normalizeTool(tool) {
  return SUPPORTED_TOOLS.has(tool) ? tool : 'cursor';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function createHttpServer({
  stateDir,
  readState,
  writeState,
  stateMachine,
  sseHub,
  traceLog,
  versionStatus,
  onRestart,
  onQuit,
  setMenuOpen,
  showConnectConfirm,
  showMainWindow,
}) {
  const port = Number(process.env.TRAFFICLIGHT_PORT || 9876);

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/events' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('\n');
        if (sseHub) {
          sseHub.addClient(res);
          const state = readState();
          res.write(`event: status\ndata: ${JSON.stringify(state)}\n\n`);
        }
        return;
      }

      if (pathname === '/status' && req.method === 'GET') {
        const state = readState();
        const connection = readConnection(stateDir);
        const health = buildConnectionStatus(connection, stateDir);
        const versions = versionStatus ? versionStatus(stateDir) : undefined;
        jsonResponse(res, 200, {
          ...state,
          tool: normalizeTool(connection?.tool || state.tool),
          ...health,
          versions,
        });
        return;
      }

      if (pathname === '/status' && req.method === 'POST') {
        const body = await readBody(req);
        const payload = JSON.parse(body);
        recordHookActivity(stateDir);
        const next = stateMachine
          ? stateMachine.applyExternalState(payload)
          : writeState(payload);
        jsonResponse(res, 200, next);
        return;
      }

      if (pathname === '/hook-event' && req.method === 'POST') {
        const body = await readBody(req);
        const payload = JSON.parse(body || '{}');
        if (!stateMachine) {
          jsonResponse(res, 503, { ok: false, error: 'state machine unavailable' });
          return;
        }
        const next = stateMachine.handleHookEvent(payload);
        jsonResponse(res, 200, { ok: true, ...next });
        return;
      }

      if (pathname === '/state/reset' && req.method === 'POST') {
        if (stateMachine) {
          stateMachine.reset('api-reset');
        }
        const next = writeState({ status: 'idle' });
        if (sseHub) {
          sseHub.broadcast('status', next);
        }
        jsonResponse(res, 200, next);
        return;
      }

      if (pathname === '/diagnostics/trace' && req.method === 'GET') {
        jsonResponse(res, 200, {
          entries: traceLog ? traceLog.list() : [],
          snapshot: stateMachine ? stateMachine.getSnapshot() : null,
        });
        return;
      }

      if (pathname === '/diagnostics/versions' && req.method === 'GET') {
        jsonResponse(res, 200, versionStatus ? versionStatus(stateDir) : {});
        return;
      }

      if (pathname === '/connection' && req.method === 'GET') {
        const connection = readConnection(stateDir);
        jsonResponse(res, 200, {
          ...buildConnectionStatus(connection, stateDir),
          connection,
        });
        return;
      }

      if (pathname === '/tools' && req.method === 'GET') {
        const connection = readConnection(stateDir);
        const health = buildConnectionStatus(connection, stateDir);
        const tools = detectAllTools().map((item) => ({
          id: item.tool,
          label: TOOL_LABELS[item.tool] || item.tool,
          found: item.found,
          supportsHooks: item.supportsHooks,
          connected: connection?.tool === item.tool,
          monitoring: connection?.tool === item.tool && health.monitoring,
          configDir: item.found ? item.configDir : undefined,
          installHint: item.installHint,
          note: item.note,
          unsupportedReason: item.unsupportedReason,
          hint: item.hint,
        }));
        jsonResponse(res, 200, { tools, activeTool: connection?.tool || null });
        return;
      }

      const detectMatch = pathname.match(/^\/tools\/([a-z]+)\/detect$/);
      if (detectMatch && req.method === 'GET') {
        const toolId = detectMatch[1];
        const detection = detectTool(toolId);
        jsonResponse(res, 200, {
          id: toolId,
          label: TOOL_LABELS[toolId] || toolId,
          ...detection,
        });
        return;
      }

      const connectConfirmMatch = pathname.match(/^\/tools\/([a-z]+)\/connect\/confirm$/);
      if (connectConfirmMatch && req.method === 'POST') {
        const toolId = connectConfirmMatch[1];
        const detection = detectTool(toolId);
        if (!detection.supportsHooks) {
          jsonResponse(res, 400, {
            confirmed: false,
            error: detection.unsupportedReason || '该工具暂不支持',
          });
          return;
        }
        if (!detection.found) {
          jsonResponse(res, 400, {
            confirmed: false,
            error: detection.hint || '未找到配置目录',
          });
          return;
        }
        if (typeof showConnectConfirm !== 'function') {
          jsonResponse(res, 500, { confirmed: false, error: 'dialog unavailable' });
          return;
        }
        const current = readConnection(stateDir);
        const confirmed = await showConnectConfirm(detection, current?.tool || null);
        jsonResponse(res, 200, { confirmed });
        return;
      }

      const connectMatch = pathname.match(/^\/tools\/([a-z]+)\/connect$/);
      if (connectMatch && req.method === 'POST') {
        const toolId = connectMatch[1];
        const current = readConnection(stateDir);
        const previousTool =
          current && current.tool !== toolId ? current.tool : null;
        const result = installToolHooks(stateDir, toolId);
        if (previousTool) {
          uninstallPreviousTool(stateDir, previousTool, result.manifest);
        }
        clearHookActivity(stateDir);
        if (stateMachine) {
          stateMachine.reset('connect');
        }
        writeState({ tool: toolId, status: 'idle' });
        jsonResponse(res, 200, {
          ok: true,
          connection: result.connection,
          detection: {
            configDir: result.detection.configDir,
            installHint: result.detection.installHint,
          },
        });
        return;
      }

      if (pathname === '/connection' && req.method === 'DELETE') {
        const current = readConnection(stateDir);
        if (current) {
          uninstallTool(stateDir, current.tool);
        }
        clearHookActivity(stateDir);
        if (stateMachine) {
          stateMachine.reset('disconnect');
        }
        writeState({ status: 'idle' });
        jsonResponse(res, 200, { ok: true, disconnected: true });
        return;
      }

      if (pathname === '/app/show' && req.method === 'POST') {
        const ok = typeof showMainWindow === 'function' ? showMainWindow() : false;
        jsonResponse(res, 200, { ok });
        return;
      }

      if (pathname === '/app/window-layout' && req.method === 'POST') {
        const body = await readBody(req);
        const payload = JSON.parse(body || '{}');
        if (typeof setMenuOpen === 'function') {
          setMenuOpen(Boolean(payload.menuOpen));
        }
        jsonResponse(res, 200, { ok: true, menuOpen: Boolean(payload.menuOpen) });
        return;
      }

      if (pathname === '/app/restart' && req.method === 'POST') {
        jsonResponse(res, 200, { ok: true });
        if (typeof onRestart === 'function') {
          setImmediate(onRestart);
        }
        return;
      }

      if (pathname === '/app/quit' && req.method === 'POST') {
        jsonResponse(res, 200, { ok: true });
        if (typeof onQuit === 'function') {
          setImmediate(onQuit);
        }
        return;
      }

      jsonResponse(res, 404, { error: 'not found' });
    } catch (error) {
      jsonResponse(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`TrafficLight status server on http://127.0.0.1:${port}`);
  });

  return server;
}

module.exports = {
  createHttpServer,
};
