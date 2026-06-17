# Architecture

TrafficLight Desk 是一个 **Electron + React** 本机辅助工具：AI 工具的 Hook 脚本将 Agent 状态写入本地 HTTP 服务，React UI 轮询并渲染为桌面红绿灯。

---

## 整体数据流

```
┌─────────────────┐     POST /status      ┌──────────────────┐
│  Cursor / Claude │ ────────────────────► │  http-server.cjs │
│  Hook 脚本       │     (127.0.0.1:9876)  │  + monitor-health│
└─────────────────┘                       └────────┬─────────┘
                                                   │
                     GET /status (400ms 轮询)     │ 读写
                           ┌───────────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  React UI       │
                  │  TrafficLight   │
                  └─────────────────┘
                           │
                           ▼
                  ~/.trafficlight-desk/
                  state.json / connection.json / last-hook.json
```

---

## 进程与模块

### 主进程（`main.cjs`）

- 创建透明悬浮窗、系统托盘
- 启动 HTTP 服务
- **单实例锁**：重复双击 exe / 再次启动时聚焦已有窗口
- macOS 专属：`setVisibleOnAllWorkspaces` 全桌面空间可见
- 监听状态文件变化（供未来扩展；UI 目前通过轮询获取）

### `desktop/http-server.cjs`

本地 API 网关，职责：

- 暴露 `/status`、`/tools`、`/connection` 等端点
- 连接工具时调用 `hook-installer.cjs`
- 连接确认时调用 `connect-dialog.cjs` 弹出原生对话框
- Hook POST 时调用 `monitor-health.cjs` 记录 `lastHookAt`

### `desktop/hook-installer.cjs`

- 复制 `cursor-hooks/*.sh` 到目标工具配置目录
- **Cursor / Codex：** 合并 `hooks.json`
- **Claude Code：** 合并 `settings.json`（Hook 组结构不同）
- **Windows：** Hook 命令写为 `bash "绝对路径/script.sh"`（依赖 Git Bash）
- 写入 `connection.json` 与 `manifests/{tool}.json` 便于卸载

**Cursor Hook 事件：** `beforeSubmitPrompt`、`postToolUse`、`preToolUse`、`beforeShellExecution`、`beforeMCPExecution`、`stop`、`sessionEnd`

**Claude Hook 事件：** `UserPromptSubmit`、`PostToolUse`、`PreToolUse`、`Notification`、`PermissionRequest`、`Stop`、`SessionEnd`

### `desktop/path-resolver.cjs`

自动探测：

| 工具 | 目录 | 配置文件 |
|------|------|----------|
| Cursor | `~/.cursor` | `hooks.json` |
| Codex | 同 Cursor | 同 Cursor |
| Claude | `~/.claude` | `settings.json` |

支持 `CURSOR_CONFIG_DIR`、`CLAUDE_CONFIG_DIR` 环境变量。

### `desktop/monitor-health.cjs`

监控活性逻辑：

```
monitoring = connection 存在 AND (
  5 分钟内有 Hook POST /status
  OR 连接后 2 分钟内（宽限期）
)
```

- **绿点** → `monitoring: true`
- **灰点** → 未连接或 `monitoring: false`
- 不会自动卸载 Hook，仅 UI 降级提示

### `desktop/window-layout.cjs`

- 仅红绿灯：`118 × 382` px 左右（含毛玻璃外框留白）
- 菜单展开：宽度增加，红绿灯贴右

### `desktop/connect-dialog.cjs`

统一连接/切换授权弹窗文案，侧边菜单与托盘共用。

---

## 前端结构

| 组件 | 职责 |
|------|------|
| `TrafficLight` | 红绿灯主体 + 毛玻璃叠层 + 菜单布局 |
| `ToolPicker` | 工具列表、连接/断开、重启/退出 |
| `ToolLogo` | 工具图标 + 绿/灰状态点 |
| `useTrafficLightStatus` | 每 400ms 轮询 `GET /status` |

Logo 路径使用相对路径 `./logos/...`（Electron `file://` 协议下不可用绝对路径 `/logos/`）。

---

## Hook 状态机（`cursor-hooks/tl-state.sh`）

核心规则：

1. **Prompt 提交** → `working`（黄灯）
2. **Tool 执行中** → 保持 `working`；`postToolUse` 不覆盖已完成的 `done`
3. **需用户操作** → `waiting`（红灯）
   - **Cursor：** `preToolUse`（AskQuestion / SwitchMode，立即）、`beforeShellExecution` / `beforeMCPExecution`（记待批准标记，`stop` 后再亮红灯）
   - **Claude：** `PermissionRequest`、`Notification`（permission_prompt）、`PreToolUse`（AskUserQuestion 等）
4. **Stop 事件** → 防抖 2.5s 后 → `done`（绿灯）
5. **Session 结束** → `idle`（全灭）

Hook 从 `~/.trafficlight-desk/connection.json` 读取当前监控工具 ID。

---

## UI 视觉层次

```
.traffic-light
└── .traffic-light__glass      ← 外层毛玻璃（backdrop-filter + 渐变）
    └── .traffic-light__shell  ← 内层深色壳（渐变 + 细描边）
        ├── ToolLogo
        ├── 红 / 黄 / 绿 灯座
        └── 悬停状态标签
```

设计原则：

- 不用 `filter: drop-shadow` 于透明窗口根节点（会在留白区晕开、上下无硬边）
- 窗口尺寸紧贴内容，避免大块透明区造成视觉噪声

---

## 开发与构建

```bash
npm run dev      # Vite :5173 + Electron（TRAFFICLIGHT_DEV=1）
npm run build    # 输出 dist/
npm start        # 生产：加载 dist/index.html
npm run preview  # build + start
npm run dist:mac # macOS DMG → release/
npm run dist:win # Windows 便携 exe → release/
./scripts/pack-win.sh  # 同上（Windows）
./scripts/start.sh     # 本机后台启动（macOS/Linux 开发运维）
```

| 平台 | 产物 | 说明 |
|------|------|------|
| Windows | `release/TrafficLight-Desk-*-win-portable.exe` | 便携版，双击即用 |
| macOS | `release/TrafficLight-Desk-*-mac.dmg` | 标准安装包 |

源码与打包产物目录分离：`release/` 仅存本地构建结果（`.gitignore` 忽略二进制，保留 `release/README.md`）。正式分发走 **GitHub Releases**，不把 exe 提交进仓库。

打包后 Hook 脚本路径由 `desktop/paths.cjs` 解析（`extraResources` 中的 `cursor-hooks/`）。

---

## 安全与隐私

- HTTP 服务仅监听 `127.0.0.1`
- Hook 脚本只向本机端口 POST 状态 JSON
- 不读取用户项目源码，不上传数据
- 断开连接会移除已写入的 Hook 条目
