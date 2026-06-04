# TrafficLight Desk

桌面 AI 工具状态监视器 — 竖条悬浮红绿灯，顶部显示被监控工具的 Logo，下方红 / 黄 / 绿三灯。

> 本机运行、Hook 驱动、不联网。适合在 AI Agent 长时间工作时，扫一眼桌面角标就知道「别催 / 可验收 / 需操作」。

**仓库：** [github.com/themender69-commits/TrafficLight-Desk](https://github.com/themender69-commits/TrafficLight-Desk)

---

## 功能概览

- **悬浮窗红绿灯** — 透明 Electron 窗口，始终置顶，不占任务栏
- **多工具切换** — 支持 Cursor、Codex（经 Cursor）、Claude Code
- **Hook 自动安装** — 探测本机配置目录，授权后合并 Hook 配置
- **监控活性检测** — Logo 右下角绿/灰点区分「Hook 有效」与「仅连接未激活」
- **侧边工具菜单** — 点击 Logo 展开，菜单在左、红绿灯在右
- **系统托盘** — 快速切换工具、断开连接、重启/退出
- **本地 HTTP API** — Hook 脚本与 UI 通过 `127.0.0.1:9876` 通信

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 35（透明无边框窗口） |
| 前端 | React 19 + TypeScript + Vite 6 |
| 主进程 | Node.js（CommonJS，`main.cjs` + `desktop/`） |
| 状态通道 | 本地 HTTP + `~/.trafficlight-desk/` JSON 文件 |
| Hook | Bash 脚本（Cursor `hooks.json` / Claude `settings.json`） |
| 打包 | electron-builder（macOS DMG / Windows Portable） |

> **注意：** 主进程目录不要用 `electron/`，否则 `require('electron')` 会与 npm 包冲突。启动脚本已自动 `unset ELECTRON_RUN_AS_NODE`。

---

## 三灯含义

| 灯 | 状态 | 含义 |
|----|------|------|
| 🟡 黄灯闪烁 | `working` | AI 正在干活，别催 |
| 🟢 绿灯常亮 | `done` | 任务结束，可以验收 |
| 🔴 红灯闪烁 | `waiting` | 需要你切回界面操作 |
| 全灭 | `idle` | 待命 |

---

## Logo 指示灯

| 颜色 | 含义 |
|------|------|
| 🟢 绿点 | Hook 近期有回调（5 分钟内），监控有效 |
| ⚫ 灰点 | 未连接；或已连接但 Hook 未激活（失效 / 长时间无活动） |

新连接后有 **2 分钟宽限期**，尚未收到 Hook 时也暂时显示绿点。

---

## 快速开始

### Windows 用户（推荐）

从 [GitHub Releases](https://github.com/themender69-commits/TrafficLight-Desk/releases) 下载 `TrafficLight-Desk-*-win-portable.exe`，**双击运行**即可（便携版，无需安装）。详见下方 [打包分发](#打包分发)。

### 开发模式（热更新）

```bash
git clone https://github.com/themender69-commits/TrafficLight-Desk.git
cd TrafficLight-Desk
npm install
npm run dev
```

### 生产模式（构建 + 运行）

```bash
npm run preview
# 或使用运维脚本
chmod +x scripts/*.sh
./scripts/start.sh    # 构建并后台启动
./scripts/stop.sh     # 停止
./scripts/restart.sh  # 重启
```

日志：`~/.trafficlight-desk/app.log`

若窗口无法启动，检查 shell 是否设置了 `ELECTRON_RUN_AS_NODE=1`（Cursor/CI 常见）。`npm` 脚本已自动 unset。

---

## 连接 AI 工具

两种方式（效果相同）：

1. **点击红绿灯顶部 Logo** → 侧边菜单选择工具
2. **系统托盘菜单** → 选择要监控的工具

连接时会弹出原生授权对话框（简要说明本地 Hook 写入范围）。切换工具时会自动卸载上一工具的 Hook。

| 工具 | 自动探测 | Hook 监控 |
|------|----------|-----------|
| Cursor | `~/.cursor` 或 `CURSOR_CONFIG_DIR` | ✅ |
| Codex | 复用 Cursor 配置 | ✅ |
| Claude Code | `~/.claude` 或 `CLAUDE_CONFIG_DIR` | ✅ |

**授权范围：** 仅合并 Hook 配置 + 读写 `~/.trafficlight-desk/` 状态文件。不访问网络、不读项目代码、不需要管理员权限。可随时「断开连接」撤销。

---

## Hook 触发逻辑

| 事件 | 灯态 |
|------|------|
| `beforeSubmitPrompt` / `UserPromptSubmit` | 黄灯 |
| `postToolUse` / `PostToolUse` | 保持黄灯 |
| 需用户确认（见下） | 红灯 |
| `stop` / `Stop`（防抖 2.5s） | 绿灯 |
| `sessionEnd` / `SessionEnd` | 全灭 |

**红灯触发（Cursor）：** `preToolUse`（AskQuestion / SwitchMode）、`beforeShellExecution`、`beforeMCPExecution`

**红灯触发（Claude Code）：** `PermissionRequest`、`Notification`（permission_prompt）、`PreToolUse`（AskUserQuestion / ExitPlanMode 等）

> Hook 脚本更新后，请在 App 内 **断开并重新连接** 对应工具，以写入新配置。

### 命令行手动安装 Hook（可选）

```bash
chmod +x cursor-hooks/install-hooks.sh
./cursor-hooks/install-hooks.sh
```

---

## HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 灯态 + `connected` + `monitoring` |
| POST | `/status` | Hook 写入状态（会刷新 `lastHookAt`） |
| GET | `/connection` | 连接信息与监控活性 |
| DELETE | `/connection` | 断开并卸载 Hook |
| GET | `/tools` | 工具列表与探测结果 |
| GET | `/tools/:id/detect` | 探测单个工具配置路径 |
| POST | `/tools/:id/connect/confirm` | 弹出原生授权对话框 |
| POST | `/tools/:id/connect` | 安装 Hook 并建立连接 |
| POST | `/app/window-layout` | 菜单展开时调整窗口大小 |
| POST | `/app/restart` | 重启应用 |
| POST | `/app/quit` | 退出应用 |

`GET /status` 响应示例：

```json
{
  "status": "working",
  "tool": "cursor",
  "connected": true,
  "monitoring": true,
  "lastHookAt": 1780416792402,
  "updatedAt": 1780416792402
}
```

---

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `TRAFFICLIGHT_PORT` | `9876` | 本地状态 HTTP 端口 |
| `TRAFFICLIGHT_DEV` | — | 设为 `1` 时 Electron 加载 Vite 开发服务器 |
| `CURSOR_CONFIG_DIR` | `~/.cursor` | Cursor 配置目录 |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Claude Code 配置目录 |
| `TL_DONE_DEBOUNCE_SEC` | `2.5` | 绿灯防抖秒数（Hook 脚本内） |

---

## UI 设计

- **叠穿毛玻璃外框** — 外层 `.traffic-light__glass`（磨砂 + 渐变），内层 `.traffic-light__shell`（深色金属壳）
- **自适应背景** — 玻璃层使用半自主渐变，深浅壁纸下表现较稳定
- **布局** — 仅红绿灯时窗口内居中；菜单展开时菜单居左、灯居右

更多架构说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 打包分发

### 给最终用户（Windows）

1. 从 [GitHub Releases](https://github.com/themender69-commits/TrafficLight-Desk/releases) 下载 `TrafficLight-Desk-*-win-portable.exe`（或本地构建见下）
2. **双击 exe** 即可运行（便携版，无需安装）
3. 首次运行若被 SmartScreen 拦截，点「更多信息」→「仍要运行」
4. 在 App 内点击 Logo → 选择要监控的工具（Cursor / Claude）→ 授权 Hook
5. Windows 上 Hook 脚本依赖 **Git Bash**（Cursor / Claude Code 通常已自带）；若连接失败，请先安装 [Git for Windows](https://git-scm.com/download/win)

状态与配置保存在 `%USERPROFILE%\.trafficlight-desk\`。

### 开发者打包

```bash
chmod +x scripts/pack-win.sh
./scripts/pack-win.sh   # Windows 便携 exe → release/

npm run dist:mac        # macOS DMG → release/
npm run dist:win        # 同上（Windows exe）
```

产物目录：`release/`（已在 `.gitignore`，不提交仓库）

| 平台 | 文件名示例 |
|------|------------|
| Windows | `TrafficLight-Desk-0.1.0-win-portable.exe` |
| macOS | `TrafficLight-Desk-0.1.0-mac.dmg` |

---

## 项目结构

```
TrafficLight Desk/
├── main.cjs                    # Electron 入口
├── desktop/
│   ├── http-server.cjs         # 本地 HTTP API
│   ├── hook-installer.cjs      # Hook 安装 / 卸载
│   ├── path-resolver.cjs       # 各工具配置目录探测
│   ├── monitor-health.cjs      # Hook 活性检测（绿/灰点）
│   ├── connect-dialog.cjs      # 连接授权弹窗文案
│   ├── window-layout.cjs       # 窗口尺寸（菜单开关联动）
│   ├── tray.cjs                # 系统托盘
│   └── paths.cjs               # 打包后 Hook 路径解析
├── src/
│   ├── components/             # TrafficLight, ToolPicker, ToolLogo
│   ├── hooks/                  # useTrafficLightStatus（轮询 /status）
│   ├── styles/                 # traffic-light.css
│   └── utils/                  # logoSrc 等
├── cursor-hooks/               # Hook 脚本源文件 + install-hooks.sh
├── public/logos/               # 各工具 Logo（SVG）
├── scripts/                    # start / stop / restart / pack-win
└── docs/
    └── ARCHITECTURE.md         # 架构与数据流
```

---

## 本机数据文件

| 路径 | 说明 |
|------|------|
| `~/.trafficlight-desk/state.json` | 当前灯态 |
| `~/.trafficlight-desk/connection.json` | 已连接工具 |
| `~/.trafficlight-desk/last-hook.json` | 最近一次 Hook 回调时间 |
| `~/.trafficlight-desk/manifests/` | 各工具 Hook 安装清单 |

---

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

---

## License

MIT（如需调整请告知维护者）
