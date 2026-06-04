# Changelog

## [Unreleased]

### Added

- Hook 监控活性检测（`monitor-health.cjs`）：绿点 = 5 分钟内有 Hook 回调；灰点 = 未连接或监控未激活
- 连接授权原生对话框（`connect-dialog.cjs`），侧边菜单与托盘共用
- 毛玻璃叠穿 UI（外层 glass + 内层 shell）
- `POST /tools/:id/connect/confirm` 端点
- `GET /status` 返回 `monitoring`、`lastHookAt` 字段
- 文档：`docs/ARCHITECTURE.md`、完善 README
- Windows 便携版 exe 打包（`npm run dist:win` / `scripts/pack-win.sh`）
- 双击 exe 单实例启动；Windows Hook 安装自动使用 `bash` 路径
- `release/README.md`：打包产物目录说明（二进制仍不提交 Git）

### Changed

- 工具选择菜单移除 Trae（暂无官方 Hook 支持）
- 连接弹窗文案精简
- Logo 状态点：绿 = 监控中，灰 = 未连接或未激活
- ToolPicker 过滤不支持 Hook 的工具
- 精简未使用的 API 导出与 `StatusPayload.message` 字段
- 合并 CHANGELOG / README / ARCHITECTURE 文档

### Removed

- Trae 相关代码与 Logo 资源（菜单已不支持）
- `cursor-hooks/logo/` 重复 Logo 目录（UI 使用 `public/logos/`）
- 毛玻璃 v1 样式备份文件
- 未完成的 `release/` 本地打包产物（`win-unpacked/`、`builder-debug.yml` 等中间文件）

### Fixed

- Claude Code 权限弹窗（如 Bash 批准）现正确亮红灯：识别 `PermissionRequest` / `Notification`

## [0.1.0] - 2026-06-02

### Added

- 初始版本：Electron 悬浮红绿灯
- 支持 Cursor / Codex / Claude Code Hook 监控
- 本地 HTTP API（`:9876`）
- 系统托盘、侧边工具菜单
- Hook 安装器与路径自动探测
- 运维脚本 `scripts/start|stop|restart.sh`
- electron-builder 打包配置（macOS / Windows）
