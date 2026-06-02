const http = require('http');
const { URL } = require('url');
const { detectAllTools, detectTool } = require('./path-resolver.cjs');
const {
  installToolHooks,
  uninstallTool,
  readConnection,
} = require('./hook-installer.cjs');

const TOOL_LABELS = {
  cursor: 'Cursor',
  codex: 'Codex',
  claude: 'Claude Code',
  trae: 'Trae',
};

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

function createHttpServer({ stateDir, readState, writeState, onRestart, onQuit, setMenuOpen }) {
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
      if (pathname === '/status' && req.method === 'GET') {
        const state = readState();
        const connection = readConnection(stateDir);
        jsonResponse(res, 200, {
          ...state,
          tool: connection?.tool || state.tool,
          connected: Boolean(connection),
        });
        return;
      }

      if (pathname === '/status' && req.method === 'POST') {
        const body = await readBody(req);
        const payload = JSON.parse(body);
        jsonResponse(res, 200, writeState(payload));
        return;
      }

      if (pathname === '/connection' && req.method === 'GET') {
        const connection = readConnection(stateDir);
        jsonResponse(res, 200, {
          connected: Boolean(connection),
          connection,
        });
        return;
      }

      if (pathname === '/tools' && req.method === 'GET') {
        const connection = readConnection(stateDir);
        const tools = detectAllTools().map((item) => ({
          id: item.tool,
          label: TOOL_LABELS[item.tool] || item.tool,
          found: item.found,
          supportsHooks: item.supportsHooks,
          connected: connection?.tool === item.tool,
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

      const connectMatch = pathname.match(/^\/tools\/([a-z]+)\/connect$/);
      if (connectMatch && req.method === 'POST') {
        const toolId = connectMatch[1];
        const current = readConnection(stateDir);
        if (current && current.tool !== toolId) {
          uninstallTool(stateDir, current.tool);
        }
        const result = installToolHooks(stateDir, toolId);
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
        writeState({ status: 'idle' });
        jsonResponse(res, 200, { ok: true, disconnected: true });
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

module.exports = { createHttpServer, TOOL_LABELS };
