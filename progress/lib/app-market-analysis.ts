import { getAppFactoryCandidates, type AppFactoryCandidate } from '@/lib/app-factory-candidates'
import { readAiNewsSeed, readMarketResearchSeed } from '@/lib/research-seed-reader'
import { readNdjson } from '@/lib/store'
import type { AutomationLogEntry } from '@/lib/types/operations'

type CategoryKey = 'developer_tool' | 'creator_media' | 'productivity' | 'business_ops' | 'consumer_utility' | 'unknown'

export interface AppMarketAnalysisRecord {
  candidate: AppFactoryCandidate
  category: CategoryKey
  categoryLabel: string
  generatedMode: 'ai' | 'fallback' | 'unknown'
  generatedReason: string
  seedSources: string[]
  seedTitles: string[]
  createdAt: string
  isGenericFallback: boolean
  derivationConfidence: 'stored' | 'log' | 'inferred'
}

export interface AppMarketAnalysis {
  records: AppMarketAnalysisRecord[]
  counts: {
    total: number
    recent: number
    developerRecent: number
    fallbackRecent: number
    genericFallbackRecent: number
  }
  categoryCounts: Array<{ key: CategoryKey; label: string; count: number; recentCount: number }>
  modeCounts: Array<{ mode: string; count: number; recentCount: number }>
  latestMarket: Awaited<ReturnType<typeof readMarketResearchSeed>>
  latestAiNews: Awaited<ReturnType<typeof readAiNewsSeed>>
  findings: string[]
}

interface ParsedGenerationLog {
  at: string
  mode?: 'ai' | 'fallback'
  reason?: string
  seedSources: string[]
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  developer_tool: '開発・運用ツール',
  creator_media: '制作・メディア',
  productivity: '記録・習慣・生産性',
  business_ops: '業務・店舗運用',
  consumer_utility: '生活ユーティリティ',
  unknown: '未分類',
}

function textOf(candidate: AppFactoryCandidate): string {
  return [
    candidate.title,
    candidate.overview,
    candidate.purpose,
    candidate.targetUser,
    candidate.marketValue,
    candidate.monetizationHypothesis,
    candidate.features?.join(' '),
    candidate.winningFactors?.join(' '),
    candidate.concerns?.join(' '),
  ].filter(Boolean).join(' ')
}

function classifyCandidate(candidate: AppFactoryCandidate): CategoryKey {
  const text = textOf(candidate)
  if (/GitHub|Codex|MCP|AIコーディング|開発者|個人開発|インディー|リポジトリ|Issue|PR|ASO|App Store.*検索|API|エージェント/i.test(text)) {
    return 'developer_tool'
  }
  if (/動画|ドラマ|ショート|制作|SNS|画像|音声|コンテンツ|記事|メディア/i.test(text)) return 'creator_media'
  if (/記録|習慣|TODO|ToDo|タスク|日記|リマインダー|学習|勉強|ログ/i.test(text)) return 'productivity'
  if (/店舗|営業|CRM|予約|在庫|請求|会計|業務|チーム|顧客/i.test(text)) return 'business_ops'
  if (/家計|旅行|健康|料理|買い物|育児|生活|地図|予定/i.test(text)) return 'consumer_utility'
  return 'unknown'
}

function parseGenerationLog(entry: AutomationLogEntry): ParsedGenerationLog {
  const reason = entry.fallbackReason ?? ''
  const modeMatch = reason.match(/mode=([a-z_]+)/)
  const seedMatch = reason.match(/seed=([^ ]+)/)
  const detailMatch = reason.match(/reason=(.+)$/)
  const mode = modeMatch?.[1] === 'ai' || modeMatch?.[1] === 'fallback' ? modeMatch[1] : undefined
  return {
    at: entry.at,
    mode,
    reason: detailMatch?.[1] || reason,
    seedSources: seedMatch?.[1] ? seedMatch[1].split(',').map((item) => item.trim()).filter(Boolean) : [],
  }
}

function buildLogByCandidate(logs: AutomationLogEntry[]): Map<string, ParsedGenerationLog> {
  const map = new Map<string, ParsedGenerationLog>()
  for (const entry of logs) {
    if (entry.event !== 'app_proposal_generated' || !entry.fallbackTarget) continue
    const parsed = parseGenerationLog(entry)
    for (const id of entry.fallbackTarget.split(',').map((item) => item.trim()).filter(Boolean)) {
      if (id.startsWith('daily-')) map.set(id, parsed)
    }
  }
  return map
}

