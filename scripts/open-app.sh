#!/bin/bash
# 启动并强制显示 TrafficLight Desk 窗口（macOS）
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

"$APP_DIR/scripts/stop.sh" 2>/dev/null || true
sleep 0.3

npm run build >/dev/null

echo "→ 启动 TrafficLight Desk…"
nohup env -u ELECTRON_RUN_AS_NODE npm start >> "$HOME/.trafficlight-desk/app.log" 2>&1 &
echo $! > "$HOME/.trafficlight-desk/app.pid"

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:9876/status" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

curl -sf -X POST "http://127.0.0.1:9876/app/show" >/dev/null 2>&1 || true

if command -v osascript >/dev/null 2>&1; then
  osascript -e 'tell application "TrafficLight Desk" to activate' 2>/dev/null || true
  osascript -e 'tell application "Electron" to activate' 2>/dev/null || true
fi

echo "→ 窗口应已出现在屏幕右上角；Dock 里也有图标"
echo "→ 若仍看不到，点菜单栏右侧 🚦 托盘图标"
