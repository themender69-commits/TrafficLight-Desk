#!/bin/bash
# 停止 TrafficLight Desk（红绿灯悬浮窗 + 9876 端口）
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KILLED=0

kill_if_running() {
  local pattern="$1"
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    pkill -f "$pattern" 2>/dev/null || true
    KILLED=1
  fi
}

kill_if_running "$APP_DIR/node_modules/.bin/electron"
kill_if_running "$APP_DIR/node_modules/electron/dist/Electron.app"
kill_if_running "trafficlight-desk"

sleep 0.5

if lsof -i :9876 >/dev/null 2>&1; then
  lsof -ti :9876 | xargs kill -9 2>/dev/null || true
  KILLED=1
fi

if [[ "$KILLED" -eq 1 ]]; then
  echo "→ TrafficLight Desk 已停止"
else
  echo "→ 未发现运行中的 TrafficLight Desk"
fi
