# Changelog

## [Unreleased]

## [0.1.1] - 2026-06-17

### Added

- Node 单一状态机（`desktop/state-machine.cjs`），`POST /hook-event` 统一灯态与防抖
- Hook 薄层 `tl-dispatch.sh`；App/Hook 版本锁（`agent-hooks/VERSION`、`/diagnostics/versions`）
- UI SSE 实时推送（`GET /events`）；诊断 trace API
- ToolPicker「关于」版本信息；点空白 / Esc 关闭；标题栏固定关闭按钮
- Windows：`install-hooks.ps1`、`start.ps1` / `stop.ps1`；`npm run test:state-machine`
- macOS `scripts/open-app.sh`；`POST /app/show` 强制显示窗口

### Changed

- 音效由 App 统一播放（Tink / Glass），并 cancel agent-sound 迟到 Glass
- Hook 脚本改为事件转发，bash 内状态机逻辑迁入 Node
- 菜单滚动条深色细样式；移除红绿灯底部「关于」文字

### Fixed

- Mac 窗口难找到（Dock 图标、启动 show/focus、托盘点击显示）
- 切换工具时 Hook 路径兜底；启动时自动同步过期 Hook

## [0.1.0] - 2026-06-02

### Added

- 初始版本：Electron 悬浮红绿灯
- 支持 Cursor / Codex / Claude Code Hook 监控
- 本地 HTTP API（`:9876`）
- 系统托盘、侧边工具菜单
- Hook 安装器与路径自动探测
- 运维脚本 `scripts/start|stop|restart.sh`
- electron-builder 打包配置（macOS / Windows）
