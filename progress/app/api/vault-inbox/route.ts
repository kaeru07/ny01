import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const execFileAsync = promisify(execFile)

// 投函指示で固定: GitHub 管理 Vault の 00_inbox に保存
const VAULT_ROOT = '/root/company/obsidian-vault'
const INBOX_DIR = path.join(VAULT_ROOT, '00_inbox')

const TITLE_MAX = 200
const BODY_MAX = 20_000
const ALLOWED_TYPES = new Set(['todo', 'idea', 'note', 'memo'])

type Body = { title?: unknown; body?: unknown; type?: unknown }

/** 認証: Authorization: Bearer <token> を VAULT_INBOX_TOKEN と timing-safe 比較 */
function checkAuth(
  req: NextRequest,
): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.VAULT_INBOX_TOKEN
  if (!expected || !expected.trim()) {
    // トークン未設定環境では絶対に保存しない
    return {
      ok: false,
      status: 503,
      error: 'VAULT_INBOX_TOKEN がサーバに未設定です。設定するまで投函できません。',
    }
  }
  const header = req.headers.get('authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/)
  if (!m) {
    return { ok: false, status: 401, error: 'Authorization: Bearer <token> が必要です' }
  }
  const a = Buffer.from(m[1])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'token が一致しません' }
  }
  return { ok: true }
}

/** title から安全なファイル名スラグを作る（パストラバーサル / 危険文字を除去） */
function safeSlug(title: string): string {
  const stripped = Array.from(title.normalize('NFC'))
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0
      // 制御文字 (0x00-0x1F, 0x7F) を除去
      return !(c <= 0x1f || c === 0x7f)
    })
    .join('')
  const base = stripped
    .replace(/[/\\:*?"<>|]/g, ' ') // パス/予約文字
    .replace(/\.\.+/g, '.') // 連続ドット(..)無効化
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-_]+/, '') // 先頭の . - _ を除去
    .slice(0, 80)
    .trim()
  return base || 'untitled'
}

function frontmatter(title: string, type: string, created: string): string {
  // YAML 値はダブルクオートで包み、内部の " をエスケープ（壊れ防止）
  const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return [
    '---',
    `title: ${q(title)}`,
    `type: ${q(type)}`,
    'source: chatgpt',
    'status: inbox',
    `created: ${created}`,
    '---',
    '',
  ].join('\n')
}

export async function POST(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let parsed: Body
  try {
    parsed = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'JSON ボディが不正です' }, { status: 400 })
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  const bodyText = typeof parsed.body === 'string' ? parsed.body : ''
  const type =
    typeof parsed.type === 'string' && parsed.type.trim() ? parsed.type.trim() : 'todo'

  if (!title) {
    return NextResponse.json({ error: 'title は必須です' }, { status: 400 })
  }
  if (title.length > TITLE_MAX) {
    return NextResponse.json(
      { error: `title が長すぎます (${title.length} > ${TITLE_MAX})` },
      { status: 400 },
    )
  }
  if (!bodyText.trim()) {
    return NextResponse.json({ error: 'body は必須です' }, { status: 400 })
  }
  if (bodyText.length > BODY_MAX) {
    return NextResponse.json(
      { error: `body が長すぎます (${bodyText.length} > ${BODY_MAX})` },
      { status: 400 },
    )
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: `type は ${Array.from(ALLOWED_TYPES).join(' / ')} のいずれか` },
      { status: 400 },
    )
  }

  const now = new Date()
  const created = now.toISOString()
  const ts = created.slice(0, 19).replace(/[:T-]/g, '').slice(0, 14) // YYYYMMDDHHMMSS
  const slug = safeSlug(title)

  await fs.mkdir(INBOX_DIR, { recursive: true })

  const content = frontmatter(title, type, created) + bodyText.trim() + '\n'
  const inboxResolved = path.resolve(INBOX_DIR)

  // 同名衝突回避: wx で既存上書き禁止、衝突したら連番。保存先は 00_inbox 配下に固定
  let fileName = ''
  let absPath = ''
  let saved = false
  for (let i = 0; i < 50 && !saved; i++) {
    const candidate = i === 0 ? `${ts}_${slug}.md` : `${ts}_${slug}-${i}.md`
    const candAbs = path.resolve(INBOX_DIR, candidate)
    if (path.dirname(candAbs) !== inboxResolved) {
      return NextResponse.json({ error: '不正なファイルパス' }, { status: 400 })
    }
    try {
      await fs.writeFile(candAbs, content, { encoding: 'utf-8', flag: 'wx' })
      fileName = candidate
      absPath = candAbs
      saved = true
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue
      return NextResponse.json(
        { error: `Markdown 保存に失敗: ${(e as Error).message}` },
        { status: 500 },
      )
    }
  }
  if (!saved) {
    return NextResponse.json(
      { error: 'ファイル名の衝突回避に失敗しました' },
      { status: 500 },
    )
  }

  // git add / commit / push を試行（execFile = シェル非経由。title/body はコマンドに混ぜない）
  const relForGit = path.join('00_inbox', fileName)
  const git: { committed: boolean; pushed: boolean; error?: string } = {
    committed: false,
    pushed: false,
  }
  try {
    await execFileAsync('git', ['-C', VAULT_ROOT, 'add', '--', relForGit], {
      timeout: 15_000,
    })
    await execFileAsync(
      'git',
      ['-C', VAULT_ROOT, 'commit', '-m', `inbox: ChatGPT投函 ${slug} (${ts})`, '--', relForGit],
      { timeout: 15_000 },
    )
    git.committed = true
    await execFileAsync('git', ['-C', VAULT_ROOT, 'push', 'origin', 'main'], {
      timeout: 30_000,
    })
    git.pushed = true
  } catch (e) {
    const err = e as Error & { stderr?: string; stdout?: string }
    git.error = (err.stderr || err.stdout || err.message || 'git 操作に失敗')
      .toString()
      .slice(0, 500)
  }

  // git 失敗でも Markdown 保存は成功扱い
  return NextResponse.json(
    { ok: true, file: fileName, path: absPath, relPath: relForGit, created, git },
    { status: 200 },
  )
}
