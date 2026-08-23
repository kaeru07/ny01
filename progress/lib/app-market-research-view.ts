// ─────────────────────────────────────────────────────────────
// App Market Research の型・ラベル・集計（保存層に依存しない部分）
//
// クライアントコンポーネントからも読むため、node:fs 等に依存させない。
// 保存・読み出しは lib/app-market-research.ts が担当する。
// ─────────────────────────────────────────────────────────────


/** 開発者の規模。unknown は本採用候補にせず参考候補として扱う。 */
export type DeveloperScale = 'individual' | 'small_company' | 'unknown' | 'excluded'

/** ヒットの型。both（急上昇かつ継続）が最優先。 */
export type HitType = 'surging' | 'sustained' | 'both'

/** 収益モデル。買い切り・有料DLは調査対象外。 */
export type Monetization = 'ads' | 'iap' | 'subscription' | 'mixed' | 'paid' | 'unknown'

/** 負荷の3段階。低いほど個人で回しやすい。 */
export type BurdenLevel = 'low' | 'medium' | 'high' | 'unknown'

export const DEVELOPER_SCALE_LABEL: Record<DeveloperScale, string> = {
  individual: '個人',
  small_company: '小規模法人',
  unknown: '規模不明',
  excluded: '除外',
}

export const HIT_TYPE_LABEL: Record<HitType, string> = {
  surging: '急上昇型',
  sustained: '継続ヒット型',
  both: '両方',
}

export const MONETIZATION_LABEL: Record<Monetization, string> = {
  ads: '広告',
  iap: 'アプリ内課金',
  subscription: 'サブスク',
  mixed: '広告＋課金',
  paid: '買い切り（対象外）',
  unknown: '確認できない',
}

export const BURDEN_LABEL: Record<BurdenLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  unknown: '確認できない',
}

/** 1回の調査で記録する、時点の値。確認できなかった項目は null にする（推測で埋めない）。 */
export interface MarketSnapshot {
  checkedAt: string
  hitType: HitType | null
  currentCategoryRank: number | null
  currentOverallRank: number | null
  /** 過去30日程度の推移。文章 or 「42→18」形式のどちらでもよい。 */
  rankTrend30d: string | null
  /** 継続ヒットの根拠（何か月上位か等）。 */
  longTermHitEvidence: string | null
  ratingCount: number | null
  reviewCount: number | null
  googlePlayDownloads: string | null
  googlePlayRatingCount: number | null
  monetization: Monetization
  /** 個人＋AIでの再現性 ★1〜5。 */
  reproducibility: number | null
  updateNote: string | null
  note: string | null
  sourceUrls: string[]
}

export interface MarketApp {
  /** App Store の数値ID優先。無ければ名前から作る。 */
  id: string
  appName: string
  developer: string
  developerScale: DeveloperScale
  appStoreUrl: string | null
  googlePlayUrl: string | null
  androidAvailable: boolean | null
  releaseDate: string | null
  ageSinceRelease: string | null
  category: string | null
  serverBurden: BurdenLevel
  operationBurden: BurdenLevel
  contentBurden: BurdenLevel
  /** 版権・IPが必要か。必要なら個人では再現しづらい。 */
  ipRequirement: string | null
  whyGrowing: string | null
  differentiation: string | null
  firstCheckedAt: string
  lastCheckedAt: string
  snapshots: MarketSnapshot[]
}

export interface MarketResearchStore {
  updatedAt: string
  apps: MarketApp[]
}

const EMPTY: MarketResearchStore = { updatedAt: '', apps: [] }

/** 採否の判定。規模不明は本採用にしない、買い切りは対象外、というルールをここに集約する。 */
export type MarketVerdict = 'adopt' | 'reference' | 'excluded'

export const VERDICT_LABEL: Record<MarketVerdict, string> = {
  adopt: '本採用候補',
  reference: '参考候補',
  excluded: '対象外',
}

