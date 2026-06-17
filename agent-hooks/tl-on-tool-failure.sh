#!/bin/bash
# postToolUseFailure：用户 Skip / 拒绝 Run → 清 pending，回黄灯继续等 Agent
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

if [[ -f "$TL_PENDING_APPROVAL_FILE" ]]; then
  tl_clear_pending_approval
  current="$(tl_read_status)"
  if [[ "$current" == "waiting" ]]; then
    tl_set_status working
  fi
fi

exit 0
