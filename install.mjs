#!/usr/bin/env node
/**
 * 用户备份安装器 —— 把本仓库记录的 DSH 插件全部装回 desktop profile。
 *
 * 用法：
 *   node install.mjs                 # 安装到 ~/.dsh/profiles/desktop
 *   node install.mjs --dry-run       # 只打印将要执行的命令，不改任何文件
 *   node install.mjs --profile web   # 装到别的 profile（一般不需要）
 *   node install.mjs --no-settings   # 不恢复插件设置快照
 *
 * 需要：macOS + 已安装 DeepSeek Harness；对 ~/.dsh 有写权限（在系统终端里跑，
 * 不要在 DSH 自己的沙箱 shell 里跑，那样写 ~/.dsh 会被拒绝）。
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const option = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

const dryRun = flag('--dry-run')
const restoreSettings = !flag('--no-settings')
const profileName = option('--profile', 'desktop')
const dshHome = process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : join(homedir(), '.dsh')
const profileDir = join(dshHome, 'profiles', profileName)

const fail = (message) => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

/** 读取清单。 */
const backup = JSON.parse(readFileSync(join(HERE, 'BACKUP.json'), 'utf8'))
const profileManifest = join(profileDir, 'package.json')

if (!existsSync(profileManifest)) {
  fail(
    `找不到 profile：${profileDir}\n` +
      `  请先启动一次 DeepSeek Harness（它会创建 ${profileName} profile），再运行本脚本。`,
  )
}

/** 解包 plugins.tar.gz（如果 plugins/ 还没解出来）。 */
const pluginsRoot = join(HERE, 'plugins')
if (!existsSync(pluginsRoot)) {
  const archive = join(HERE, backup.payload.archive)
  if (!existsSync(archive)) fail(`缺少 ${backup.payload.archive}，无法还原插件目录。`)
  console.log(`· 解包 ${backup.payload.archive}`)
  if (!dryRun) {
    const tar = spawnSync('tar', ['-xzf', archive, '-C', HERE], { stdio: 'inherit' })
    if (tar.status !== 0) fail('解包失败：请确认 tar 可用，且仓库文件完整。')
  }
}

/** 把清单里的插件翻译成 pnpm 安装参数。 */
const specs = backup.plugins.map((plugin) => {
  if (plugin.source === 'npm') return `${plugin.name}@${plugin.version}`
  if (plugin.tarball) {
    const file = join(HERE, plugin.tarball)
    if (!existsSync(file) && !dryRun) fail(`清单里的 ${plugin.name} 需要 ${plugin.tarball}，但该文件不存在。`)
    return `file:${file}`
  }
  const dir = join(HERE, plugin.dir)
  if (!existsSync(dir) && !dryRun) fail(`清单里的 ${plugin.name} 指向 ${plugin.dir}，但该目录不存在。`)
  return `link:${dir}`
})

/** 找到 DSH CLI：优先 PATH 里的 dsh，其次桌面版自带的位置。 */
function findDsh() {
  if (process.env.DSH_BIN) return process.env.DSH_BIN
  const which = spawnSync('sh', ['-lc', 'command -v dsh'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim() !== '') return which.stdout.trim()
  const macApp = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh'
  if (existsSync(macApp)) return macApp
  return undefined
}

const dsh = findDsh()
const installCommand = dsh
  ? [dsh, 'plugin', '--profile', profileName, 'add', ...specs]
  : ['pnpm', '--dir', profileDir, 'add', ...specs]

/** 备份现有 profile 清单，出问题能退回去。 */
function snapshotProfile() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(profileDir, `.user-backup-${stamp}`)
  mkdirSync(dir, { recursive: true })
  copyFileSync(profileManifest, join(dir, 'package.json'))
  const patch = join(profileDir, 'cordis.patch.yml')
  if (existsSync(patch)) copyFileSync(patch, join(dir, 'cordis.patch.yml'))
  return dir
}

