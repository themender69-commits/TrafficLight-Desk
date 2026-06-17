#!/bin/bash
# beforeSubmitPrompt：新一轮任务 → 黄灯
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

tl_mark_active
tl_set_status working
exit 0
