#!/bin/bash
# postToolUse：仍在执行 → 黄灯；若已是绿灯则说明上一轮已结束，忽略迟到的 hook
set -euo pipefail
input=$(cat)
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

current="$(tl_read_status)"

# 任务已结束（绿灯）：除非用户发了新 prompt，否则不应再变回黄灯
[[ "$current" == "done" ]] && exit 0

# 正在等 Run/Allow 批准：只有 Shell/MCP 真正跑完才回到黄灯
if [[ -f "$TL_PENDING_APPROVAL_FILE" ]]; then
  verdict="$(printf '%s' "$input" | python3 -c "
import json, sys
d = json.load(sys.stdin)
tool = (d.get('tool_name') or '').strip()
if tool != 'Shell' and not tool.startswith('MCP:'):
    print('ignore')
    raise SystemExit
duration = float(d.get('duration') or 0)
output = ''
raw = d.get('tool_output') or ''
if isinstance(raw, str) and raw:
    try:
        output = (json.loads(raw).get('output') or '')
    except Exception:
        output = raw
# Allowlist Run 框：用户未点 Run 时 Cursor 会发 duration≈0 且无输出的 stub
if duration < 20 and not str(output).strip():
    print('waiting')
else:
    print('approved')
")"
  case "$verdict" in
    ignore) exit 0 ;;
    waiting)
      tl_set_status waiting
      exit 0
      ;;
    approved)
      tl_mark_active
      tl_clear_pending_approval
      tl_set_status working
      exit 0
      ;;
  esac
fi

# 用户已点 Run / 批准，命令执行完 → 从红灯回到黄灯
tl_mark_active
tl_clear_pending_approval
tl_set_status working
exit 0
