# TrafficLight Desk

桌面 AI 工具状态监视器 — 竖条红绿灯，顶部显示被监控工具的 Logo，下方红 / 黄 / 绿三灯。

## 三灯含义

| 灯 | 状态 | 含义 |
|----|------|------|
| 🟡 黄灯闪烁 | `working` | AI 正在干活 |
| 🟢 绿灯常亮 | `done` | 任务结束，可以验收 |
| 🔴 红灯常亮 | `waiting` | 需要你切回界面点击操作 |
| 全灭 | `idle` | 待命 |

## 快速开始

```bash
cd "/Users/mac/My_AI_Workspace/product/TrafficLight Desk"
npm install
npm run dev
```

开发模式会同时启动 Vite 热更新和 Electron 悬浮窗（默认在屏幕右上角，始终置顶）。

若窗口无法启动，检查 shell 是否设置了 `ELECTRON_RUN_AS_NODE=1`（Cursor/CI 常见）。`npm` 脚本已自动 unset；请优先用 `npm start` / `npm run dev` 启动。

## 连接 AI 工具

两种方式（效果相同）：

1. **点击红绿灯顶部 Logo** → 选择 Cursor / Codex / Claude / Trae
2. **系统托盘菜单** → 选择要监控的工具

App 会自动探测本机配置目录（如 `~/.cursor`、`~/.claude`），确认授权后安装 Hook。  
Logo 会切换为对应工具图标；右下角绿点表示已连接。

| 工具 | 自动探测 | Hook 监控 |
|------|----------|-----------|
| Cursor | `~/.cursor` 或 `CURSOR_CONFIG_DIR` | ✅ |
| Codex | 复用 Cursor 配置 | ✅ |
| Claude Code | `~/.claude` 或 `CLAUDE_CONFIG_DIR` | ✅ |
| Trae | `~/.trae` / `~/.trae-cn` | ❌ 暂无官方 Hook |

授权范围：仅合并 Hook 配置 + 本机 `~/.trafficlight-desk/` 状态文件。不访问网络、不读项目代码、不需要管理员权限。可随时「断开连接」撤销。

## 命令行安装 Cursor Hook（可选）

```bash
chmod +x cursor-hooks/install-hooks.sh
./cursor-hooks/install-hooks.sh
```

### Hook 触发逻辑

| 事件 | 灯态 |
|------|------|
| `beforeSubmitPrompt` / `UserPromptSubmit` | 黄灯 |
| `postToolUse` / `PostToolUse` | 保持黄灯 |
| 需用户点击确认 | 红灯 |
| `stop` / `Stop`（防抖 2.5s） | 绿灯 |
| `sessionEnd` / `SessionEnd` | 全灭 |

## HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 当前灯态 + 连接信息 |
| GET | `/tools` | 工具列表与探测结果 |
| GET | `/tools/:id/detect` | 探测单个工具配置路径 |
| POST | `/tools/:id/connect` | 授权并安装 Hook |
| DELETE | `/connection` | 断开并卸载 Hook |

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `TRAFFICLIGHT_PORT` | `9876` | 本地状态 HTTP 端口 |
| `TL_DONE_DEBOUNCE_SEC` | `2.5` | 绿灯防抖秒数 |

## 打包运行

```bash
npm run preview
```

## 项目结构

```
TrafficLight Desk/
├── main.cjs              # Electron 入口
├── desktop/              # 路径探测、Hook 安装、HTTP、托盘
├── public/logos/         # 各 AI 工具 Logo
├── src/                  # React UI
├── cursor-hooks/         # Hook 脚本（随包分发）
└── README.md
```
