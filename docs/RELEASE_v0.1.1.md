## TrafficLight Desk v0.1.1

桌面 AI 状态监视器 — 悬浮红绿灯，一眼知道 Agent 是在干活、等你操作，还是已经跑完。

📖 **[用户使用指南](https://github.com/themender69-commits/TrafficLight-Desk/blob/main/docs/USER_GUIDE.md)**（安装、连接、三灯含义、常见问题）

### 下载

| 平台 | 文件 |
|------|------|
| **macOS** (Apple Silicon) | `TrafficLight-Desk-0.1.1-mac.dmg` |
| **Windows** (x64 便携版) | `TrafficLight-Desk-0.1.1-win-portable.exe` |

> macOS 未签名：首次请 **右键 → 打开**。Windows 若 SmartScreen 拦截：「更多信息」→「仍要运行」。

### 三灯速查

- 🟡 黄灯 — AI 执行中
- 🔴 红灯 — 需回 IDE 点确认（有提示音）
- 🟢 绿灯 — 本轮结束，可验收（有提示音）

### 本版主要更新

- Node 单一状态机，灯效与音效更同步
- App / Hook 版本锁与「关于」信息
- UI：SSE 实时刷新、菜单交互优化
- Windows 安装脚本；Mac 窗口显示修复

完整变更见 [CHANGELOG.md](https://github.com/themender69-commits/TrafficLight-Desk/blob/main/CHANGELOG.md)。
