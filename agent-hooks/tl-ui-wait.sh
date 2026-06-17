#!/bin/bash
# 批准框渲染后亮红灯：短延迟 + pending 仍在 → waiting
set -euo pipefail
GEN="$1"
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

DELAY="${TL_UI_WAIT_DELAY_SEC:-0.05}"
sleep "$DELAY"

current_gen="$(cat "$TL_WAIT_FALLBACK_GEN_FILE" 2>/dev/null || echo 0)"
[[ "$current_gen" == "$GEN" ]] || exit 0
[[ -f "$TL_PENDING_APPROVAL_FILE" ]] || exit 0

current="$(tl_read_status)"
[[ "$current" == "done" ]] && exit 0

tl_set_status waiting
rm -f "$TL_WAIT_FALLBACK_PID"
exit 0
