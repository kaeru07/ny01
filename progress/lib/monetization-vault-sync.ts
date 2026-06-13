import fs from 'fs/promises'
import path from 'path'
import { readJson, writeJson } from '@/lib/store'
import { slugify } from '@/lib/monetization-store'
import { getEpics } from '@/lib/operations-store'
import { addExecutionRun } from '@/lib/execution-run-writer'
import type { ExecutionRun } from '@/types/execution-run'
import type {
  MonetizationCandidate,
  SourceRef,
  SourceRefType,
  ResearchLog,
  HistoryEntry,
  EvidenceLink,
} from '@/types/monetization'

// 定期実行(11:00/23:00/boot)時に Vault の調査結果を走査し、未反映の収益化候補を
// Monetization Hub（monetization-candidates.json = 正本）へ取り込む。
// - 新規候補 → 追加（status Draft）
// - 既存候補 → researchLogs / sourceRefs / evidenceLinks に追記（二重追加しない）
// - Vault の Markdown は「調査元・根拠」として扱い、Vault 側は書き換えない（相互上書き禁止）。
// Epic化・公開・課金・deploy・secret には一切触れない（候補取り込みのみ）。

const FILE = 'monetization-candidates.json'
const VAULT_PATH =
  process.env.MONETIZATION_VAULT_PATH || process.env.VAULT_PATH || '/root/company/obsidian-sync-vault'

// 主要な候補テーブル（構造化された一次ソース）。
const CANDIDATE_TABLE = '05_monetization/収益化候補一覧.md'

// 既存アプリ（slug）。新規候補として追加してはいけない。
const EXISTING_APP_SLUGS = [
  'progress', 'goalplanner', 'goalplanner', 'netscope', 'mahjong', 'nanikiru', 'nanikirushorts',
  'shogi', 'shogitrainer', 'news', 'newsapp', 'scrapelab',
]

export interface VaultSyncResult {
  ok: boolean
  runId: string
  added: number
  updated: number
  skipped: number
  scannedFiles: number
  addedNames: string[]
  updatedNames: string[]
}

function genRunId(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

// 候補名の末尾の英語フレーズ（例:「アナログレコード台帳 Vinyl Vault」→「Vinyl Vault」）。
// 単一の汎用英単語（vault / stats 等）での過剰一致を避けるため、フレーズ単位で照合する。
function englishPhrase(name: string): string {
  const m = name.match(/([A-Za-z][A-Za-z0-9 ]*[A-Za-z0-9])\s*$/)
  const phrase = (m ? m[1] : '').trim()
  return phrase.length >= 4 ? phrase.toLowerCase() : ''
}

function mentions(content: string, name: string): boolean {
  if (content.includes(name)) return true
  const phrase = englishPhrase(name)
  // 2語以上の固有名（空白あり）か、6文字以上の固有語（BirdLog/AnglerLog等）のみ英語照合を許可。
  // vault / stats など 5 文字以下の汎用語での過剰一致を避ける。
  if (phrase && (phrase.includes(' ') || phrase.length >= 6) && content.toLowerCase().includes(phrase)) return true
  return false
}

async function readFileSafe(abs: string): Promise<string | null> {
  try {
    return await fs.readFile(abs, 'utf-8')
  } catch {
    return null
  }
}

async function listMarkdown(relDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(VAULT_PATH, relDir))
    return entries.filter((e) => e.endsWith('.md')).map((e) => `${relDir}/${e}`)
  } catch {
    return []
  }
}

/** 候補テーブル(.md)から候補名を抽出する（太字セル = 候補名）。 */
function extractCandidateNames(md: string): { name: string; section: string; memo: string }[] {
  const out: { name: string; section: string; memo: string }[] = []
  let section = ''
  for (const line of md.split('\n')) {
    const h = line.match(/^#{2,3}\s+(.*)$/)
    if (h) {
      section = h[1].trim()
      continue
    }
    // 候補テーブル行のみ: | N | **Name** | ... | memo |（先頭データセルが番号の行に限定）。
    // これにより「評価軸」など凡例テーブルの太字セルを誤って候補化しない。
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 3 || !/^\d+$/.test(cells[1])) continue
    const bold = cells.find((c) => /^\*\*.+\*\*$/.test(c))
    if (!bold) continue
    const name = bold.replace(/^\*\*|\*\*$/g, '').trim()
    if (!name || name.length < 2) continue
    const memo = cells.length > 2 ? cells[cells.length - 1] : ''
    out.push({ name, section, memo })
  }
  return out
}

