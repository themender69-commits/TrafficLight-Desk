# 将 agent-hooks/ 安装到 Cursor（Windows PowerShell）
# 用法: powershell -ExecutionPolicy Bypass -File agent-hooks/install-hooks.ps1
$ErrorActionPreference = "Stop"

$HooksSrc = Split-Path -Parent $MyInvocation.MyCommand.Path
$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }

function Resolve-CursorDir {
  $default = Join-Path $HomeDir ".cursor"
  if (Test-Path $default) {
    return (Resolve-Path $default).Path
  }
  if ($env:CURSOR_CONFIG_DIR -and (Test-Path $env:CURSOR_CONFIG_DIR)) {
    return (Resolve-Path $env:CURSOR_CONFIG_DIR).Path
  }
  return $default
}

$CursorDir = Resolve-CursorDir
$HooksJson = Join-Path $CursorDir "hooks.json"
$TlHooksDir = Join-Path $CursorDir "hooks\trafficlight-desk"

Write-Host "→ 目标 Cursor 配置: $CursorDir"
New-Item -ItemType Directory -Force -Path $TlHooksDir | Out-Null

Copy-Item -Force (Join-Path $HooksSrc "*.sh") $TlHooksDir
Copy-Item -Force (Join-Path $HooksSrc "*.py") $TlHooksDir -ErrorAction SilentlyContinue
Copy-Item -Force (Join-Path $HooksSrc "VERSION") $TlHooksDir -ErrorAction SilentlyContinue
Copy-Item -Force (Join-Path $HooksSrc "approval-catalog.json") $TlHooksDir -ErrorAction SilentlyContinue

Get-ChildItem -Path $TlHooksDir -Filter *.sh | ForEach-Object { $_.FullName | Out-Null }

if (-not (Test-Path $HooksJson)) {
  @{ version = 1; hooks = @{} } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $HooksJson
}

$data = Get-Content $HooksJson -Raw | ConvertFrom-Json
if (-not $data.hooks) {
  $data | Add-Member -NotePropertyName hooks -NotePropertyValue (@{}) -Force
}

$marker = "trafficlight-desk"
$tlDir = "./hooks/trafficlight-desk"
$entries = @{
  beforeSubmitPrompt = @(@{ command = "$tlDir/tl-on-prompt.sh" })
  postToolUse        = @(@{ command = "$tlDir/tl-on-tool.sh" })
  preToolUse         = @(@{
    command = "$tlDir/tl-on-wait.sh"
    matcher = "AskQuestion|AskUserQuestion|SwitchMode|ExitPlanMode|Task|GenerateImage|Shell|MCP:"
  })
  beforeShellExecution = @(@{ command = "$tlDir/tl-on-wait.sh" })
  beforeMCPExecution   = @(@{ command = "$tlDir/tl-on-wait.sh" })
  postToolUseFailure   = @(@{ command = "$tlDir/tl-on-tool-failure.sh" })
  subagentStart        = @(@{ command = "$tlDir/tl-on-wait.sh" })
  stop                 = @(@{ command = "$tlDir/tl-on-stop.sh" })
  sessionEnd           = @(@{ command = "$tlDir/tl-on-session-end.sh" })
}

foreach ($event in $entries.Keys) {
  $existing = @()
  if ($data.hooks.$event) {
    $existing = @($data.hooks.$event | Where-Object { $_.command -notmatch $marker })
  }
  $data.hooks.$event = @($existing) + @($entries[$event])
}

$data | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $HooksJson
Write-Host "→ 已合并 TrafficLight hooks 到 $HooksJson"
Write-Host ""
Write-Host "安装完成。请启动 TrafficLight Desk  portable exe，或在 App 内连接 Cursor。"
