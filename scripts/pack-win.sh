#!/bin/bash
# 打包 Windows 便携版 exe（可在 macOS 上交叉编译）
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

if [[ ! -d node_modules/electron-builder ]]; then
  echo "→ 安装依赖…"
  npm install
fi

echo "→ 打包 Windows 便携版 exe…"
npm run dist:win

echo ""
echo "完成。输出目录: $APP_DIR/release/"
ls -lh "$APP_DIR/release/"*.exe 2>/dev/null || ls -lh "$APP_DIR/release/"
