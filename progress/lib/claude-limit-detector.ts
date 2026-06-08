import fs from 'fs/promises'
import path from 'path'
import { readJson, readNdjson } from './store'
import type { ExecutionRunsData } from '@/types/execution-run'
import type {
  AutomationLogEntry,
  ClaudeLimitDetection,
  ClaudeLimitSignal,
  LimitSignalWeight,
} from './types/operations'

// Claude 上限の自動検知。手動ボタンに依存せず、3 つのログ正本から判定する:
//   1) ExecutionRun（runStatus / errors[] / fallbackReason の構造化フィールドのみ走査）
//   2) vloop 実行ログの frontmatter stop_reason
//   3) Automation Log（過去の検知・fallback の裏取り / 履歴）
// rawReport / summary / title は「上限」という話題語を多数含むため走査対象から除外する
// （= 設計メモ等での誤検知を構造的に防ぐ最重要ガード）。

// 上限イベントは ~5h でリセットされるため、既定では直近 180 分のシグナルのみを採用する。
const DEFAULT_WINDOW_MINUTES = 180

// vloop ログの所在。env 優先・既定は Vault 配下の運用ログディレクトリ。
const VLOOP_LOG_DIR =
  process.env.VLOOP_LOG_DIR ?? '/root/company/obsidian-sync-vault/03_prompts/claude-commands/logs'

interface LimitPattern {
  label: string
  re: RegExp
}

// 「明確な上限シグナル」パターン（rate limit / usage limit / quota / 429 / Claude CLI 文言 / 和文）。
// これらが errors[] / fallbackReason / stop_reason にマッチしたら強シグナルとして扱う。
const LIMIT_PATTERNS: LimitPattern[] = [
  { label: 'rate limit', re: /rate[\s_/-]?limit/i },
  { label: 'usage limit', re: /usage[\s_-]?limit/i },
  { label: 'usage limit reached', re: /usage limit reached/i },
  { label: 'quota exceeded', re: /quota(\s|_|-)?(exceeded)?/i },
  { label: 'too many requests', re: /too many requests/i },
  { label: 'http 429', re: /(^|[^0-9])429([^0-9]|$)/ },
  { label: 'limit reached', re: /limit reached/i },
  { label: 'claude usage limit', re: /claude (ai )?usage limit/i },
  { label: '5-hour limit', re: /5[\s-]?hour limit/i },
  { label: 'claude_rate_limited', re: /claude[\s_-]?rate[\s_-]?limited/i },
  { label: 'overloaded', re: /overloaded(_error)?/i },
  { label: 'レート制限', re: /レート制限/ },
  { label: '利用制限', re: /利用制限/ },
  { label: '使用量の上限', re: /使用量の上限/ },
  { label: '利用上限', re: /利用上限/ },
  { label: '上限に達', re: /上限に達/ },
  { label: '制限に達', re: /制限に達/ },
  { label: 'Claude+上限/制限', re: /(claude[^。\n]{0,12}(上限|制限)|(上限|制限)[^。\n]{0,12}claude)/i },
]

function matchLimit(text: string): LimitPattern | null {
  if (!text) return null
  for (const p of LIMIT_PATTERNS) if (p.re.test(text)) return p
  return null
}

