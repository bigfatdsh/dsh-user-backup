/**
 * sync.mjs —— 把本机 desktop profile 的插件快照同步进这份「用户备份」
 *
 * 这份备份是给「换台机器/重装」用的可还原快照：plugins.tar.gz 里放着所有**仓库内**插件
 * （npm 上的不复制，只记版本），外加 profile 的 patch 层、几个插件设置文件和 BACKUP.json 清单。
 *
 * 它原来是一次性手工做的，插件改了/新装了它不会自己跟。这个脚本把「同步」变成一条命令：
 *
 *   1. 按 BACKUP.json 里 source=vendored 的条目，从 ~/.dsh/profiles/desktop/node_modules
 *      复制当前实现（跟随 link:，所以拿到的是工作区里真实的、带本地补丁的版本）；
 *   2. 新插件在 EXTRA 里登记一次就会出现在备份里（现在是大肥鱼的两件：dsh-fish / dsh-fish-memory）；
 *   3. 刷新 patch/plugins.yml（profile 的 patch 层）与 settings/*.json；
 *   4. 重打 plugins.tar.gz，回填 sha256 与文件数；
 *   5. 更新 BACKUP.json 的时间、node 版本、bundles 与各插件版本。
 *
 * 用法：
 *   node sync.mjs            # 同步
 *   node sync.mjs --dry-run  # 只看会改什么
 *
 * @module dsh-user-backup/sync
 */

import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = homedir()
const DSH_HOME = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== '' ? resolve(process.env.DSH_HOME) : join(HOME, '.dsh')
const PROFILE = join(DSH_HOME, 'profiles', 'desktop')
const MODULES = join(PROFILE, 'node_modules')
const MANIFEST = join(HERE, 'BACKUP.json')
const DRY = process.argv.includes('--dry-run')

/** 不进备份的路径（依赖、版本库、缓存、系统垃圾、打补丁时的备份）。 */
const SKIP = new Set(['node_modules', '.git', '.cache', '.DS_Store', '.turbo'])
const SKIP_PATTERN = /\.(bak|orig|rej|log)$|\.pre-[a-z-]+\.bak$/

/** 这个文件名该不该跳过。 */
function skipName(name) {
  return SKIP.has(name) || SKIP_PATTERN.test(name)
}

/** 磁盘上有、但之前没进备份的插件（第一次同步时手工登记一次，之后自动跟随版本）。 */
const EXTRA = [
  {
    name: 'dsh-fish',
    source: 'vendored',
    purpose: '大肥鱼本体：身份段 / 唤醒与成长账本 / B站 / 桌面与记忆工具（含本地补丁）',
  },
  {
    name: 'dsh-fish-memory',
    source: 'vendored',
    purpose: '记忆库：微信-QQ-房间共享、随时间自然遗忘、聊天进她的账本、历史回填',
  },
  {
    name: 'dsh-wpac',
    source: 'vendored',
    purpose: 'WPAC agent 预设：W/P/A/C 四要素先补全再交付（姜涛）',
  },
  {
    name: 'dsh-cookie-guard',
    source: 'vendored',
    purpose: '清理 DSH 登录 Cookie 累积，修复请求头超过 16KB 后 Web UI 永久打不开',
  },
  {
    name: 'dsh-live2dwaifu',
    source: 'vendored',
    purpose: 'Live2D 桌面角色：眨眼、呼吸、视线跟随、说话嘴动与可拖拽卡片',
  },
]

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** 当前装着的插件目录（跟随 link: 到真实路径）。 */
function installedDir(name) {
  const dir = join(MODULES, name)
  if (!existsSync(dir)) return ''
  try {
    return realpathSync(dir)
  } catch {
    return ''
  }
}

function packageVersion(dir) {
  try {
    return String(readJson(join(dir, 'package.json')).version ?? '')
  } catch {
    return ''
  }
}

/**
 * 递归复制，跳过依赖/缓存。
 *
 * 用 lstat 判类型并跳过符号链接：插件目录里若出现指向自身的软链（安装器有时会造），
 * stat 会把它当目录一路跟进，直到路径超长——2026-10-29 备份里 dsh-wpac 因此涨到 363 个文件。
 */
function copyTree(from, to) {
  let files = 0
  let skippedLinks = 0
  const walk = (src, dst) => {
    if (!existsSync(src)) return
    const stat = lstatSync(src)
    if (stat.isSymbolicLink()) {
      skippedLinks += 1
      return
    }
    if (stat.isDirectory()) {
      if (skipName(src.slice(src.lastIndexOf('/') + 1))) return
      mkdirSync(dst, { recursive: true })
      for (const name of readdirSync(src)) walk(join(src, name), join(dst, name))
      return
    }
    if (skipName(src.slice(src.lastIndexOf('/') + 1))) return
    mkdirSync(dirname(dst), { recursive: true })
    cpSync(src, dst)
    files += 1
  }
  walk(from, to)
  if (skippedLinks > 0) console.log(`  ! 跳过 ${skippedLinks} 个符号链接（可能是安装器留下的自指软链）`)
  return files
}

