import { appendNdjson, readNdjson } from '@/lib/store'
import { SCREENS, canonicalScreen, screenLabel, type ScreenDef } from '@/lib/usage-screens'

// progress 自身の使用状況を記録・集計する。
// usage-log.ndjson（PROGRESS_DATA_PATH 配下）に page_view / action を1行1JSONで蓄積する。
// 既存の automation-log 等とは独立したファイル（運用ログと使用ログを混ぜない）。

export type UsageEventType = 'page_view' | 'action'

export interface UsageEvent {
  at: string // ISO8601
  type: UsageEventType
  path: string
  label?: string // action のときのボタン文言
}

const FILE = 'usage-log.ndjson'

/** 使用イベントを1件追記する（API から呼ぶ。サーバ側で at を付与）。 */
export async function appendUsageEvent(input: { type: string; path?: string; label?: string }): Promise<void> {
  const type: UsageEventType = input.type === 'action' ? 'action' : 'page_view'
  const path = (typeof input.path === 'string' ? input.path : '').slice(0, 200) || '/'
  const label = typeof input.label === 'string' ? input.label.trim().replace(/\s+/g, ' ').slice(0, 80) : undefined
  const entry: UsageEvent = {
    at: new Date().toISOString(),
    type,
    path,
    ...(type === 'action' && label ? { label } : {}),
  }
  await appendNdjson<UsageEvent>(FILE, entry)
}

export async function readUsageEvents(): Promise<UsageEvent[]> {
  return readNdjson<UsageEvent>(FILE)
}

export interface ScreenUsage {
  href: string
  label: string
  count: number
  lastAt: string | null
}

export interface ActionUsage {
  label: string
  path: string
  count: number
  lastAt: string
}

export interface UsageSummary {
  rangeDays: number
  hasData: boolean
  totalPageViews: number
  totalActions: number
  firstAt: string | null
  lastAt: string | null
  /** 直近 rangeDays の画面別アクセス回数（多い順） */
  screens: ScreenUsage[]
  /** 直近 rangeDays のよく使うボタン操作 TOP（多い順・最大20） */
  topActions: ActionUsage[]
  /** 全期間の画面別 最終使用日時（新しい順） */
  lastUsedByScreen: Array<{ href: string; label: string; lastAt: string }>
  /** 直近 rangeDays に1度も開かれていない登録済み画面（放置検知） */
  unusedScreens: ScreenDef[]
}

/** usage-log を集計して /usage 表示用のサマリーを作る。 */
export async function buildUsageSummary(rangeDays = 7): Promise<UsageSummary> {
  const events = await readUsageEvents()
  const cutoff = Date.now() - rangeDays * 86_400_000
  const inRange = events.filter((e) => {
    const t = Date.parse(e.at)
    return !Number.isNaN(t) && t >= cutoff
  })

  const pageViews = inRange.filter((e) => e.type === 'page_view')
  const actions = inRange.filter((e) => e.type === 'action')

  // 画面別アクセス回数（直近 rangeDays）
  const screenMap = new Map<string, { count: number; lastAt: string | null }>()
  for (const e of pageViews) {
    const href = canonicalScreen(e.path)
    const cur = screenMap.get(href) ?? { count: 0, lastAt: null }
    cur.count += 1
    if (!cur.lastAt || e.at > cur.lastAt) cur.lastAt = e.at
    screenMap.set(href, cur)
  }
  const screens: ScreenUsage[] = Array.from(screenMap.entries())
    .map(([href, v]) => ({ href, label: screenLabel(href), count: v.count, lastAt: v.lastAt }))
    .sort((a, b) => b.count - a.count)

  // よく使うボタン操作 TOP（直近 rangeDays）
  const actionMap = new Map<string, { path: string; count: number; lastAt: string }>()
  for (const e of actions) {
    const label = e.label || '(無題のボタン)'
    const cur = actionMap.get(label) ?? { path: canonicalScreen(e.path), count: 0, lastAt: e.at }
    cur.count += 1
    if (e.at > cur.lastAt) {
      cur.lastAt = e.at
      cur.path = canonicalScreen(e.path)
    }
    actionMap.set(label, cur)
  }
  const topActions: ActionUsage[] = Array.from(actionMap.entries())
    .map(([label, v]) => ({ label, path: v.path, count: v.count, lastAt: v.lastAt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // 全期間の画面別 最終使用日時
  const allTimeLast = new Map<string, string>()
  for (const e of events) {
    if (e.type !== 'page_view') continue
    const href = canonicalScreen(e.path)
    const prev = allTimeLast.get(href)
    if (!prev || e.at > prev) allTimeLast.set(href, e.at)
  }
  const lastUsedByScreen = SCREENS.filter((s) => allTimeLast.has(s.href))
    .map((s) => ({ href: s.href, label: s.label, lastAt: allTimeLast.get(s.href)! }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))

  // 放置検知（直近 rangeDays に未アクセスの登録画面）
  const seenInRange = new Set(screens.map((s) => s.href))
  const unusedScreens = SCREENS.filter((s) => !seenInRange.has(s.href))

  const allAts = events.map((e) => e.at).filter(Boolean).sort()

  return {
    rangeDays,
    hasData: events.length > 0,
    totalPageViews: pageViews.length,
    totalActions: actions.length,
    firstAt: allAts[0] ?? null,
    lastAt: allAts[allAts.length - 1] ?? null,
    screens,
    topActions,
    lastUsedByScreen,
    unusedScreens,
  }
}