/** 画面が使う1行分。最新スナップショットと前回差分を載せた表示用の形。 */
export interface MarketRow {
  app: MarketApp
  latest: MarketSnapshot | null
  previous: MarketSnapshot | null
  verdict: MarketVerdict
  verdictReason: string
  /** 前回→今回の差分。値が揃っているものだけ入る。 */
  delta: {
    categoryRank: number | null
    overallRank: number | null
    ratingCount: number | null
    reviewCount: number | null
    googlePlayRatingCount: number | null
    downloadsChanged: boolean
  }
  snapshotCount: number
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

/** App Store URL から数値IDを取り出す。取れない場合は null。 */
export function extractAppStoreId(url: string | null | undefined): string | null {
  if (!url) return null
  const matched = /\/id(\d{6,})/.exec(url)
  return matched ? matched[1] : null
}

/** アプリの一意キー。App Store ID を最優先にして、同じアプリが二重登録されるのを防ぐ。 */
export function buildAppKey(input: { appStoreUrl?: string | null; appName: string; developer?: string | null }): string {
  const storeId = extractAppStoreId(input.appStoreUrl)
  if (storeId) return `as-${storeId}`
  return `nm-${normalizeName(input.appName)}-${normalizeName(input.developer ?? '')}`
}

function diff(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (typeof current !== 'number' || typeof previous !== 'number') return null
  return current - previous
}

/**
 * 採否を決める。
 * - 買い切り/有料DLのみ、または開発者が大手は対象外
 * - 開発者規模が不明なものは本採用にせず参考候補どまり
 */
export function judge(app: MarketApp, latest: MarketSnapshot | null): { verdict: MarketVerdict; reason: string } {
  if (app.developerScale === 'excluded') return { verdict: 'excluded', reason: '大手・大規模パブリッシャーのため対象外' }
  if (latest?.monetization === 'paid') return { verdict: 'excluded', reason: '買い切り型のため対象外' }
  if (app.developerScale === 'unknown') return { verdict: 'reference', reason: '開発者規模が確認できないため参考候補' }
  if (!latest) return { verdict: 'reference', reason: '調査データが未記録' }
  return { verdict: 'adopt', reason: `${DEVELOPER_SCALE_LABEL[app.developerScale]}／${latest.hitType ? HIT_TYPE_LABEL[latest.hitType] : 'ヒット型未分類'}` }
}

/** 保存済みデータを、最新値＋前回差分つきの表示用の行に変換する。 */
export function buildRows(store: MarketResearchStore): MarketRow[] {
  return store.apps.map((app) => {
    const sorted = [...app.snapshots].sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt))
    const latest = sorted[sorted.length - 1] ?? null
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null
    const { verdict, reason } = judge(app, latest)
    return {
      app,
      latest,
      previous,
      verdict,
      verdictReason: reason,
      delta: {
        // 順位は「小さいほど上位」なので、上昇をプラスに見せるため前回−今回にする
        categoryRank: diff(previous?.currentCategoryRank, latest?.currentCategoryRank),
        overallRank: diff(previous?.currentOverallRank, latest?.currentOverallRank),
        ratingCount: diff(latest?.ratingCount, previous?.ratingCount),
        reviewCount: diff(latest?.reviewCount, previous?.reviewCount),
        googlePlayRatingCount: diff(latest?.googlePlayRatingCount, previous?.googlePlayRatingCount),
        downloadsChanged: Boolean(
          previous && latest && previous.googlePlayDownloads !== latest.googlePlayDownloads &&
          latest.googlePlayDownloads !== null,
        ),
      },
      snapshotCount: sorted.length,
    }
  })
}

export type MarketSortKey =
  | 'value'
  | 'surging'
  | 'sustained'
  | 'reproducibility'
  | 'rank'
  | 'ratingDelta'
  | 'lastChecked'

export const SORT_LABEL: Record<MarketSortKey, string> = {
  value: '個人で作る価値順',
  surging: '直近上昇順',
  sustained: '継続ヒット順',
  reproducibility: '再現性順',
  rank: '現在順位順',
  ratingDelta: '評価増加順',
  lastChecked: '調査が新しい順',
}

function scaleScore(scale: DeveloperScale): number {
  if (scale === 'individual') return 2
  if (scale === 'small_company') return 1.4
  if (scale === 'unknown') return 0.4
  return 0
}

function burdenScore(level: BurdenLevel): number {
  if (level === 'low') return 1
  if (level === 'medium') return 0.5
  if (level === 'high') return 0
  return 0.3
}

/**
 * 「個人＋AIで作る価値」の総合スコア。
 * 再現性を主軸に、開発規模・ヒット型・運用負荷の軽さで補正する。表示順にだけ使う。
 */
export function valueScore(row: MarketRow): number {
  if (row.verdict === 'excluded') return -1
  const repro = row.latest?.reproducibility ?? 0
  const hit = row.latest?.hitType === 'both' ? 2 : row.latest?.hitType === 'surging' ? 1.2 : row.latest?.hitType === 'sustained' ? 1.4 : 0
  const burden = burdenScore(row.app.serverBurden) + burdenScore(row.app.operationBurden) + burdenScore(row.app.contentBurden)
  const referencePenalty = row.verdict === 'reference' ? 0.6 : 1
  return (repro * 2 + hit + burden + scaleScore(row.app.developerScale)) * referencePenalty
}