/** tar 里的文件数。 */
function countArchive(file) {
  try {
    const out = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' })
    return out.split('\n').filter((line) => line.trim() !== '' && !line.endsWith('/')).length
  } catch {
    return 0
  }
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function main() {
  const manifest = readJson(MANIFEST)
  const pluginsDir = join(HERE, 'plugins')
  mkdirSync(pluginsDir, { recursive: true })

  // 1) 现有条目 + 新登记的两件
  const rows = [...manifest.plugins]
  for (const extra of EXTRA) {
    if (!rows.some((row) => row.name === extra.name)) rows.push({ ...extra })
  }

  let updated = 0
  let missing = 0
  const gone = []
  for (const row of rows) {
    const dir = installedDir(row.name)
    const version = dir === '' ? '' : packageVersion(dir)
    if (version !== '' && version !== row.version) {
      if (!DRY) row.version = version
      updated += 1
    }
    if (row.source !== 'vendored') continue
    if (dir === '') {
      missing += 1
      gone.push(row)
      console.log(`  ! ${row.name} 没装，从清单里去掉（--keep-missing 可保留）`)
      continue
    }
    const target = join(HERE, row.dir ?? join('plugins', row.name))
    row.dir ??= join('plugins', row.name)
    if (!DRY) {
      rmSync(target, { recursive: true, force: true })
      const files = copyTree(dir, target)
      console.log(`  ✓ ${row.name.padEnd(32)} ${String(row.version).padEnd(14)} ${files} 个文件`)
    } else {
      console.log(`  · ${row.name.padEnd(32)} 会从 ${dir} 复制`)
    }
  }

  // 没装的 vendored 插件不留在清单里：留着等于告诉还原者「装这个」，但它已经不在当前 profile。
  if (gone.length > 0 && !process.argv.includes('--keep-missing')) {
    for (const row of gone) {
      if (!DRY) rmSync(join(HERE, row.dir ?? join('plugins', row.name)), { recursive: true, force: true })
      const index = rows.indexOf(row)
      if (index >= 0) rows.splice(index, 1)
    }
  }

  // 2) profile 的 patch 层
  const patchFile = join(PROFILE, 'cordis.patch.yml')
  if (existsSync(patchFile)) {
    const text = readFileSync(patchFile, 'utf8')
    if (!DRY) {
      mkdirSync(join(HERE, 'patch'), { recursive: true })
      writeFileSync(join(HERE, 'patch', 'plugins.yml'), text, 'utf8')
    }
    console.log(`  ✓ patch/plugins.yml  ${text.split('\n').length} 行`)
  }

  // 3) 设置文件
  for (const entry of manifest.settings ?? []) {
    const base = entry.location === 'profile' ? PROFILE : DSH_HOME
    const source = join(base, entry.target)
    if (!existsSync(source)) {
      console.log(`  ! ${entry.file} 源不存在（${source}），保留旧副本`)
      continue
    }
    if (!DRY) {
      mkdirSync(dirname(join(HERE, entry.file)), { recursive: true })
      cpSync(source, join(HERE, entry.file))
    }
    console.log(`  ✓ ${entry.file}`)
  }

  // 4) 重打 tar
  const archive = join(HERE, manifest.payload?.archive ?? 'plugins.tar.gz')
  if (!DRY) {
    rmSync(archive, { force: true })
    execFileSync('tar', ['-czf', archive, 'plugins'], { cwd: HERE })
    manifest.payload = { archive: manifest.payload?.archive ?? 'plugins.tar.gz', sha256: sha256(archive), files: countArchive(archive) }
    console.log(`  ✓ ${manifest.payload.archive}  ${(statSync(archive).size / 1024 / 1024).toFixed(1)} MB / ${manifest.payload.files} 个文件`)
  }

  // 5) 清单
  const profileJson = readJson(join(PROFILE, 'package.json'))
  const bundles = profileJson.dsh?.profile?.bundles ?? manifest.bundles
  const baseBundles = (bundles ?? []).filter((name) => name.startsWith('@deepseek-ai/'))
  manifest.baseBundles = baseBundles
  manifest.bundles = (bundles ?? []).filter((name) => !name.startsWith('@deepseek-ai/'))
  manifest.dsh = { ...manifest.dsh, node: process.version }
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  // createdAt 只在首次生成时写一次；每次同步刷新 updatedAt（之前误把 createdAt 当成同步时间覆盖了）。
  manifest.createdAt ??= stamp
  manifest.updatedAt = stamp
  // 保持原清单顺序（README 的编号表跟着它走），新插件追加在末尾。
  manifest.plugins = rows
  if (!DRY) writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(`\n${DRY ? '[dry] ' : ''}插件 ${rows.length} 个（vendored ${rows.filter((row) => row.source === 'vendored').length}）· 版本更新 ${updated} · 缺失 ${missing} · bundles ${manifest.bundles.length}`)
  console.log(DRY ? '没有写任何文件。' : `同步完成：${manifest.updatedAt}`)
}

main()
