# 启动 TrafficLight Desk（Windows 开发/源码模式）
$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent $PSScriptRoot
Set-Location $AppDir

$port = 9876
$listening = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($listening) {
  Write-Host "→ 端口 $port 已被占用，先执行 stop.ps1"
  & "$PSScriptRoot\stop.ps1"
  Start-Sleep -Milliseconds 500
}

if (-not (Test-Path "node_modules\electron")) {
  Write-Host "→ 首次运行，安装依赖…"
  npm install
}

Write-Host "→ 构建 UI…"
npm run build

$logDir = Join-Path $env:USERPROFILE ".trafficlight-desk"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "app.log"
$pidFile = Join-Path $logDir "app.pid"

Write-Host "→ 启动 TrafficLight Desk…"
$env:ELECTRON_RUN_AS_NODE = $null
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$p = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $AppDir `
  -RedirectStandardOutput $logFile -RedirectStandardError $logFile -PassThru -WindowStyle Hidden
$p.Id | Set-Content $pidFile

Start-Sleep -Seconds 2
$ok = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($ok) {
  Write-Host "→ 已启动（日志: $logFile）"
} else {
  Write-Host "→ 启动可能失败，请查看 $logFile"
  exit 1
}
