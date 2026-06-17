#!/usr/bin/env node
/** 跨平台状态机自测（Mac/Win 通用，需 App 在 9876 运行） */
const http = require('http');

const API = `http://127.0.0.1:${process.env.TRAFFICLIGHT_PORT || 9876}`;
let pass = 0;
let fail = 0;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      url,
      { method, headers: body ? { 'Content-Type': 'application/json' } : {} },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw || '{}'));
          } catch {
            resolve({ raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function reset() {
  await request('POST', '/state/reset');
  await sleep(120);
}

async function status() {
  const s = await request('GET', '/status');
  return s.status;
}

async function hook(payload) {
  await request('POST', '/hook-event', payload);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function assert(label, want) {
  const got = await status();
  if (got === want) {
    console.log(`  ✓ ${label} → ${got}`);
    pass += 1;
  } else {
    console.log(`  ✗ ${label} → 期望 ${want}，实际 ${got}`);
    fail += 1;
  }
}

async function main() {
  console.log('=== TrafficLight 状态机自测 (Node) ===\n');
  try {
    await request('GET', '/status');
  } catch {
    console.error('App 未运行，请先启动 TrafficLight Desk');
    process.exit(1);
  }

  await reset();
  await hook({ hook_event_name: 'beforeSubmitPrompt' });
  await assert('prompt → working', 'working');

  await reset();
  await hook({ hook_event_name: 'beforeSubmitPrompt' });
  await hook({ hook_event_name: 'preToolUse', tool_name: 'AskQuestion' });
  await assert('AskQuestion → waiting', 'waiting');

  await reset();
  await hook({ hook_event_name: 'beforeSubmitPrompt' });
  await hook({
    hook_event_name: 'beforeShellExecution',
    command: 'git push origin main',
    sandbox: false,
  });
  await assert('Run 框 schedule → waiting', 'waiting');
  await hook({
    hook_event_name: 'postToolUse',
    tool_name: 'Shell',
    duration: 0.527,
  });
  await assert('stub 保持 waiting', 'waiting');

  await reset();
  await hook({ hook_event_name: 'beforeSubmitPrompt' });
  await hook({ hook_event_name: 'postToolUse', tool_name: 'Read' });
  await hook({ hook_event_name: 'stop', status: 'completed' });
  await sleep(200);
  await assert('stop 防抖 → done', 'done');

  const versions = await request('GET', '/diagnostics/versions');
  if (versions.app === versions.hooksSource) {
    console.log(`  ✓ 版本对齐 app=${versions.app}`);
    pass += 1;
  } else {
    console.log(`  ✗ 版本未对齐 app=${versions.app} hooks=${versions.hooksSource}`);
    fail += 1;
  }

  console.log(`\n通过: ${pass}  失败: ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
