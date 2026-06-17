# 停止 TrafficLight Desk（Windows）
$ErrorActionPreference = "SilentlyContinue"
$pidFile = Join-Path $env:USERPROFILE ".trafficlight-desk\app.pid"

if (Test-Path $pidFile) {
  $pid = Get-Content $pidFile -Raw
  if ($pid -match '\d+') {
    Stop-Process -Id ([int]$Matches[0]) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $pidFile -Force
}

Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Get-Process -Name "TrafficLight Desk","electron" -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "*TrafficLight*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "→ TrafficLight Desk 已停止"
