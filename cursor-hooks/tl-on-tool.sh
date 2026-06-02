#!/bin/bash
# postToolUse：仍在执行 → 黄灯；若已是绿灯则说明上一轮已结束，忽略迟到的 hook
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

current="$(tl_read_status)"

# 任务已结束（绿灯）：除非用户发了新 prompt，否则不应再变回黄灯
[[ "$current" == "done" ]] && exit 0

# 用户已操作完、工具继续跑 → 从红灯回到黄灯
tl_mark_active
tl_set_status working
exit 0
