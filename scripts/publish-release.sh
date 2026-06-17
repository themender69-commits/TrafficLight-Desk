#!/bin/bash
# 创建 GitHub Release v0.1.1 并上传安装包（需已安装 gh 且 gh auth login）
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
VERSION="0.1.1"
TAG="v${VERSION}"
NOTES="$APP_DIR/docs/RELEASE_v${VERSION}.md"
MAC="$APP_DIR/release/TrafficLight-Desk-${VERSION}-mac.dmg"
WIN="$APP_DIR/release/TrafficLight-Desk-${VERSION}-win-portable.exe"

if ! command -v gh >/dev/null 2>&1; then
  echo "→ 请先安装 GitHub CLI: https://cli.github.com/"
  echo "  macOS: brew install gh && gh auth login"
  exit 1
fi

for f in "$NOTES" "$MAC" "$WIN"; do
  [[ -f "$f" ]] || { echo "缺少文件: $f"; exit 1; }
done

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "→ Release $TAG 已存在，上传/更新附件…"
  gh release upload "$TAG" "$MAC" "$WIN" --clobber
else
  echo "→ 创建 Release $TAG …"
  gh release create "$TAG" \
    --title "TrafficLight Desk ${TAG}" \
    --notes-file "$NOTES" \
    "$MAC" "$WIN"
fi

echo "→ 完成: https://github.com/themender69-commits/TrafficLight-Desk/releases/tag/${TAG}"
