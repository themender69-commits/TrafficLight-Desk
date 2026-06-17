#!/bin/bash
# 将 TrafficLight hooks 安装到 Cursor（自动探测 ~/.cursor 或 CURSOR_CONFIG_DIR）
set -euo pipefail

HOOKS_SRC="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${HOME:?}"

resolve_cursor_dir() {
  if [[ -d "$HOME_DIR/.cursor" ]]; then
    python3 -c "import os; print(os.path.realpath('$HOME_DIR/.cursor'))"
    return
  fi
  if [[ -n "${CURSOR_CONFIG_DIR:-}" && -d "$CURSOR_CONFIG_DIR" ]]; then
    python3 -c "import os; print(os.path.realpath('$CURSOR_CONFIG_DIR'))"
    return
  fi
  echo "$HOME_DIR/.cursor"
}

CURSOR_DIR="$(resolve_cursor_dir)"
HOOKS_JSON="$CURSOR_DIR/hooks.json"
TL_HOOKS_DIR="$CURSOR_DIR/hooks/trafficlight-desk"

echo "→ 目标 Cursor 配置: $CURSOR_DIR"
mkdir -p "$TL_HOOKS_DIR"
cp "$HOOKS_SRC"/*.sh "$TL_HOOKS_DIR/"
cp "$HOOKS_SRC"/*.py "$TL_HOOKS_DIR/" 2>/dev/null || true
chmod +x "$TL_HOOKS_DIR"/*.sh

if [[ ! -f "$HOOKS_JSON" ]]; then
  cat > "$HOOKS_JSON" <<'EOF'
{
  "version": 1,
  "hooks": {}
}
EOF
fi

export HOOKS_JSON
python3 <<'PY'
import json, os

hooks_json = os.environ["HOOKS_JSON"]
tl_dir = "./hooks/trafficlight-desk"
marker = "trafficlight-desk"

entries = {
    "beforeSubmitPrompt": [{"command": f"{tl_dir}/tl-on-prompt.sh"}],
    "postToolUse": [{"command": f"{tl_dir}/tl-on-tool.sh"}],
    "preToolUse": [
        {"command": f"{tl_dir}/tl-on-wait.sh", "matcher": "AskQuestion|AskUserQuestion|SwitchMode|Task|GenerateImage|Shell|MCP:"}
    ],
    "beforeShellExecution": [{"command": f"{tl_dir}/tl-on-wait.sh"}],
    "beforeMCPExecution": [{"command": f"{tl_dir}/tl-on-wait.sh"}],
    "stop": [{"command": f"{tl_dir}/tl-on-stop.sh"}],
    "sessionEnd": [{"command": f"{tl_dir}/tl-on-session-end.sh"}],
}

with open(hooks_json) as f:
    data = json.load(f)

hooks = data.setdefault("hooks", {})
for event, new_items in entries.items():
    existing = hooks.get(event, [])
    filtered = [
        h for h in existing
        if marker not in h.get("command", "")
    ]
    hooks[event] = filtered + new_items

with open(hooks_json, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"→ 已合并 TrafficLight hooks 到 {hooks_json}")
PY

echo ""
echo "安装完成。请在 App 内选择「Cursor」连接，或确保 TrafficLight Desk 正在运行。"
