#!/bin/bash
# 启动 TrafficLight Desk（生产模式：构建 + Electron）
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

if lsof -i :9876 >/dev/null 2>&1; then
  echo "→ 端口 9876 已被占用，先执行 stop.sh"
  "$APP_DIR/scripts/stop.sh"
  sleep 0.5
fi

if [[ ! -d node_modules/electron ]]; then
  echo "→ 首次运行，安装依赖…"
  npm install
fi

echo "→ 构建 UI…"
npm run build

echo "→ 启动 TrafficLight Desk…"
# Cursor/CI 环境可能设了 ELECTRON_RUN_AS_NODE，必须 unset
nohup env -u ELECTRON_RUN_AS_NODE npm start > "$HOME/.trafficlight-desk/app.log" 2>&1 &
echo $! > "$HOME/.trafficlight-desk/app.pid"

sleep 1
if lsof -i :9876 >/dev/null 2>&1; then
  echo "→ 已启动（日志: ~/.trafficlight-desk/app.log）"
else
  echo "→ 启动可能失败，请查看 ~/.trafficlight-desk/app.log"
  exit 1
fi
