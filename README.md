# 用户备份

DeepSeek Harness 桌面版（desktop profile）当前**全部 11 个插件的可还原快照**。装回这套插件只需一条命令；以后说「安装 GitHub 上的用户备份」，按本文件操作即可。

- 快照时间：2026-10-25 13:09（UTC+8）
- DSH 版本：0.2.1-rc.3 · macOS arm64
- 备份时状态：11 个插件全部加载成功、组件状态「运行中」

## 包含的插件

| # | 插件 | 版本 | 来源 | 作用 |
|---|---|---|---|---|
| 1 | dsh-whale-widget | 0.4.2 | npm | 右下角余额/用量小鲸鱼挂件 |
| 2 | dsh-orb | 0.1.9 | npm | 桌面悬浮球 + Computer Use 预设 + 后台 code_agent |
| 3 | dsh-univer-office | 0.3.7 | npm | Univer 文档/表格/幻灯片工具与实时预览 |
| 4 | dsh-session-cost | 1.0.1 | 仓库内 | 本轮/本会话花费、缓存命中、峰谷价 |
| 5 | dsh-tool-token-optimizer | 1.0.14 | 仓库内 | 工具结果落盘前压缩（默认 1600 字符内联预算） |
| 6 | dsh-exec-optimizer | 1.0.0 | 仓库内 | 执行优化：并行/重试/截断/按需加载/防复读 |
| 7 | dsh-computer-use-turbo | 1.0.0 | 仓库内 | Computer Use 会话加速：截图去重、压缩策略段 |
| 8 | dsh-optimizer | 4.8.0 | 仓库内 | 推理等级 auto、精简化输出、花费预警面板 |
| 9 | dsh-free-image | 1.1.0 | 仓库内 | `image_generate` 工具（公网 Pollinations / 本机 SD） |
| 10 | dsh-free-image-max | 1.0.0 | 仓库内 | `image_generate` 优化层：公网优先、提示词扩写、交付校验 |
| 11 | dsh-univer-turbo | 1.0.9 | 仓库内 | Univer 调用提速降耗：单门面工具 + 结果压缩 + 批量 |

npm 的三个包按**精确版本**从 registry 安装；其余 8 个在 `plugins.tar.gz` 里，解包后以 `link:` 方式装进 profile。所有插件运行时依赖为零或用 registry 依赖，不包含 `node_modules`。

## 安装

前提：已装 DeepSeek Harness，并至少启动过一次（这样 `~/.dsh/profiles/desktop` 已存在）。

```bash
git clone https://github.com/bigfatdsh/dsh-user-backup.git
cd dsh-user-backup
node install.mjs
```

然后**完全退出并重启 DeepSeek Harness**。

- 仓库是 private：clone 前需要本机已登录自己的 GitHub 账号。本机 `github.com` 直连不通时，用 API 下载：`GET https://api.github.com/repos/bigfatdsh/dsh-user-backup/tarball`（需要 token），或让 DSH 代理代取。
- 安装脚本要写 `~/.dsh`。**不要在本仓库里用 DSH 的沙箱 shell 跑**（沙箱只允许写工作区，会报 EPERM）；请在「终端」里跑，或让 DSH 以完整文件权限执行。
- 只想看会执行什么、不改文件：`node install.mjs --dry-run`。

### 脚本做了什么

1. 解包 `plugins.tar.gz`（如果 `plugins/` 不存在）。
2. 用 DSH 自带 pnpm 执行 `dsh plugin --profile desktop add`，一次装 11 个包。
3. 把 11 个插件写进 `package.json` 的 `dsh.profile.bundles`（顺序与备份一致；已有的其它 bundle 会保留）。
4. 只补**缺失**的插件设置：`optimizer.json`、`exec-optimizer.json`、`orb-avatar.json`（已有文件不覆盖；`--no-settings` 可关闭）。
5. 动手前把现有 `package.json` / `cordis.patch.yml` 备份到 `~/.dsh/profiles/desktop/.user-backup-<时间>/`。

### 没有包含什么

- 会话、账号、附件、插件运行缓存（Univer Gateway、orb 的 Electron runtime、SD 模型等按需自动准备）。
- 用户层 `cordis.patch.yml` 的界面偏好（transcriptView、默认模型、开发者工具开关）。那是 profile 设置，不是插件，故意不动。
- `~/.dsh` 里其它插件状态文件（`.dshw-*`、`floating-session.json` 等）。

### 怎么确认装好了

重启后打开「插件 → 已安装插件」：应有 11 个插件；逐个点进去，组件状态应为「运行中」（dsh-orb 是 4 个组件全绿）。功能上可快速看：输入框下有钱数（session-cost）、右下角有鲸鱼挂件（whale）、工具列表里有 `image_generate` 和单个 `univer` 门面工具（univer-turbo 接管了 14 个 univer_* 工具）。

## 给 DSH 代理的说明

用户说「安装 GitHub 上的用户备份」时：

1. 仓库 `bigfatdsh/dsh-user-backup`（private）。本机 `github.com` 不可直连，`api.github.com` 可用；用 token 走 API 取 `tarball`，或用 codeload。
2. 解包后运行 `node install.mjs`。安装会写 `~/.dsh`，必须用完整文件权限（`danger-full-access` 或在系统终端执行）。
3. 装完必须重启 DSH（profile 只在启动时装载）。
4. 重启后按上面「怎么确认装好了」核对，插件缺一个都不算完成。
