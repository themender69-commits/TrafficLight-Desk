#!/bin/bash
# 需用户操作 → 红灯（取消待亮绿灯）
set -euo pipefail
input=$(cat)
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tl-state.sh
source "$PLUGIN_DIR/tl-state.sh"

should_wait="$(printf '%s' "$input" | python3 -c "
import json, sys, re
d = json.load(sys.stdin)
event = d.get('hook_event_name', '')

def auto_run_shell(cmd: str) -> bool:
    cmd = (cmd or '').strip()
    if not cmd:
        return True
    safe = (
        r'^(ls|pwd|echo|cat|head|tail|wc|which|command\s+-v|cd\s+|test\s+)',
        r'^git\s+(status|diff|log|show|rev-parse|branch)',
        r'^(swift\s+build|swift\s+test|swift\s+run)',
        r'^(npm|pnpm|yarn)\s+(run|test|install|ci)',
        r'^(find|rg|grep)\s+',
        r'^(chmod|cp|mv|mkdir|touch)\s+',
        r'^pgrep\s+',
        r'^open\s+\"',
    )
    return any(re.match(p, cmd) for p in safe)

if event == 'preToolUse':
    tool = (d.get('tool_name') or '').strip()
    if tool in ('AskQuestion', 'SwitchMode'):
        print('1')
    else:
        print('0')
elif event == 'beforeShellExecution':
    if d.get('sandbox') is True:
        print('0')
    elif auto_run_shell(d.get('command') or ''):
        print('0')
    else:
        print('1')
elif event == 'beforeMCPExecution':
    if d.get('sandbox') is True:
        print('0')
    else:
        print('1')
else:
    print('0')
")"

[[ "$should_wait" == "1" ]] || exit 0

current="$(tl_read_status)"
[[ "$current" == "done" ]] && exit 0

tl_mark_active
tl_set_status waiting
exit 0
