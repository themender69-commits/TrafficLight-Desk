#!/bin/bash
# 重启 TrafficLight Desk
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

"$APP_DIR/scripts/stop.sh"
sleep 0.5
"$APP_DIR/scripts/start.sh"