function findExisting(name: string, list: MonetizationCandidate[]): MonetizationCandidate | undefined {
  const n = norm(name)
  const s = slugify(name)
  return list.find(
    (c) =>
      norm(c.name) === n ||
      (s.length >= 3 && (slugify(c.name) === s || c.targetApp === s)) ||
      // 類似名（一方が他方を含む）
      (n.length >= 4 && (norm(c.name).includes(n) || n.includes(norm(c.name)))),
  )
}

function sourceType(relPath: string): SourceRefType {
  if (relPath.startsWith('20_reviews/')) return 'review'
  // 日次調査（daily-market-research / daily-ai-news / daily-ai-tools）は 06_research 配下だが daily 種別に分類する。
  if (relPath.includes('daily')) return 'daily'
  if (relPath.startsWith('06_research/')) return 'research'
  if (relPath.startsWith('05_monetization/')) return 'vault'
  return 'vault'
}

function hasSourceRef(c: MonetizationCandidate, path: string): boolean {
  return (c.sourceRefs ?? []).some((r) => r.path === path)
}

/**
 * Vault を走査して候補を取り込む。Vault 側は変更しない。
 */
export async function syncCandidatesFromVault(input?: {
  source?: string
  trigger?: string
}): Promise<VaultSyncResult> {
  const runId = genRunId()
  const ts = new Date().toISOString()
  const today = ts.slice(0, 10)
  const list = await readJson<MonetizationCandidate[]>(FILE, [])
  const epics = await getEpics()
  const epicSlugs = new Set(
    epics.flatMap((e) => [slugify(e.title), slugify(e.epicId), ...(e.targetApps ?? []).map(slugify)]),
  )

  // 1) 一次ソース（候補テーブル）から候補名を抽出
  const tableMd = (await readFileSafe(path.join(VAULT_PATH, CANDIDATE_TABLE))) ?? ''
  const extracted = extractCandidateNames(tableMd)

  // 2) 根拠スキャン用に research / 日次調査 / reviews の md を読み込む。
  //    daily-market-research / daily-ai-news / daily-ai-tools は 06_research のサブフォルダ
  //    （listMarkdown は非再帰のため明示的に追加する）。
  const evidencePaths = [
    ...(await listMarkdown('06_research')),
    ...(await listMarkdown('06_research/daily-market-research')),
    ...(await listMarkdown('06_research/daily-ai-news')),
    ...(await listMarkdown('06_research/daily-ai-tools')),
    ...(await listMarkdown('20_reviews')),
  ]
  const evidenceFiles: { path: string; content: string }[] = []
  for (const rel of evidencePaths.slice(0, 400)) {
    const content = await readFileSafe(path.join(VAULT_PATH, rel))
    if (content) evidenceFiles.push({ path: rel, content })
  }
  const scannedFiles = 1 + evidenceFiles.length

  let added = 0
  let updated = 0
  let skipped = 0
  const addedNames: string[] = []
  const updatedNames: string[] = []

  const seen = new Set<string>()
  for (const { name, section, memo } of extracted) {
    const key = norm(name)
    if (seen.has(key)) continue
    seen.add(key)
    const slug = slugify(name)

    // 候補テーブル由来の sourceRef（一次）
    const primaryRef: SourceRef = {
      id: `sr-${slug || 'x'}-${Date.now().toString(36).slice(-4)}-${added + updated}`,
      type: 'vault',
      path: CANDIDATE_TABLE,
      title: name,
      excerpt: memo.slice(0, 160),
      section,
      discoveredAt: today,
      addedByRunId: runId,
      confidence: 'high',
    }

    const existing = findExisting(name, list)

    if (existing) {
      // 既存候補 → 二重追加しない。調査元・履歴に追記のみ。
      let changed = false
      if (!hasSourceRef(existing, CANDIDATE_TABLE)) {
        existing.sourceRefs = [...(existing.sourceRefs ?? []), primaryRef]
        changed = true
      }
      // 根拠スキャン（再登場した調査元を記録）
      for (const ef of evidenceFiles) {
        if (hasSourceRef(existing, ef.path)) continue
        if (mentions(ef.content, name)) {
          existing.sourceRefs = [
            ...(existing.sourceRefs ?? []),
            {
              id: `sr-${slug}-${Date.now().toString(36).slice(-4)}-${(existing.sourceRefs ?? []).length}`,
              type: sourceType(ef.path),
              path: ef.path,
              title: name,
              discoveredAt: today,
              addedByRunId: runId,
              confidence: 'medium',
            },
          ]
          existing.evidenceLinks = [
            ...(existing.evidenceLinks ?? []),
            { label: path.basename(ef.path), path: ef.path, note: '名称が再登場' },
          ]
          changed = true
        }
      }
      if (changed) {
        const rlog: ResearchLog = {
          date: today,
          type: 'vault_sync',
          note: `定期取り込み: ${name} が Vault 調査元に登場（重複のため追記のみ）`,
          summary: `調査元 ${(existing.sourceRefs ?? []).length} 件`,
          sourcePath: CANDIDATE_TABLE,
          runId,
          impact: 'no_change',
        }
        const hist: HistoryEntry = {
          at: ts,
          action: 'vault_sync_append',
          detail: `調査元/根拠を追記（${input?.source ?? 'manual'}/${input?.trigger ?? '-'}）`,
          reason: '既存候補と重複（再登場）',
          runId,
          timestamp: ts,
        }
        existing.researchLogs = [...(existing.researchLogs ?? []), rlog]
        existing.history = [...(existing.history ?? []), hist]
        existing.lastResearchedAt = today
        existing.lastSyncRunId = runId
        existing.updatedAt = ts
        updated++
        updatedNames.push(existing.name)
      } else {
        skipped++
      }
      continue
    }

    // 既存アプリ / 既存Epic と重複 → 新規候補として追加しない
    if ((slug && EXISTING_APP_SLUGS.includes(slug)) || (slug.length >= 3 && epicSlugs.has(slug))) {
      skipped++
      continue
    }

    // 新規候補として追加
    const evidence: SourceRef[] = [primaryRef]
    const links: EvidenceLink[] = []
    for (const ef of evidenceFiles) {
      if (mentions(ef.content, name)) {
        evidence.push({
          id: `sr-${slug}-${Date.now().toString(36).slice(-4)}-${evidence.length}`,
          type: sourceType(ef.path),
          path: ef.path,
          title: name,
          discoveredAt: today,
          addedByRunId: runId,
          confidence: 'medium',
        })
        links.push({ label: path.basename(ef.path), path: ef.path, note: '候補化の根拠' })
      }
    }
    const candidate: MonetizationCandidate = {
      id: `mc-${(slug || 'cand').slice(0, 16)}-${Date.now().toString(36).slice(-4)}-${added}`,
      name,
      category: section || '未分類',
      status: 'Draft',
      score: 0,
      targetApp: slug,
      notes: memo || undefined,
      latestSignal: memo || undefined,
      sourceRefs: evidence,
      evidenceLinks: links.length ? links : undefined,
      researchLogs: [
        {
          date: today,
          type: 'vault_sync',
          note: `定期取り込みで新規候補化（出典: ${CANDIDATE_TABLE} / ${section}）`,
          summary: name,
          sourcePath: CANDIDATE_TABLE,
          runId,
          impact: 'new_candidate',
        },
      ],
      history: [
        {
          at: ts,
          action: 'created_by_vault_sync',
          detail: `定期取り込み（${input?.source ?? 'manual'}/${input?.trigger ?? '-'}）`,
          after: 'Draft',
          reason: 'Vault 調査結果に未反映の候補を検出',
          runId,
          timestamp: ts,
        },
      ],
      links: { vault: CANDIDATE_TABLE },
      discoveredAt: ts,
      updatedAt: ts,
      lastResearchedAt: today,
      ingestedAt: ts,
      lastSyncRunId: runId,
    }
    list.push(candidate)
    added++
    addedNames.push(name)
  }

  if (added > 0 || updated > 0) {
    await writeJson(FILE, list)
  }

  // ExecutionRun 記録（追加/更新件数）
  const run: ExecutionRun = {
    runId,
    startedAt: ts,
    finishedAt: new Date().toISOString(),
    targetApp: 'progress',
    targetTodoTitle: `収益化候補 定期取り込み（Vault→Hub） 追加${added}/更新${updated}`,
    runStatus: 'completed',
    reviewStatus: 'not_reviewed',
    source: 'monetization_sync',
    trigger: input?.trigger,
    summary: `Vault走査 ${scannedFiles} ファイル / 新規追加 ${added} 件 / 既存追記 ${updated} 件 / skip ${skipped} 件`,
    changedFiles: added > 0 || updated > 0 ? [{ file: 'data/real/monetization-candidates.json', change: `追加${added}/更新${updated}` }] : [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: [],
    rawReport: `[monetization-sync] source=${input?.source ?? 'manual'} trigger=${input?.trigger ?? '-'} scanned=${scannedFiles} added=[${addedNames.join(', ')}] updated=[${updatedNames.join(', ')}] skipped=${skipped}. Vault は読み取りのみ（書き換えなし）。Epic化・公開・課金・deploy・secret には触れていない。`,
  }
  await addExecutionRun(run)

  return { ok: true, runId, added, updated, skipped, scannedFiles, addedNames, updatedNames }
}
