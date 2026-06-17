#!/bin/bash
# stop：整轮收束 → 防抖后绿灯（waiting / 待批准时不误变绿）
set -euo pipefail
input=$(cat)
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

# Run/批准框还在等点击 → 保持或补亮红灯，不调度绿灯
if [[ -f "$TL_PENDING_APPROVAL_FILE" ]]; then
  current="$(tl_read_status)"
  if [[ "$current" == "working" || "$current" == "done" ]]; then
    tl_set_status waiting
  fi
  exit 0
fi

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

current="$(tl_read_status)"
[[ "$current" == "waiting" ]] && exit 0

# Agent 已标记 completed → 短防抖；否则略长一点防误绿
done_delay="$(printf '%s' "$input" | python3 -c "
import json, sys
d = json.load(sys.stdin)
status = (d.get('status') or '').lower()
print('0.5' if status == 'completed' else '1.0')
")"
TL_DONE_DEBOUNCE_SEC="$done_delay" tl_schedule_done "$PLUGIN_DIR"
exit 0
