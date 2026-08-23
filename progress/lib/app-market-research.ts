import { readJson, writeJson } from './store'
import {
  buildAppKey,
  buildRows,
  normalizeSnapshot,
  sortRows,
  DEVELOPER_SCALE_LABEL,
  type MarketApp,
  type MarketResearchInput,
  type MarketResearchStore,
} from './app-market-research-view'

export * from './app-market-research-view'

// ─────────────────────────────────────────────────────────────
// App Market Research の保存層。
// アプリ1本 = 1レコードで、調査のたびにスナップショットを append する。
// 過去データは消さない。
// ─────────────────────────────────────────────────────────────

const FILE = 'app-market-research.json'

const EMPTY: MarketResearchStore = { updatedAt: '', apps: [] }

export async function readMarketResearch(): Promise<MarketResearchStore> {
  const store = await readJson<MarketResearchStore>(FILE, EMPTY)
  return {
    updatedAt: store?.updatedAt ?? '',
    apps: Array.isArray(store?.apps) ? store.apps : [],
  }
}

export interface UpsertResult {
  id: string
  appName: string
  /** 新規レコードとして追加したか、既存レコードへスナップショットを足したか。 */
  mode: 'new' | 'updated'
  snapshotCount: number
}

/**
 * 調査結果を保存する。同じアプリなら**行を増やさず**スナップショットを足す。
 * 同一時刻の重複投入だけは弾き、過去のスナップショットは決して消さない。
 */
export async function upsertMarketApps(inputs: MarketResearchInput[]): Promise<UpsertResult[]> {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('調査結果が空です')

  const store = await readMarketResearch()
  const byId = new Map(store.apps.map((app) => [app.id, app]))
  const now = new Date().toISOString()
  const results: UpsertResult[] = []

  for (const input of inputs) {
    if (!input?.appName?.trim()) throw new Error('appName は必須です')
    if (!input?.developer?.trim()) throw new Error(`${input.appName}: developer は必須です`)
    if (!input?.snapshot?.monetization) throw new Error(`${input.appName}: snapshot.monetization は必須です`)

    const id = buildAppKey(input)
    const snapshot = normalizeSnapshot(input.snapshot, input.snapshot.checkedAt ?? now)
    const existing = byId.get(id)

    if (existing) {
      // 同じ時刻のスナップショットが既にあるなら上書きする（二重投入の吸収）
      const sameMoment = existing.snapshots.findIndex((item) => item.checkedAt === snapshot.checkedAt)
      if (sameMoment >= 0) existing.snapshots[sameMoment] = snapshot
      else existing.snapshots.push(snapshot)

      // アプリ属性は「後から確認できた値」だけを上書きする（null で消さない）
      existing.appName = input.appName.trim()
      existing.developer = input.developer.trim()
      existing.developerScale = input.developerScale
      existing.appStoreUrl = input.appStoreUrl ?? existing.appStoreUrl
      existing.googlePlayUrl = input.googlePlayUrl ?? existing.googlePlayUrl
      existing.androidAvailable = input.androidAvailable ?? existing.androidAvailable
      existing.releaseDate = input.releaseDate ?? existing.releaseDate
      existing.ageSinceRelease = input.ageSinceRelease ?? existing.ageSinceRelease
      existing.category = input.category ?? existing.category
      existing.serverBurden = input.serverBurden ?? existing.serverBurden
      existing.operationBurden = input.operationBurden ?? existing.operationBurden
      existing.contentBurden = input.contentBurden ?? existing.contentBurden
      existing.ipRequirement = input.ipRequirement ?? existing.ipRequirement
      existing.whyGrowing = input.whyGrowing ?? existing.whyGrowing
      existing.differentiation = input.differentiation ?? existing.differentiation
      existing.lastCheckedAt = snapshot.checkedAt
      results.push({ id, appName: existing.appName, mode: 'updated', snapshotCount: existing.snapshots.length })
      continue
    }

    const app: MarketApp = {
      id,
      appName: input.appName.trim(),
      developer: input.developer.trim(),
      developerScale: input.developerScale,
      appStoreUrl: input.appStoreUrl ?? null,
      googlePlayUrl: input.googlePlayUrl ?? null,
      androidAvailable: input.androidAvailable ?? null,
      releaseDate: input.releaseDate ?? null,
      ageSinceRelease: input.ageSinceRelease ?? null,
      category: input.category ?? null,
      serverBurden: input.serverBurden ?? 'unknown',
      operationBurden: input.operationBurden ?? 'unknown',
      contentBurden: input.contentBurden ?? 'unknown',
      ipRequirement: input.ipRequirement ?? null,
      whyGrowing: input.whyGrowing ?? null,
      differentiation: input.differentiation ?? null,
      firstCheckedAt: snapshot.checkedAt,
      lastCheckedAt: snapshot.checkedAt,
      snapshots: [snapshot],
    }
    store.apps.push(app)
    byId.set(id, app)
    results.push({ id, appName: app.appName, mode: 'new', snapshotCount: 1 })
  }

  store.updatedAt = now
  await writeJson<MarketResearchStore>(FILE, store)
  return results
}

/** 調査プロンプトへ渡す「既出アプリ一覧」。重複登録を防ぐために必ず参照させる。 */
export function buildKnownAppsBrief(store: MarketResearchStore, limit = 60): string {
  const rows = buildRows(store)
  if (rows.length === 0) return '（まだ1件も調査していない。すべて新規候補になる）'
  return sortRows(rows, 'lastChecked')
    .slice(0, limit)
    .map((row) => {
      const rank = row.latest?.currentCategoryRank
      const rating = row.latest?.ratingCount
      return `- ${row.app.appName}（${row.app.developer} / ${DEVELOPER_SCALE_LABEL[row.app.developerScale]}）` +
        ` 前回=${row.app.lastCheckedAt.slice(0, 10)}` +
        ` カテゴリ順位=${rank ?? '確認できない'}` +
        ` 評価件数=${rating ?? '確認できない'}` +
        ` id=${row.app.id}`
    })
    .join('\n')
}