function fallbackLike(candidate: AppFactoryCandidate, mode: string): boolean {
  if (mode === 'fallback') return true
  const features = candidate.features ?? []
  const wins = candidate.winningFactors ?? []
  return features.includes('クイック記録') && wins.some((item) => item.includes('今日の判断で要精査'))
}

function dateValue(value?: string): number {
  const time = Date.parse(value ?? '')
  return Number.isFinite(time) ? time : 0
}

function countBy<T extends string>(records: AppMarketAnalysisRecord[], getKey: (record: AppMarketAnalysisRecord) => T): Array<{ key: T; count: number; recentCount: number }> {
  const recent = records.slice(0, 7)
  const keys = Array.from(new Set(records.map(getKey)))
  return keys.map((key) => ({
    key,
    count: records.filter((record) => getKey(record) === key).length,
    recentCount: recent.filter((record) => getKey(record) === key).length,
  })).sort((a, b) => b.count - a.count)
}

function buildFindings(records: AppMarketAnalysisRecord[]): string[] {
  const recent = records.slice(0, 7)
  const recentFallback = recent.filter((record) => record.generatedMode === 'fallback').length
  const recentDeveloper = recent.filter((record) => record.category === 'developer_tool').length
  const genericFallback = recent.filter((record) => record.isGenericFallback).length
  const findings: string[] = []
  if (recentFallback >= Math.ceil(recent.length / 2)) {
    findings.push(`直近${recent.length}件中${recentFallback}件が fallback です。Claude/Codex timeout 時の汎用テンプレが増え、候補の粒度が粗くなっています。`)
  }
  if (recentDeveloper >= Math.ceil(recent.length / 2)) {
    findings.push(`直近${recent.length}件中${recentDeveloper}件が開発・運用ツール寄りです。research/knowledge がAI開発・運用に偏ると、承認欄も同じ方向へ寄ります。`)
  }
  if (genericFallback > 0) {
    findings.push(`汎用fallback候補が${genericFallback}件あります。市場観測の先頭ジャンルをタイトル化し、主要機能が「クイック記録/一覧/判断メモ」へ寄るため、似た案に見えやすい状態です。`)
  }
  if (findings.length === 0) findings.push('直近候補に強い偏りは検出していません。')
  findings.push('現状の古い候補は候補ごとのseed全文を保存していないため、automation-log と候補本文から復元しています。今後生成される候補は derivation に生成元を保存します。')
  return findings
}

export async function getAppMarketAnalysis(): Promise<AppMarketAnalysis> {
  const [queue, logs, latestMarket, latestAiNews] = await Promise.all([
    getAppFactoryCandidates(),
    readNdjson<AutomationLogEntry>('automation-log.ndjson'),
    readMarketResearchSeed().catch(() => null),
    readAiNewsSeed().catch(() => null),
  ])
  const logByCandidate = buildLogByCandidate(logs)
  const records = queue.candidates
    .slice()
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
    .map((candidate): AppMarketAnalysisRecord => {
      const log = logByCandidate.get(candidate.id)
      const category = classifyCandidate(candidate)
      const mode = candidate.derivation?.mode ?? log?.mode ?? 'unknown'
      return {
        candidate,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        generatedMode: mode,
        generatedReason: candidate.derivation?.reason ?? log?.reason ?? '生成ログなし（旧候補または手動追加）',
        seedSources: candidate.derivation?.seedSources ?? log?.seedSources ?? [],
        seedTitles: candidate.derivation?.seedTitles ?? [],
        createdAt: candidate.createdAt ?? log?.at ?? '',
        isGenericFallback: fallbackLike(candidate, mode),
        derivationConfidence: candidate.derivation ? 'stored' : log ? 'log' : 'inferred',
      }
    })

  const recent = records.slice(0, 7)
  return {
    records,
    counts: {
      total: records.length,
      recent: recent.length,
      developerRecent: recent.filter((record) => record.category === 'developer_tool').length,
      fallbackRecent: recent.filter((record) => record.generatedMode === 'fallback').length,
      genericFallbackRecent: recent.filter((record) => record.isGenericFallback).length,
    },
    categoryCounts: countBy(records, (record) => record.category).map((item) => ({ ...item, label: CATEGORY_LABELS[item.key] })),
    modeCounts: countBy(records, (record) => record.generatedMode).map((item) => ({ mode: item.key, count: item.count, recentCount: item.recentCount })),
    latestMarket,
    latestAiNews,
    findings: buildFindings(records),
  }
}
