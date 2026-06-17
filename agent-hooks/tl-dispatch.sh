#!/bin/bash
# 所有 Cursor/Claude Hook 统一入口 → App 状态机 POST /hook-event
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

input="$(cat)"
tl_dispatch_hook "$input"
exit 0