function trunc(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

interface DetectOptions {
  windowMinutes?: number
}

export async function detectClaudeLimit(opts: DetectOptions = {}): Promise<ClaudeLimitDetection> {
  const windowMinutes =
    typeof opts.windowMinutes === 'number' && opts.windowMinutes > 0
      ? opts.windowMinutes
      : DEFAULT_WINDOW_MINUTES
  const now = Date.now()
  const cutoff = now - windowMinutes * 60_000
  const signals: ClaudeLimitSignal[] = []

  // --- Source 1: ExecutionRun（構造化フィールドのみ。rawReport/summary/title は見ない） ---
  const runsData = await readJson<ExecutionRunsData>('execution-runs.json', { runs: [] })
  const recentRuns = runsData.runs
    .filter((r) => {
      const t = Date.parse(r.finishedAt || r.startedAt || '')
      return !Number.isNaN(t) && t >= cutoff
    })
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
    .slice(0, 30)

  for (const r of recentRuns) {
    const errText = (r.errors ?? []).join(' | ')
    const fbText = r.fallbackReason ?? ''
    const errMatch = matchLimit(errText)
    const fbMatch = errMatch ? null : matchLimit(fbText)
    const m = errMatch ?? fbMatch
    if (m) {
      const field = errMatch ? 'errors' : 'fallbackReason'
      const src = errMatch ? errText : fbText
      // 上限キーワードあり + 実際に failed = 高確度。failed でなければ中。
      const weight: LimitSignalWeight = r.runStatus === 'failed' ? 'high' : 'medium'
      signals.push({
        source: 'execution-run',
        ref: r.runId,
        field,
        pattern: m.label,
        excerpt: trunc(src),
        weight,
        at: r.finishedAt,
      })
    } else if (r.runStatus === 'failed') {
      // failed だが上限キーワードなし = 上限とは確定できない（build 失敗等の可能性）。
      // 低シグナル扱い → 単独では ambiguous(=blocked) に倒す。
      signals.push({
        source: 'execution-run',
        ref: r.runId,
        field: 'runStatus',
        pattern: 'failed(汎用)',
        excerpt: 'runStatus=failed / 上限キーワードなし',
        weight: 'low',
        at: r.finishedAt,
      })
    }
  }

  // --- Source 2: vloop 実行ログ frontmatter stop_reason ---
  try {
    const files = (await fs.readdir(VLOOP_LOG_DIR)).filter((f) => /^vloop_.*\.md$/.test(f))
    const stated = await Promise.all(
      files.map(async (f) => ({ f, mtime: (await fs.stat(path.join(VLOOP_LOG_DIR, f))).mtimeMs })),
    )
    const recentLogs = stated
      .filter((s) => s.mtime >= cutoff)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 3)
    for (const s of recentLogs) {
      const content = await fs.readFile(path.join(VLOOP_LOG_DIR, s.f), 'utf-8')
      const fm = content.match(/^---\n([\s\S]*?)\n---/)
      if (!fm) continue
      const stopLine = fm[1].split('\n').find((l) => /^stop_reason\s*:/i.test(l))
      if (!stopLine) continue
      const reason = stopLine.replace(/^stop_reason\s*:\s*/i, '').trim()
      const m = matchLimit(reason)
      const at = new Date(s.mtime).toISOString()
      if (m) {
        signals.push({
          source: 'vloop-log',
          ref: s.f,
          field: 'stop_reason',
          pattern: m.label,
          excerpt: trunc(reason),
          weight: 'high',
          at,
        })
      } else if (/(上限|制限)/.test(reason)) {
        // stop_reason に「上限/制限」が含まれるが明確パターン未一致 = 曖昧。
        // 例: スコープ制限 等の可能性があるため低シグナル（単独では blocked）。
        signals.push({
          source: 'vloop-log',
          ref: s.f,
          field: 'stop_reason',
          pattern: '上限/制限(曖昧)',
          excerpt: trunc(reason),
          weight: 'low',
          at,
        })
      }
    }
  } catch {
    // ディレクトリ不在等は無視（vloop ログ無し環境でも検知を止めない）
  }

  // --- Source 3: Automation Log（裏取り・履歴。自分のエコーなので低シグナル） ---
  const alog = await readNdjson<AutomationLogEntry>('automation-log.ndjson')
  for (const e of alog.slice(-15)) {
    const t = Date.parse(e.at)
    if (Number.isNaN(t) || t < cutoff) continue
    if (e.event !== 'auto_fallback' || !e.fallbackTriggered) continue
    const text = `${e.fallbackReason ?? ''} ${e.blockedReason ?? ''}`
    const m = matchLimit(text)
    if (m) {
      signals.push({
        source: 'automation-log',
        ref: e.id,
        field: 'fallbackReason',
        pattern: m.label,
        excerpt: trunc(text),
        weight: 'low',
        at: e.at,
      })
    }
  }

  return decide(signals, windowMinutes)
}

// 判定: high が 1 つでもあれば検知（高確度）。medium が 1 つでも検知（中確度）。
// low しか無い（汎用 failed / 曖昧な上限語のみ）= 誤判定回避のため ambiguous=block_for_review。
// シグナル無し = none。
function decide(signals: ClaudeLimitSignal[], windowMinutes: number): ClaudeLimitDetection {
  const high = signals.filter((s) => s.weight === 'high').length
  const medium = signals.filter((s) => s.weight === 'medium').length
  const low = signals.filter((s) => s.weight === 'low').length

  let status: ClaudeLimitDetection['status']
  let confidence: ClaudeLimitDetection['confidence']
  let recommendation: ClaudeLimitDetection['recommendation']
  let reason: string

  if (high >= 1) {
    status = 'detected'
    confidence = 'high'
    recommendation = 'trigger_fallback'
    reason = 'claude_rate_limited'
  } else if (medium >= 1) {
    status = 'detected'
    confidence = 'medium'
    recommendation = 'trigger_fallback'
    reason = 'claude_rate_limited'
  } else if (low >= 1) {
    status = 'ambiguous'
    confidence = 'low'
    recommendation = 'block_for_review'
    reason = '上限の可能性あり（明確なキーワード未確定）。誤判定回避のため人手確認に回す'
  } else {
    status = 'none'
    confidence = 'none'
    recommendation = 'no_action'
    reason = '上限シグナルなし'
  }

  return {
    status,
    detected: status === 'detected',
    confidence,
    reason,
    recommendation,
    signals,
    windowMinutes,
    evaluatedAt: new Date().toISOString(),
  }
}
