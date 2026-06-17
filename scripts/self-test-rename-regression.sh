#!/bin/bash
# 重命名 agent-hooks 后回归：路径、源码/安装一致性、双路径 Hook 自测、approval-lib 矩阵
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_HOOKS="$APP_DIR/agent-hooks"
INST_HOOKS="${CURSOR_HOOKS_DIR:-$HOME/.cursor/hooks/trafficlight-desk}"
RED='\033[0;31m'
GRN='\033[0;32m'
NC='\033[0m'
pass=0
fail=0

ok() { echo -e "  ${GRN}✓${NC} $1"; pass=$((pass + 1)); }
bad() { echo -e "  ${RED}✗${NC} $1"; fail=$((fail + 1)); }

assert_eq() {
  local label="$1" want="$2" got="$3"
  [[ "$want" == "$got" ]] && ok "$label" || bad "$label → 期望 ${want}，实际 ${got}"
}

echo "=== 重命名回归自测 ==="
echo ""

# --- 1. 目录与路径 ---
echo "【路径】agent-hooks 与 paths.cjs"
[[ -d "$SRC_HOOKS" ]] && ok "agent-hooks/ 存在" || bad "agent-hooks/ 缺失"
[[ ! -d "$APP_DIR/cursor-hooks" ]] && ok "旧 cursor-hooks/ 已移除" || bad "cursor-hooks/ 仍存在"
node -e "
const p = require('${APP_DIR}/desktop/paths.cjs');
const dir = p.getHooksSourceDir();
if (!dir.endsWith('agent-hooks')) process.exit(1);
if (!require('fs').existsSync(dir + '/tl-state.sh')) process.exit(2);
" && ok "paths.cjs → agent-hooks/tl-state.sh" || bad "paths.cjs 解析错误"
grep -q '"from": "agent-hooks"' "$APP_DIR/package.json" && ok "package.json extraResources 指向 agent-hooks" || bad "package.json 未更新"
echo ""

# --- 2. 源码 ↔ 已安装脚本一致 ---
echo "【同步】源码 vs ~/.cursor/hooks/trafficlight-desk"
for f in tl-on-wait.sh tl-on-tool.sh tl-on-tool-failure.sh tl-approval-lib.py approval-catalog.json; do
  if [[ -f "$SRC_HOOKS/$f" && -f "$INST_HOOKS/$f" ]]; then
    if diff -q "$SRC_HOOKS/$f" "$INST_HOOKS/$f" >/dev/null 2>&1; then
      ok "$f 与安装副本一致"
    else
      bad "$f 与安装副本不一致（请运行 agent-hooks/install-hooks.sh）"
    fi
  elif [[ -f "$SRC_HOOKS/$f" ]]; then
    bad "$f 未安装到 $INST_HOOKS"
  fi
done
echo ""

# --- 3. tl-approval-lib 分类矩阵 ---
echo "【approval-lib】classify 矩阵"
classify() {
  printf '%s' "$1" | python3 "$SRC_HOOKS/tl-approval-lib.py"
}

assert_eq "git status → skip" "skip" "$(classify '{"hook_event_name":"beforeShellExecution","command":"git status"}')"
assert_eq "cd && git push → schedule" "schedule" "$(classify '{"hook_event_name":"beforeShellExecution","command":"cd /tmp && git push origin main"}')"
assert_eq "AskQuestion → immediate" "immediate" "$(classify '{"hook_event_name":"preToolUse","tool_name":"AskQuestion"}')"
assert_eq "PermissionRequest → immediate" "immediate" "$(classify '{"hook_event_name":"PermissionRequest"}')"
assert_eq "subagentStart → immediate" "immediate" "$(classify '{"hook_event_name":"subagentStart"}')"
assert_eq "beforeMCP → schedule" "schedule" "$(classify '{"hook_event_name":"beforeMCPExecution"}')"
echo ""

# --- 4. 双路径完整 Hook 自测（安装目录 + 源码目录）---
echo "【Hook 自测 ×2】安装目录"
if bash "$APP_DIR/scripts/self-test-hooks.sh"; then
  ok "安装目录 Hook 自测 30/30"
else
  bad "安装目录 Hook 自测失败"
fi

echo ""
echo "【Hook 自测 ×2】源码 agent-hooks（模拟未 install 直接引用）"
if CURSOR_HOOKS_DIR="$SRC_HOOKS" bash "$APP_DIR/scripts/self-test-hooks.sh"; then
  ok "源码目录 Hook 自测 30/30"
else
  bad "源码目录 Hook 自测失败"
fi
echo ""

# --- 5. 稳定性：连跑 3 轮安装目录自测 ---
echo "【稳定性】连跑 3 轮"
for i in 1 2 3; do
  if bash "$APP_DIR/scripts/self-test-hooks.sh" >/dev/null 2>&1; then
    ok "第 ${i} 轮通过"
  else
    bad "第 ${i} 轮失败"
  fi
done
echo ""

# --- 6. sessionEnd / 迟到的 postToolUse 不误黄 ---
echo "【边界】sessionEnd → idle；done 后 postToolUse 不抢黄"
API="http://127.0.0.1:9876"
STATE="$HOME/.trafficlight-desk/state.json"
read_st() {
  curl -sf "$API/status" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))" \
    || python3 -c "import json; print(json.load(open('$STATE')).get('status','?'))"
}
curl -sf -X POST "$API/status" -H 'Content-Type: application/json' -d '{"status":"working","tool":"cursor"}' >/dev/null 2>&1 || true
printf '%s' '{"hook_event_name":"sessionEnd"}' | "$INST_HOOKS/tl-on-session-end.sh"
assert_eq "sessionEnd → idle" "idle" "$(read_st)"
curl -sf -X POST "$API/status" -H 'Content-Type: application/json' -d '{"status":"done","tool":"cursor"}' >/dev/null 2>&1 || true
printf '%s' '{"hook_event_name":"postToolUse","tool_name":"Read"}' | "$INST_HOOKS/tl-on-tool.sh"
assert_eq "done 后 Read postToolUse 仍 done" "done" "$(read_st)"
echo ""

# --- 7. install-hooks 可执行 ---
echo "【安装】agent-hooks/install-hooks.sh"
if bash "$SRC_HOOKS/install-hooks.sh" >/dev/null 2>&1; then
  ok "install-hooks.sh 执行成功"
else
  bad "install-hooks.sh 执行失败"
fi
echo ""

echo "================================"
echo -e "回归项通过: ${GRN}$pass${NC}  失败: ${fail:+${RED}$fail${NC}}${fail:-0}"
[[ "$fail" -eq 0 ]] && exit 0 || exit 1