/** 直近の伸び。順位上昇と評価増加を合成する。 */
function surgeScore(row: MarketRow): number {
  const rank = row.delta.categoryRank ?? 0
  const rating = row.delta.ratingCount ?? 0
  return rank * 2 + rating / 100
}

export function sortRows(rows: MarketRow[], key: MarketSortKey): MarketRow[] {
  const copy = [...rows]
  switch (key) {
    case 'surging':
      return copy.sort((a, b) => surgeScore(b) - surgeScore(a))
    case 'sustained':
      return copy.sort((a, b) => {
        const score = (row: MarketRow) => (row.latest?.hitType === 'both' ? 2 : row.latest?.hitType === 'sustained' ? 1 : 0) * 100 + row.snapshotCount
        return score(b) - score(a)
      })
    case 'reproducibility':
      return copy.sort((a, b) => (b.latest?.reproducibility ?? 0) - (a.latest?.reproducibility ?? 0))
    case 'rank':
      return copy.sort((a, b) => (a.latest?.currentCategoryRank ?? 9999) - (b.latest?.currentCategoryRank ?? 9999))
    case 'ratingDelta':
      return copy.sort((a, b) => (b.delta.ratingCount ?? -1) - (a.delta.ratingCount ?? -1))
    case 'lastChecked':
      return copy.sort((a, b) => Date.parse(b.app.lastCheckedAt) - Date.parse(a.app.lastCheckedAt))
    default:
      return copy.sort((a, b) => valueScore(b) - valueScore(a))
  }
}

export interface MarketFilter {
  hitType?: HitType
  developerScale?: DeveloperScale
  monetization?: Monetization
  category?: string
  minReproducibility?: number
  verdict?: MarketVerdict
  q?: string
}

export function filterRows(rows: MarketRow[], filter: MarketFilter): MarketRow[] {
  return rows.filter((row) => {
    if (filter.hitType && row.latest?.hitType !== filter.hitType) return false
    if (filter.developerScale && row.app.developerScale !== filter.developerScale) return false
    if (filter.monetization && row.latest?.monetization !== filter.monetization) return false
    if (filter.category && row.app.category !== filter.category) return false
    if (filter.verdict && row.verdict !== filter.verdict) return false
    if (filter.minReproducibility && (row.latest?.reproducibility ?? 0) < filter.minReproducibility) return false
    if (filter.q) {
      const haystack = [row.app.appName, row.app.developer, row.app.category, row.latest?.note, row.app.whyGrowing]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(filter.q.toLowerCase())) return false
    }
    return true
  })
}

/** 調査1件分の入力。既知アプリなら snapshot を足すだけになる。 */
export interface MarketResearchInput {
  appName: string
  developer: string
  developerScale: DeveloperScale
  appStoreUrl?: string | null
  googlePlayUrl?: string | null
  androidAvailable?: boolean | null
  releaseDate?: string | null
  ageSinceRelease?: string | null
  category?: string | null
  serverBurden?: BurdenLevel
  operationBurden?: BurdenLevel
  contentBurden?: BurdenLevel
  ipRequirement?: string | null
  whyGrowing?: string | null
  differentiation?: string | null
  snapshot: Partial<MarketSnapshot> & { monetization: Monetization }
}

export function normalizeSnapshot(input: MarketResearchInput['snapshot'], checkedAt: string): MarketSnapshot {
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  return {
    checkedAt,
    hitType: input.hitType ?? null,
    currentCategoryRank: num(input.currentCategoryRank),
    currentOverallRank: num(input.currentOverallRank),
    rankTrend30d: str(input.rankTrend30d),
    longTermHitEvidence: str(input.longTermHitEvidence),
    ratingCount: num(input.ratingCount),
    reviewCount: num(input.reviewCount),
    googlePlayDownloads: str(input.googlePlayDownloads),
    googlePlayRatingCount: num(input.googlePlayRatingCount),
    monetization: input.monetization,
    reproducibility: num(input.reproducibility),
    updateNote: str(input.updateNote),
    note: str(input.note),
    sourceUrls: Array.isArray(input.sourceUrls) ? input.sourceUrls.filter((url) => typeof url === 'string' && url.trim()) : [],
  }
}
