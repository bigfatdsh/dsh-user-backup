/**
 * publish.mjs —— 把这份用户备份推到 GitHub（走 api.github.com）
 *
 * 本机到 github.com 的 22 端口不通，git push 用不了；这里用 Contents API 一个文件一个提交。
 * 只推**有变化**的文件：先算本地内容的 git blob sha1，跟远端文件对象的 sha 比，一样就跳过——
 * 所以重复跑不会制造空提交。token 从 macOS 钥匙串取（`security find-internet-password -s github.com`），
 * 不落到文件里、也不打印。
 *
 * 用法：
 *   node publish.mjs            # 推送有变化的文件
 *   node publish.mjs --dry-run  # 只看哪些文件会推
 *
 * 环境变量：REPO（默认 bigfatdsh/dsh-user-backup）、BRANCH（默认 main）。
 *
 * @module dsh-user-backup/publish
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = process.env.REPO ?? 'bigfatdsh/dsh-user-backup'
const BRANCH = process.env.BRANCH ?? 'main'
const DRY = process.argv.includes('--dry-run')
const API = 'https://api.github.com'

/** 仓库里需要同步的文件（相对仓库根）。 */
const FILES = [
  'README.md',
  'BACKUP.json',
  'install.mjs',
  'sync.mjs',
  'publish.mjs',
  'plugins.tar.gz',
  'patch/plugins.yml',
  ...readdirSync(join(HERE, 'settings')).map((name) => `settings/${name}`),
]

function token() {
  try {
    return execSync('security find-internet-password -s github.com -w', { encoding: 'utf8' }).trim()
  } catch {
    console.error('取不到 GitHub token（钥匙串里没有 github.com 的互联网密码）。')
    process.exit(1)
  }
}

/** git blob 的 sha1：远端文件对象的 sha 就是这个。 */
function blobSha(buffer) {
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex')
}

async function api(path, init = {}, auth) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'dsh-user-backup-sync',
      ...(auth === undefined ? {} : { Authorization: `Bearer ${auth}` }),
      ...(init.headers ?? {}),
    },
  })
  return response
}

async function remoteSha(path, auth) {
  const response = await api(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {}, auth)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`)
  const body = await response.json()
  return { sha: body.sha, size: body.size }
}

async function main() {
  const auth = token()
  const pushed = []
  for (const file of FILES) {
    const local = join(HERE, file)
    if (!existsSync(local)) {
      console.log(`  · ${file} 本地没有，跳过`)
      continue
    }
    const buffer = readFileSync(local)
    const want = blobSha(buffer)
    const remote = await remoteSha(file, auth)
    if (remote !== null && remote.sha === want) {
      console.log(`  = ${file} 未变化`)
      continue
    }
    if (DRY) {
      console.log(`  ⇢ ${file} 会推送（${(buffer.length / 1024).toFixed(1)} KB）`)
      pushed.push(file)
      continue
    }
    const response = await api(`/repos/${REPO}/contents/${file}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `sync: 更新用户备份 ${new Date().toISOString().slice(0, 10)}（${relative(HERE, local)}）`,
        content: buffer.toString('base64'),
        branch: BRANCH,
        ...(remote === null ? {} : { sha: remote.sha }),
      }),
    }, auth)
    if (!response.ok) {
      const detail = await response.text()
      console.error(`  ✗ ${file} → ${response.status} ${detail.slice(0, 200)}`)
      process.exitCode = 1
      continue
    }
    console.log(`  ✓ ${file}（${(buffer.length / 1024).toFixed(1)} KB）`)
    pushed.push(file)
  }
  console.log(`\n${DRY ? '[dry] ' : ''}${pushed.length} 个文件${DRY ? '会推送' : '已推送'} · ${REPO}@${BRANCH}`)
}

main().catch((error) => {
  console.error(`推送失败：${error?.message ?? error}`)
  process.exit(1)
})
