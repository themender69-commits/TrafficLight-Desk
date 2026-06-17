#!/usr/bin/env python3
"""Shell/MCP 是否会出现 Run/批准框 — 与 agent-sound 对齐，但不跳过 sandbox。"""
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
    r"^(ls|pwd|echo|cat|head|tail|wc|which|command\s+-v|cd\s+|test\s+)",
    r"^git\s+(status|diff|log|show|rev-parse|branch)",
    r"^(swift\s+build|swift\s+test|swift\s+run)",
    r"^(find|rg|grep)\s+",
    r"^(chmod|cp|mv|mkdir|touch)\s+",
    r"^pgrep\s+",
    r'^open\s+"',
)


def auto_run_shell(cmd: str) -> bool:
    cmd = (cmd or "").strip()
    if not cmd:
        return True
    return any(re.match(p, cmd) for p in SAFE_SHELL)


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
