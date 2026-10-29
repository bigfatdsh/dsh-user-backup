# 用户备份

DeepSeek Harness 桌面版（desktop profile）当前全部插件的可还原快照：**21 个插件（17 个仓库内 + 4 个 npm）+ 5 个内置 bundle + 插件相关的 profile override**。装回这套配置只需一条命令；以后说「安装 GitHub 上的用户备份」，按本文件操作即可。

- 快照时间：2026-10-29 19:05（UTC+8）
- DSH 版本：0.2.1-rc.3 · macOS arm64 · Node 24
- 备份时状态：21 个插件均由当前 desktop profile 装载；bili-scroll 的 `bili_*` 工具已在会话里可用；3 个内置实验性插件已开启；大肥鱼（微信/QQ）链路完整
- 本版变更：新增 **dsh-wpac** 2.4.0（WPAC agent 预设：W/P/A/C 四要素，入口追问 + 执行中卡点补问；预设排第一张卡；技能装进 ~/.dsh/skills/wpac；作者姜涛；独立仓库 bigfatdsh/dsh-wpac）；新增 **dsh-fish**（大肥鱼本体，含本地补丁）与 **dsh-fish-memory**（记忆库）；`dsh-bili-scroll`/`dshmarket` 版本钉死；预设清理（删掉重复的 whale-fish，连旧的大肥鱼预设也一并删了，只剩 6 个预设）；`wechat_send_voice` 在 mac 上可用（edge-tts 声线）

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
| 9 | dsh-sd-bridge-mac | 1.0.0 | 仓库内 | SD 生图桥（macOS 原生）：A1111/Forge 文生图/图生图/蒙版重绘/模型清单/服务管理 |
| 10 | dsh-sd-turbo | 1.0.0 | 仓库内 | SD 加速层：结果缓存、并发合并、串行队列、自动档位（8 步 / LCM 4 步）、重试 |
| 11 | dsh-univer-turbo | 1.0.9 | 仓库内 | Univer 调用提速降耗：单门面工具 + 结果压缩 + 批量 |
| 12 | dsh-oil-ui | 0.4.0 | 仓库内 | Oil UI 设计技能与工具：风格探索、截图、评审 |
| 13 | dsh-wechat-media | 1.6.3 | 仓库内 | 微信桥：iLink 扫码登录、收发文本/文件/语音，每个联系人一个会话 |
| 14 | dsh-wechat-media-turbo | 0.1.0 | 仓库内 | 微信精简 preset（鲸鱼娘·大肥鱼）：精简工具集与短回复 |
| 15 | dsh-bili-scroll | 2.2.0 | npm | 每天刷一轮 B 站：读字幕挑值得的、写日报、值得的 @ 你 |
| 16 | dsh-plugin-fast | 1.0.0 | 仓库内 | 装插件的快车道：一次调用完成安装、登记与体检 |
| 17 | @alanzhao/dsh-memory-lite | 0.4.1-adapted.1 | 仓库内 | 轻量记忆：Markdown 记忆文件 + 目录索引（L0 上限 800 token） |
| 18 | dsh-yishi-whale | 0.4.26-whale.1 | 仓库内 | 忆时适配版：跨会话增量记忆，只挂进 whale-lean 预设 |
| 19 | dshmarket | 1.70.2 | npm | 可视化插件市场：浏览、搜索、一键装 |
| 20 | dsh-pet | 0.3.8 | npm | 桌面宠物：动画、余额气泡、碎碎念 |
| 21 | dsh-fish | 0.6.1 | 仓库内 | 大肥鱼本体：身份段、唤醒与成长账本、B站、桌面与记忆工具（含本地补丁） |
| 22 | dsh-fish-memory | 0.1.0 | 仓库内 | 记忆库：微信/QQ/房间共享、随时间自然遗忘、聊天进她的账本、历史回填 |
| 23 | dsh-wpac | 2.4.0 | 仓库内 | WPAC agent 预设：W/P/A/C 四要素先补全再交付，缺项带选项追问（作者姜涛） |

npm 的四个包按**精确版本**从 registry 安装；其余 17 个在 `plugins.tar.gz` 里，解包后以 `link:` 方式装进 profile。

## 怎么同步这份备份

插件有增删或本地补丁有改动后，在本仓库里跑：

```bash
node sync.mjs --dry-run   # 先看会改什么
node sync.mjs             # 重打 plugins.tar.gz、刷新 patch/settings、回填 BACKUP.json
node publish.mjs          # 推到 GitHub（本机 github.com 直连不通，走 api.github.com）
```

`sync.mjs` 按 `BACKUP.json` 里 `source: vendored` 的条目，从 `~/.dsh/profiles/desktop/node_modules`
复制**当前实现**（跟随 `link:`，所以拿到的是工作区里带本地补丁的版本）；新插件在脚本的
`EXTRA` 里登记一次即可。`publish.mjs` 只推有变化的文件（按 git blob 比对），每文件一个提交。

## 内置实验性插件

这三个是 DSH 自带、只是被打开的 bundle，安装器只把它们写进 `dsh.profile.bundles`：

- `@deepseek-ai/dsh-experimental-auto-review` — 自动授权审查
- `@deepseek-ai/dsh-experimental-session-search` — 让 Agent 搜索/读取旧会话
- `@deepseek-ai/dsh-experimental-plugin-market-bundle` — 自定义插件市场与 Discover

## 安装

前提：已装 DeepSeek Harness，并至少启动过一次（`~/.dsh/profiles/desktop` 已存在）。

```bash
git clone https://github.com/bigfatdsh/dsh-user-backup.git
cd dsh-user-backup
node install.mjs
```

