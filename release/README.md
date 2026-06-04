# 打包产物目录

本目录用于存放 **electron-builder 生成的可执行文件**，与源码分离。

| 文件 | 说明 |
|------|------|
| `TrafficLight-Desk-*-win-portable.exe` | Windows 便携版（双击即用） |
| `TrafficLight-Desk-*-mac.dmg` | macOS 安装包（`npm run dist:mac`） |
| `win-unpacked/` | Windows 解压中间目录（可删，打包时自动生成） |

## 生成方式

```bash
npm run dist:win    # Windows exe
npm run dist:mac    # macOS dmg
./scripts/pack-win.sh
```

## 分发

- **GitHub Releases** 提供正式下载（推荐给用户）
- 本目录文件 **不提交 Git**（见根目录 `.gitignore`），避免仓库体积膨胀
