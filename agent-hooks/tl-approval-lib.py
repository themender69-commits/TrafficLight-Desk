#!/usr/bin/env python3
"""Shell/MCP 是否会出现 Run/Allow 批准框。

完整场景清单见同目录 approval-catalog.json。
脚本位于 agent-hooks/，安装时复制到 Cursor（~/.cursor）或 Claude（~/.claude）。
"""
import json
import re
import sys

WAIT_TOOLS = (
    "AskQuestion",
    "AskUserQuestion",
    "SwitchMode",
    "ExitPlanMode",
    "Task",
    "GenerateImage",
)

SAFE_SHELL = (
    r"^(ls|pwd|echo|cat|head|tail|wc|which|command\s+-v|test\s+)",
    r"^git\s+(status|diff|log|show|rev-parse|branch)",
    r"^(swift\s+build|swift\s+test|swift\s+run)",
    r"^(find|rg|grep)\s+",
    r"^(chmod|cp|mv|mkdir|touch)\s+",
    r"^pgrep\s+",
    r'^open\s+"',
    r"^cd\s+",
)


def auto_run_shell_segment(cmd: str) -> bool:
    cmd = (cmd or "").strip()
    if not cmd:
        return True
    return any(re.match(p, cmd) for p in SAFE_SHELL)


def auto_run_shell(cmd: str) -> bool:
    """整条命令安全才 skip；cd foo && git push 不能因开头 cd 而 skip。"""
    cmd = (cmd or "").strip()
    if not cmd:
        return True
    parts = re.split(r"\s*&&\s*|\s*;\s*", cmd)
    if len(parts) == 1:
        return auto_run_shell_segment(cmd)
    return all(auto_run_shell_segment(p) for p in parts if p.strip())


def shell_command(d: dict) -> str:
    cmd = d.get("command")
    if cmd:
        return cmd
    tool_input = d.get("tool_input") or {}
    return tool_input.get("command") or ""


def classify(payload: dict) -> str:
    """返回: skip | immediate | schedule"""
    event = payload.get("hook_event_name", "")

    if event == "beforeShellExecution":
        return "skip" if auto_run_shell(shell_command(payload)) else "schedule"
    if event == "beforeMCPExecution":
        return "schedule"

    if event == "subagentStart":
        return "immediate"

    if event == "Notification":
        if payload.get("notification_type") in ("permission_prompt", "elicitation_dialog"):
            return "immediate"
        return "skip"
    if event == "PermissionRequest":
        return "immediate"

    if event in ("PreToolUse", "preToolUse"):
        tool = (payload.get("tool_name") or "").strip()
        if tool in WAIT_TOOLS:
            return "immediate"
        if tool == "Shell":
            return "skip" if auto_run_shell(shell_command(payload)) else "schedule"
        if tool.startswith("MCP:"):
            return "schedule"

    return "skip"


def main() -> None:
    payload = json.load(sys.stdin)
    print(classify(payload))


if __name__ == "__main__":
    main()
