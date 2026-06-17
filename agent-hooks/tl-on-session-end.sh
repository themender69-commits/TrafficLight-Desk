#!/bin/bash
# sessionEnd：回到待命（全灭）
set -euo pipefail
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

tl_mark_active
tl_clear_pending_approval
tl_set_status idle
exit 0