/** 把插件写进 dsh.profile.bundles，顺序按清单。 */
function ensureBundles() {
  const manifest = JSON.parse(readFileSync(profileManifest, 'utf8'))
  manifest.dsh ??= {}
  manifest.dsh.profile ??= {}
  const current = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles : []
  const wanted = [...backup.baseBundles, ...backup.bundles]
  const merged = [...wanted.filter((name, index) => wanted.indexOf(name) === index)]
  for (const name of current) if (!merged.includes(name)) merged.push(name)
  if (JSON.stringify(current) === JSON.stringify(merged)) return false
  manifest.dsh.profile.bundles = merged
  const tmp = `${profileManifest}.tmp`
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`)
  renameSync(tmp, profileManifest)
  return true
}

/** 只补缺失的插件设置快照，不覆盖现有文件。 */
function restoreSettingsSnapshot() {
  const restored = []
  for (const entry of backup.settings ?? []) {
    if (entry.kind === 'compatibility') continue
    const source = join(HERE, entry.file)
    const base = entry.location === 'profile' ? profileDir : dshHome
    const target = join(base, entry.target)
    if (!existsSync(source) || existsSync(target)) continue
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    restored.push(entry.target)
  }
  return restored
}

/** 合并插件版本豁免（compatibility.json）：只增不覆盖。 */
function mergeCompatibility() {
  const source = join(HERE, 'settings', 'compatibility.json')
  const target = join(profileDir, 'compatibility.json')
  if (!existsSync(source)) return false
  const incoming = JSON.parse(readFileSync(source, 'utf8'))
  const current = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) || {} : {}
  let changed = false
  for (const [plugin, versions] of Object.entries(incoming)) {
    if (!Array.isArray(versions)) continue
    const existing = Array.isArray(current[plugin]) ? current[plugin] : []
    const merged = [...new Set([...existing, ...versions])]
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      current[plugin] = merged
      changed = true
    }
  }
  if (changed) writeFileSync(target, `${JSON.stringify(current, null, 2)}\n`)
  return changed
}

/** 把 patch/plugins.yml 里还没有的插件 override 追加到 profile 补丁末尾。 */
function appendPatchOverrides() {
  const source = join(HERE, 'patch', 'plugins.yml')
  const target = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(source)) return []
  const blocks = []
  let block = []
  for (const line of readFileSync(source, 'utf8').split('\n')) {
    if (/^- id: /.test(line)) {
      if (block.length > 0) blocks.push(block.join('\n'))
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
    }
  }
  if (block.length > 0) blocks.push(block.join('\n'))

  const existing = existsSync(target)
    ? readFileSync(target, 'utf8')
    : '# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries.\n'
  // 空 profile 的补丁层可能是 `[]`；追加条目之前先把它去掉。
  const targetText = /^\s*\[\]\s*$/m.test(existing) ? existing.replace(/^\s*\[\]\s*$/m, '') : existing
  const present = new Set([...targetText.matchAll(/^- id:\s*(\S+)/gm)].map((match) => match[1]))
  const missing = blocks
    .filter((text) => !present.has(/^- id:\s*(\S+)/m.exec(text)[1]))
    .map((text) => text.trimEnd())
  if (missing.length === 0) return []
  writeFileSync(target, `${targetText.trimEnd()}\n\n${missing.join('\n\n')}\n`)
  return missing.map((text) => /^- id:\s*(\S+)/m.exec(text)[1])
}

console.log(`用户备份 · ${backup.plugins.length} 个插件 · 快照 ${backup.createdAt}`)
console.log(`profile: ${profileDir}`)
console.log(`安装器: ${installCommand[0]}`)
console.log('')

const snapshot = dryRun ? undefined : snapshotProfile()
if (snapshot) console.log(`· 已备份现有 profile 清单到 ${snapshot}`)

// 版本豁免必须在安装命令之前写好：dsh plugin add 会先做兼容性校验。
if (!dryRun && mergeCompatibility()) console.log('· 已合并插件版本豁免（compatibility.json）')

console.log(`· 安装 ${specs.length} 个插件${dryRun ? '（演练）' : ''}`)
if (dryRun) {
  console.log(`  ${installCommand.map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ')}`)
  process.exit(0)
}

try {
  execFileSync(installCommand[0], installCommand.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  })
} catch (error) {
  const code = error?.status ?? 'unknown'
  if (String(error?.stderr ?? '').includes('EPERM') || String(error?.message ?? '').includes('EPERM')) {
    fail(
      `安装被文件权限拒绝（EPERM）。\n` +
        `  这通常是因为在 DSH 的沙箱 shell 里运行。请在「终端」里执行：\n` +
        `  cd "${HERE}" && node install.mjs\n` +
        `  或让 DSH 以完整权限运行这条命令。`,
    )
  }
  fail(`安装命令失败（exit ${code}）。上面的 pnpm 输出里有原因；现有 profile 清单已备份，可手工还原。`)
}

const bundlesChanged = ensureBundles()
console.log(bundlesChanged ? '· 已更新 dsh.profile.bundles' : '· dsh.profile.bundles 已是最新')

const settings = restoreSettings ? restoreSettingsSnapshot() : []
if (settings.length > 0) console.log(`· 已补回插件设置：${settings.join(', ')}`)


const overrides = appendPatchOverrides()
if (overrides.length > 0) console.log(`· 已追加插件 override：${overrides.join(', ')}`)

console.log('')
console.log('✓ 安装完成。请完全退出并重新打开 DeepSeek Harness 使插件生效。')
console.log('  重启后到「插件 → 已安装插件」应看到：')
for (const plugin of backup.plugins) console.log(`  - ${plugin.name} v${plugin.version}`)