然后**完全退出并重启 DeepSeek Harness**。

- 仓库是**公开**的，不需要登录即可浏览；`git clone` 或直接下 ZIP 都行。本机 `github.com` 直连不通时，用 API 下载：`GET https://api.github.com/repos/bigfatdsh/dsh-user-backup/tarball`（公开仓库不需要 token）。
- 安装脚本要写 `~/.dsh`。**不要在本仓库里用 DSH 的沙箱 shell 跑**（沙箱只允许写工作区，会报 EPERM）；请在「终端」里跑，或让 DSH 以完整文件权限执行。
- 只想看会执行什么、不改文件：`node install.mjs --dry-run`。

### 脚本做了什么

1. 解包 `plugins.tar.gz`（如果 `plugins/` 不存在）。
2. 用 DSH 自带 pnpm 执行 `dsh plugin --profile desktop add`，一次装 20 个包。
3. 把 21 个 bundle 写进 `package.json` 的 `dsh.profile.bundles`（顺序与备份一致；已有的其它 bundle 会保留）。
4. 合并 `compatibility.json` 里的插件版本豁免（`dsh-oil-ui@0.4.0`、`dsh-bili-scroll@2.2.0`、`dsh-plugin-fast@1.0.0` 在当前 DSH 版本上需要它，否则会被跳过）。
5. 把 `patch/plugins.yml` 里目标 profile 还没有的 override 追加到 `cordis.patch.yml`（当前是 `univer` 的 `autoOpenLivePreview: false`、`memory-lite` 的索引与抽取配置、`bili-scroll` 的刷视频配置）。
6. 只补**缺失**的插件设置：`optimizer.json`、`exec-optimizer.json`、`orb-avatar.json`（已有文件不覆盖；`--no-settings` 可关闭）。
7. 动手前把现有 `package.json` / `cordis.patch.yml` 备份到 `~/.dsh/profiles/desktop/.user-backup-<时间>/`。

### 没有包含什么

- SD 模型本体（AWPainting 等，按需自己放；插件只带桥）。
- **微信登录态**：`~/.dsh/dsh-wechat-media/` 里的账号、好友、日志（含凭据）故意不备份；恢复后要在微信桥里重新扫码登录。
- **B 站登录态**：`~/.dsh/bili-duty/` 里的 `bili_credential.json`、扫码图、已刷记录不备份；恢复后跑 `bili_login_start` 重新扫码。
- **记忆库**：`~/.agent-memory/` 里 memory-lite / 忆时攒下的记忆文件是运行数据，不在备份里（恢复后从空记忆开始）。
- 会话、附件、插件运行缓存（Univer Gateway、orb 的 Electron runtime、SD 模型等按需自动准备）。
- 用户层 `cordis.patch.yml` 的界面偏好（transcriptView、默认模型、开发者工具开关）——备份只带插件相关的 override。

### 怎么确认装好了

重启后打开「插件 → 已安装插件」：应有 21 个插件，逐个点进去组件状态为「运行中」（dsh-orb 是 4 个组件全绿）；「实验性插件」里自动授权审查、会话搜索、插件市场三项应开启。

功能上可快速看：

- 输入框下有钱数（session-cost）、右下角有鲸鱼挂件（whale）；
- 工具列表里有 `sd_draw`、`sd_img2img`、`sd_inpaint`、`sd_models`、`sd_status`、`sd_turbo_status`、单个 `univer` 门面工具（univer-turbo 接管了 14 个 `univer_*`）、`oil_ui_*`、`wechat_status`、`bili_run`/`bili_search`/`bili_subtitle`/`bili_comments`/`bili_cover`；
- A1111 的 API 在 `http://127.0.0.1:7860`；`sd_status` 能看在线状态与模型。
- 技能目录里有 `oil-ui`。

## SD 出图还需要什么（重要）

备份只包含插件，不包含 A1111 与模型：

1. 本机已装 AUTOMATIC1111 1.10.1（`~/stable-diffusion-webui`）和 SD1.5 模型 AWPainting_v1.2；
2. 没启动时插件会自动 `webui.sh --api ...` 拉起（首次 30–60 秒）；
3. 8GB M1：默认 512²/8 步约 30 秒；`sd_turbo_status` 的 fast 档约 18 秒。

测评与实测见 `plugins/dsh-sd-bridge-mac/EVALUATION.md`。

## 兼容性注意

`dsh-oil-ui@0.4.0` 声明 `engines.dsh = 0.2.1-rc.2`，而当前 DSH 是 0.2.1-rc.3；`dsh-bili-scroll@2.2.0` 声明 `>=0.1.7-rc.1`，但预发布版本比较同样会被判不兼容；`dsh-plugin-fast@1.0.0` 也已在豁免表里。备份里带了 profile 的 `compatibility.json` 豁免，恢复后可以正常加载。**DSH 升级到新版本后这些豁免会失效**，届时需要重新授权（`dsh plugin allow-version` 或插件管理器里的对应入口），否则 oil-ui、bili-scroll 会被跳过。

## 给 DSH 代理的说明

用户说「安装 GitHub 上的用户备份」时：

1. 仓库 `bigfatdsh/dsh-user-backup`（公开）。本机 `github.com` 不可直连，`api.github.com` 可用；走 API 取 `tarball`（公开仓库无需 token），或用 codeload。
2. 解包后运行 `node install.mjs`。安装会写 `~/.dsh`，必须用完整文件权限（`danger-full-access` 或在系统终端执行）。
3. 装完必须重启 DSH（profile 只在启动时装载）。
4. 重启后按上面「怎么确认装好了」核对：21 个插件 + 3 个内置实验性插件 + compatibility 豁免，缺一项都不算完成。
