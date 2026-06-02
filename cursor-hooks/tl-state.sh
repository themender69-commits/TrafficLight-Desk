#!/bin/bash
# TrafficLight Desk — 状态写入与防抖调度
set -euo pipefail

TL_STATE_DIR="${TL_STATE_DIR:-$HOME/.trafficlight-desk}"
TL_STATE_FILE="$TL_STATE_DIR/state.json"
TL_PORT="${TRAFFICLIGHT_PORT:-9876}"
TL_DONE_GEN_FILE="$TL_STATE_DIR/done-gen"
TL_DONE_WAITER_PID="$TL_STATE_DIR/done-waiter.pid"

mkdir -p "$TL_STATE_DIR"

tl_active_tool() {
  python3 -c "
import json, os
path = os.path.expanduser('~/.trafficlight-desk/connection.json')
try:
    print(json.load(open(path)).get('tool', 'cursor'))
except Exception:
    print('cursor')
" 2>/dev/null || echo "cursor"
}

tl_read_status() {
  python3 -c "
import json, os
path = os.path.expanduser('~/.trafficlight-desk/state.json')
try:
    print(json.load(open(path)).get('status', 'idle'))
except Exception:
    print('idle')
" 2>/dev/null || echo "idle"
}

tl_set_status() {
  local status="$1"
  local tool
  tool="$(tl_active_tool)"

  TL_STATUS="$status" TL_TOOL="$tool" TL_PORT="$TL_PORT" python3 <<'PY'
import json, os, time, urllib.request

status = os.environ["TL_STATUS"]
tool = os.environ.get("TL_TOOL", "cursor")
port = os.environ.get("TL_PORT", "9876")

payload = {"status": status, "tool": tool, "updatedAt": int(time.time() * 1000)}
data = json.dumps(payload).encode()
req = urllib.request.Request(
    f"http://127.0.0.1:{port}/status",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=0.5)
except Exception:
    state_file = os.path.expanduser("~/.trafficlight-desk/state.json")
    os.makedirs(os.path.dirname(state_file), exist_ok=True)
    with open(state_file, "w") as f:
        json.dump(payload, f, indent=2)
PY
}

# Agent 仍在活动 → 取消待亮绿灯，保持黄灯
tl_mark_active() {
  local gen
  gen=$(($(cat "$TL_DONE_GEN_FILE" 2>/dev/null || echo 0) + 1))
  echo "$gen" > "$TL_DONE_GEN_FILE"
  if [[ -f "$TL_DONE_WAITER_PID" ]]; then
    kill "$(cat "$TL_DONE_WAITER_PID")" 2>/dev/null || true
    rm -f "$TL_DONE_WAITER_PID"
  fi
}

# stop 后调度绿灯（防抖）；若期间又有 postToolUse 会被 tl_mark_active 取消
tl_schedule_done() {
  local plugin_dir="$1"
  local gen
  gen=$(($(cat "$TL_DONE_GEN_FILE" 2>/dev/null || echo 0) + 1))
  echo "$gen" > "$TL_DONE_GEN_FILE"

  if [[ -f "$TL_DONE_WAITER_PID" ]]; then
    kill "$(cat "$TL_DONE_WAITER_PID")" 2>/dev/null || true
  fi

  TL_STATE_DIR="$TL_STATE_DIR" \
    TL_DONE_DEBOUNCE_SEC="${TL_DONE_DEBOUNCE_SEC:-2.5}" \
    nohup "$plugin_dir/tl-done-waiter.sh" "$gen" >/dev/null 2>&1 &
  echo $! > "$TL_DONE_WAITER_PID"
}
