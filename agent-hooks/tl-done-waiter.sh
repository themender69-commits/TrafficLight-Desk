#!/bin/bash
# 防抖后亮绿灯
set -euo pipefail
GEN="$1"
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

DEBOUNCE="${TL_DONE_DEBOUNCE_SEC:-0.04}"

sleep "$DEBOUNCE"

current_gen="$(cat "$TL_DONE_GEN_FILE" 2>/dev/null || echo 0)"
[[ "$current_gen" == "$GEN" ]] || exit 0

tl_set_status done
rm -f "$TL_DONE_WAITER_PID"
exit 0
