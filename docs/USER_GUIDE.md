# TrafficLight Desk 用户使用指南

> 面向 **下载安装包即可使用** 的用户。开发者文档见根目录 [README.md](../README.md)。

---

## 这是什么？

TrafficLight Desk 是一个 **桌面悬浮红绿灯**，监视 Cursor、Codex、Claude Code 等 AI 工具的运行状态：

| 灯色 | 含义 | 你该做什么 |
|------|------|------------|
| 🟡 **黄灯** | AI 正在执行 | 别催，等它跑完 |
| 🔴 **红灯** | 需要你点界面 | 切回 IDE 点 Run / Allow / 回答问题 |
| 🟢 **绿灯** | 本轮结束 | 可以去看结果、验收 |
| ⚫ **全灭** | 待命 | 尚未开始或已结束会话 |

**特点：** 纯本机运行、不联网、不读你的项目代码，只通过官方 Hook 感知状态。

---

## 下载与安装

前往 **[GitHub Releases](https://github.com/themender69-commits/TrafficLight-Desk/releases)**，选择对应系统：

| 系统 | 文件 | 用法 |
|------|------|------|
| **Windows** | `TrafficLight-Desk-*-win-portable.exe` | 双击运行，无需安装 |
| **macOS** | `TrafficLight-Desk-*-mac.dmg` | 打开 DMG，拖入「应用程序」 |

### 首次打开被拦截？

- **Windows SmartScreen**：点「更多信息」→「仍要运行」
- **macOS 未签名**：右键 App → **打开**（仅需一次）

### 系统要求

- **Windows**：需已安装 [Git for Windows](https://git-scm.com/download/win)（Cursor 通常自带 Bash）；需 **Python**（`python` 或 `python3`）供 Hook 通信
- **macOS**：系统自带 Python 3 一般即可

---

## 第一次使用（3 步）

### 1. 启动 App

- 运行 exe 或从「应用程序」打开 TrafficLight Desk
- 窗口在 **屏幕右上角**（竖条红绿灯）
- 找不到时：看 **Dock / 任务栏** 图标，或 **菜单栏 / 托盘** 里的三圆点图标

### 2. 连接 AI 工具

1. 点击红绿灯 **顶部的 Logo**
2. 在左侧菜单选择 **Cursor** / **Codex** / **Claude Code**
3. 在弹窗中 **允许** 安装 Hook（仅改本地配置文件，不联网）

连接成功后，Logo 右下角会出现 **绿点**（表示 Hook 近期有回调、监控有效）。

### 3. 正常使用 Cursor / Claude

之后无需再操作 App，看灯即可：

- Agent 自动读文件、搜索 → **黄灯**
- 出现 Run / Allow 确认框 → **红灯** + 提示音
- 回复结束 → **绿灯** + 提示音

---

## 界面说明

### 红绿灯本体

- **顶部 Logo**：点击打开工具菜单；绿点 = 监控中，灰点 = 未连接或未激活
- **三盏灯**：当前 Agent 状态
- 悬停可看到简短状态说明

### 侧边菜单（点 Logo 打开）

- **选择监控对象**：切换 Cursor / Codex / Claude
- **断开连接**：卸载 Hook，恢复 IDE 原状
- **关于**：App 版本、Hook 是否已同步
- **重启 / 退出**
- 点菜单 **外空白处** 或按 **Esc** 可关闭菜单

### 系统托盘（菜单栏 / 任务栏）

- 点击托盘图标可 **显示红绿灯** 或切换连接的工具

---

## 音效说明

| 状态 | 音效 |
|------|------|
| 黄灯 | 无声 |
| 红灯 | Tink（请回界面操作） |
| 绿灯 | Glass（本轮完成） |

---

## 版本与 Hook 同步

在菜单底部「关于」可看到：

- **v0.x.x** — App 版本
- **Hook 已同步** — App 与已安装 Hook 版本一致
- **Hook 需更新** — 请断开并重新连接，或重启 App（会自动尝试同步）

一般 **每次发新版后**，在 App 里 **重新连接一次** 即可。

---

## 常见问题

### 窗口找不到？

- **macOS**：看 Dock 是否有图标；点菜单栏托盘 🚦；或重新打开 App
- 窗口默认在 **屏幕右上角**，可能被其他窗口挡住

### 灯不变 / 一直是灰点？

1. 确认菜单里已 **连接** 对应工具
2. 在 Cursor 里 **实际跑一条 Agent 任务**（发一条 prompt）
3. 仍无效：**断开 → 重新连接**；或重启 App

### Windows 连接失败？

- 安装 [Git for Windows](https://git-scm.com/download/win)
- 确认已至少 **打开过一次 Cursor**，存在 `%USERPROFILE%\.cursor`
- 可手动运行（PowerShell）：
  ```powershell
  powershell -ExecutionPolicy Bypass -File agent-hooks\install-hooks.ps1
  ```
  （需从源码目录运行；便携版用户优先用 App 内连接）

### 红灯该亮不亮 / 误亮？

- 确认使用的是 **Releases 里最新版** App 与 Hook 已同步
- 到 [Issues](https://github.com/themender69-commits/TrafficLight-Desk/issues) 反馈 Cursor 版本与场景

### 如何彻底卸载？

1. App 内 **断开连接**（会移除 Hook 配置）
2. 删除 App / exe
3. 可选：删除 `~/.trafficlight-desk`（或 Windows 下 `%USERPROFILE%\.trafficlight-desk`）中的状态文件

---

## 隐私与安全

- **不联网**：状态只在 `127.0.0.1:9876` 与本机文件间传递
- **Hook 范围**：仅向 `hooks.json` / `settings.json` 增加 TrafficLight 条目，并读写 `~/.trafficlight-desk/`
- **不访问** 你的代码仓库内容、API Key 或云端账号

---

## 获取帮助

- 更新记录：[CHANGELOG.md](../CHANGELOG.md)
- 问题反馈：[GitHub Issues](https://github.com/themender69-commits/TrafficLight-Desk/issues)
- 最新下载：[GitHub Releases](https://github.com/themender69-commits/TrafficLight-Desk/releases)
