#!/bin/bash
# TrafficLight Desk — Hook 与 App 通信（薄层；逻辑在 desktop/state-machine.cjs）
set -euo pipefail

TL_STATE_DIR="${TL_STATE_DIR:-$HOME/.trafficlight-desk}"
TL_STATE_FILE="$TL_STATE_DIR/state.json"
TL_PORT="${TRAFFICLIGHT_PORT:-9876}"

mkdir -p "$TL_STATE_DIR"

tl_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo python3
  elif command -v python >/dev/null 2>&1; then
    echo python
  else
    echo python3
  fi
}

TL_PYTHON="$(tl_python)"

tl_active_tool() {
  "$TL_PYTHON" -c "
import json, os
path = os.path.join(os.path.expanduser('~'), '.trafficlight-desk', 'connection.json')
try:
    print(json.load(open(path)).get('tool', 'cursor'))
except Exception:
    print('cursor')
" 2>/dev/null || echo "cursor"
}

tl_dispatch_hook() {
  local input="$1"
  TL_HOOK_INPUT="$input" TL_PORT="$TL_PORT" "$TL_PYTHON" <<'PY'
import json, os, time, urllib.request

raw = os.environ.get("TL_HOOK_INPUT", "")
port = os.environ.get("TL_PORT", "9876")
try:
    payload = json.loads(raw) if raw.strip() else {}
except Exception:
    payload = {}

data = json.dumps(payload).encode()
req = urllib.request.Request(
    f"http://127.0.0.1:{port}/hook-event",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=0.35)
except Exception:
    event = (payload.get("hook_event_name") or "").lower()
    status = None
    if event in ("beforesubmitprompt", "userpromptsubmit"):
        status = "working"
    elif event == "sessionend":
        status = "idle"
    if status:
        tool = "cursor"
        conn = os.path.join(os.path.expanduser("~"), ".trafficlight-desk", "connection.json")
        try:
            tool = json.load(open(conn)).get("tool", "cursor")
        except Exception:
            pass
        state_file = os.path.join(os.path.expanduser("~"), ".trafficlight-desk", "state.json")
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(
                {"status": status, "tool": tool, "updatedAt": int(time.time() * 1000)},
                f,
                indent=2,
            )
PY
}

tl_read_status() {
  "$TL_PYTHON" -c "
import json, os
path = os.path.join(os.path.expanduser('~'), '.trafficlight-desk', 'state.json')
try:
    print(json.load(open(path)).get('status', 'idle'))
except Exception:
    print('idle')
" 2>/dev/null || echo "idle"
}
