#!/bin/bash
# Hook 状态机自测 — 对应 approval-catalog.json 与 agent-hooks/
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS="${CURSOR_HOOKS_DIR:-$HOME/.cursor/hooks/trafficlight-desk}"
API="http://127.0.0.1:9876"
STATE="$HOME/.trafficlight-desk/state.json"

RED='\033[0;31m'
YEL='\033[0;33m'
GRN='\033[0;32m'
NC='\033[0m'

pass=0
fail=0

read_status() {
  curl -sf "$API/status" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))" \
    || python3 -c "import json; print(json.load(open('$STATE')).get('status','?'))"
}

reset_idle() {
  curl -sf -X POST "$API/state/reset" >/dev/null 2>&1 || true
  sleep 0.15
}

assert_status() {
  local label="$1"
  local want="$2"
  local got
  got="$(read_status)"
  if [[ "$got" == "$want" ]]; then
    echo -e "  ${GRN}✓${NC} $label → $got"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} $label → 期望 ${want}，实际 ${got}"
    fail=$((fail + 1))
  fi
}

run_hook() {
  local script="$1"
  local json="$2"
  printf '%s' "$json" | "$HOOKS/$script"
}

echo "=== TrafficLight Desk Hook 自测 ==="
echo "Hooks: $HOOKS"
echo ""

# --- 标准 3：执行中黄灯 ---
echo "【标准3】Agent 执行中 → working（黄灯）"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
assert_status "新 prompt" "working"
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Read"}'
assert_status "postToolUse 继续执行" "working"
echo ""

# --- 标准 3：safe 命令不红灯 ---
echo "【标准3】只读/安全命令 → 保持 working"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"git status"}'
assert_status "git status 不触发红灯" "working"
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"ls -la"}'
assert_status "ls 不触发红灯" "working"
echo ""

# --- Allowlist Run 框：cd && 危险命令不能误判为安全 ---
echo "【Allowlist】cd && bash … → schedule + 红灯（Not in allowlist / Run 框）"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"cd \"/Users/mac/My_AI_Workspace/product/TrafficLight Desk\" && bash scripts/self-test-hooks.sh 2>&1 | tail -35","sandbox":false}'
assert_status "beforeShellExecution schedule → 立即 waiting" "waiting"
[[ -f "$HOME/.trafficlight-desk/pending-approval" ]] && echo -e "  ${GRN}✓${NC} pending 已写入（非 cd 误判 skip）" && pass=$((pass+1)) || { echo -e "  ${RED}✗${NC} pending 缺失（可能 cd 误判）"; fail=$((fail+1)); }
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Shell","duration":0.527}'
assert_status "stub postToolUse → waiting" "waiting"
echo ""

# --- Allow/Run 等待：stub postToolUse 不能抢黄 ---
echo "【Allow 等待】stub postToolUse（duration≈0）→ 红灯 + 保留 pending"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"git push origin main","sandbox":false}'
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Shell","duration":0.527}'
assert_status "stub postToolUse 立即亮红" "waiting"
[[ -f "$HOME/.trafficlight-desk/pending-approval" ]] && echo -e "  ${GRN}✓${NC} pending 未被 stub 清掉" && pass=$((pass+1)) || { echo -e "  ${RED}✗${NC} pending 被 stub 误清"; fail=$((fail+1)); }
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Shell","duration":1200,"tool_output":"{\"output\":\"\",\"exitCode\":0}"}'
assert_status "真正执行完 → working" "working"
echo ""

# --- 标准 1+2：Run 框 → 短延迟后红灯 ---
echo "【标准1+2】Run 框：schedule 后 UI 延迟亮红"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"git push origin main"}'
assert_status "beforeShellExecution schedule → 立即 waiting" "waiting"
[[ -f "$HOME/.trafficlight-desk/pending-approval" ]] && echo -e "  ${GRN}✓${NC} pending-approval 已写入" && pass=$((pass+1)) || { echo -e "  ${RED}✗${NC} pending-approval 缺失"; fail=$((fail+1)); }
sleep 0.2
assert_status "UI 延迟后 → waiting（红）" "waiting"
echo ""

# --- Run 等待期间其它工具 postToolUse 不能抢黄 ---
echo "【Run 等待】pending 时 Read postToolUse 仍保持红灯"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"git push origin main"}'
sleep 0.2
assert_status "Shell 待 Run → waiting" "waiting"
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Read"}'
assert_status "Read 完成不能变 working" "waiting"
[[ -f "$HOME/.trafficlight-desk/pending-approval" ]] && echo -e "  ${GRN}✓${NC} pending 未被 Read 清掉" && pass=$((pass+1)) || { echo -e "  ${RED}✗${NC} pending 被误清"; fail=$((fail+1)); }
echo ""

