#!/bin/bash
# 需用户操作 → 红灯（取消待亮绿灯）
set -euo pipefail
input=$(cat)
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

action="$(printf '%s' "$input" | python3 "$PLUGIN_DIR/tl-approval-lib.py")"

case "$action" in
  schedule)
    tl_set_pending_approval "$PLUGIN_DIR"
    ;;
  immediate)
    tl_clear_pending_approval
    tl_mark_active
    tl_set_status waiting
    ;;
  skip)
    ;;
esac

exit 0
