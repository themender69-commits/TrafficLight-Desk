#!/bin/bash
# stop：整轮收束 → 防抖后绿灯（期间若有 postToolUse 会取消）
set -euo pipefail
input=$(cat)
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

should_schedule="$(printf '%s' "$input" | python3 -c "
import json, sys
d = json.load(sys.stdin)

if d.get('stop_hook_active') is True:
    print('0')
    raise SystemExit

status = (d.get('status') or '').lower()
if status in ('aborted', 'cancelled', 'error', 'failed'):
    print('0')
    raise SystemExit

# 收束完成 → 调度绿灯；中间分段 stop 由防抖 + postToolUse 取消误亮
if status == 'completed':
    print('1')
    raise SystemExit

event = (d.get('hook_event_name') or '').lower()
if event in ('stop', 'subagentstop'):
    print('1')
else:
    print('0')
")"

[[ "$should_schedule" == "1" ]] || exit 0

tl_schedule_done "$PLUGIN_DIR"
exit 0