# --- 标准 3：自动执行的命令不闪红 ---
echo "【标准3】自动 Run 完 → 不闪红"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"curl -s http://127.0.0.1:9876/status"}'
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Shell","duration":35,"tool_output":"{\"output\":\"{\\\"status\\\":\\\"idle\\\"}\",\"exitCode\":0}"}'
sleep 0.2
assert_status "postToolUse 已清 pending，保持 working" "working"
echo ""

# --- 标准 3：用户点 Run 后 Shell postToolUse → 黄 ---
echo "【标准3】用户点 Run 后 Shell postToolUse → working"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"git push origin main"}'
sleep 0.2
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse","tool_name":"Shell","duration":1200,"tool_output":"{\"output\":\"\",\"exitCode\":0}"}'
assert_status "Shell 执行完 → working" "working"
[[ ! -f "$HOME/.trafficlight-desk/pending-approval" ]] && echo -e "  ${GRN}✓${NC} pending 已清除" && pass=$((pass+1)) || { echo -e "  ${RED}✗${NC} pending 未清除"; fail=$((fail+1)); }
echo ""

# --- 标准 1：AskQuestion 立即红 ---
echo "【标准1】AskQuestion → 立即 waiting"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"preToolUse","tool_name":"AskQuestion"}'
assert_status "AskQuestion 立即红灯" "waiting"
echo ""

# --- 标准 1：Claude PermissionRequest 立即红 ---
echo "【标准1】PermissionRequest → 立即 waiting"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"PermissionRequest","tool_name":"Bash"}'
assert_status "PermissionRequest 立即红灯" "waiting"
echo ""

# --- 标准 1+2：MCP 批准 → UI 延迟红灯 ---
echo "【标准1+2】MCP 批准 → UI 延迟红灯"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeMCPExecution","tool_name":"some-mcp"}'
assert_status "beforeMCP schedule → 立即 waiting" "waiting"
sleep 0.2
assert_status "MCP UI 延迟 → waiting" "waiting"
echo ""

# --- 标准 1+2：sandbox 命令也 schedule ---
echo "【标准1+2】sandbox 命令 → 也亮红灯"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"curl -s https://example.com","sandbox":true}'
sleep 0.2
assert_status "sandbox curl → waiting" "waiting"
echo ""

# --- catalog C07：ExitPlanMode ---
echo "【C07】ExitPlanMode → 立即 waiting"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"preToolUse","tool_name":"ExitPlanMode"}'
assert_status "ExitPlanMode 立即红灯" "waiting"
echo ""

# --- catalog C12：subagentStart ---
echo "【C12】subagentStart → 立即 waiting"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"subagentStart","subagent_type":"shell"}'
assert_status "subagentStart 立即红灯" "waiting"
echo ""

# --- catalog X01：Skip 清 pending ---
echo "【X01】postToolUseFailure Skip → 清 pending、回 working"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"beforeShellExecution","command":"git push origin main","sandbox":false}'
run_hook tl-on-tool-failure.sh '{"hook_event_name":"postToolUseFailure","tool_name":"Shell","error_message":"User skipped"}'
assert_status "Skip 后回 working" "working"
[[ ! -f "$HOME/.trafficlight-desk/pending-approval" ]] && echo -e "  ${GRN}✓${NC} pending 已清除" && pass=$((pass+1)) || { echo -e "  ${RED}✗${NC} pending 未清除"; fail=$((fail+1)); }
echo ""

# --- waiting 时不调度绿灯 ---
echo "【标准1】waiting 时 stop 不转 done"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-wait.sh '{"hook_event_name":"preToolUse","tool_name":"AskQuestion"}'
run_hook tl-on-stop.sh '{"hook_event_name":"stop","status":"completed"}'
assert_status "waiting 保持不绿" "waiting"
echo ""

# --- 正常结束 → done ---
echo "【收尾】无 pending 的 stop → done（防抖）"
reset_idle
run_hook tl-on-prompt.sh '{"hook_event_name":"beforeSubmitPrompt"}'
run_hook tl-on-tool.sh '{"hook_event_name":"postToolUse"}'
run_hook tl-on-stop.sh '{"hook_event_name":"stop","status":"completed"}'
sleep 0.2
assert_status "stop 防抖后 done" "done"
echo ""

reset_idle
echo "================================"
echo -e "通过: ${GRN}$pass${NC}  失败: ${fail:+${RED}$fail${NC}}${fail:-0}"
[[ "$fail" -eq 0 ]] && exit 0 || exit 1
