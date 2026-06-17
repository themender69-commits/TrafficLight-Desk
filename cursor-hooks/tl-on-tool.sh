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

# 正在等 Run/批准：只有 Shell/MCP 真正跑完才回到黄灯，其它工具回调不能抢状态
if [[ -f "$TL_PENDING_APPROVAL_FILE" ]]; then
  approved="$(printf '%s' "$input" | python3 -c "
import json, sys
tool = (json.load(sys.stdin).get('tool_name') or '').strip()
print('1' if tool == 'Shell' or tool.startswith('MCP:') else '0')
")"
  [[ "$approved" == "1" ]] || exit 0
fi

# 用户已点 Run / 批准，命令执行完 → 从红灯回到黄灯
tl_mark_active
tl_clear_pending_approval
tl_set_status working
exit 0
