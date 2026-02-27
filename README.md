# BiliLottery

Bilibili 评论区抽奖工具，面向 UP 主。支持 CLI 命令行与 Electron GUI 桌面端两种使用方式。

## 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm

### 安装依赖

```bash
pnpm install
```

### 开发运行

```bash
# CLI
pnpm dev:cli

# GUI (Electron)
pnpm dev:gui
```

### 构建

```bash
pnpm build          # tsc + vite
pnpm bundle:cli     # esbuild → dist/ (CLI)
pnpm bundle:gui     # esbuild → dist/ (GUI)
```

## CLI 使用

```bash
# 登录（扫码后保存 cookie 到配置文件）
bili_lottery login -o config.json

# 抽奖
bili_lottery lottery <oid> <type> [mode] -i config.json
```

- `oid` — 动态/视频 ID
- `type` — 评论区类型
- `mode` — 排序模式，默认 `2`（按时间）

## 技术栈

- **语言**：TypeScript
- **运行时**：Node.js / Electron
- **前端**：Vue 3 + Vite
- **包管理**：pnpm
- **打包**：esbuild (CJS) → @yao-pkg/pkg (CLI) / electron-builder (GUI)

## 项目结构

```
src/
├── bili/           # B 站 API 层
├── app/            # 应用服务层（CLI/GUI 共享）
├── shared/         # 跨进程共享类型
├── cli/            # CLI 入口
├── gui/
│   ├── types.ts    # IPC 契约
│   ├── main/       # Electron 主进程
│   ├── preload/    # contextBridge
│   └── renderer/   # Vue 页面
scripts/            # 打包 & 发布脚本
```