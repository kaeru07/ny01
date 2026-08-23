import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

// 実運用データ（data/real）を書き換えないよう、import 前に一時ディレクトリへ差し替える。
const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'app-market-research-test-'))
const ORIGINAL_DATA_PATH = process.env.PROGRESS_DATA_PATH
process.env.PROGRESS_DATA_PATH = TMP_DATA_DIR

after(() => {
  if (ORIGINAL_DATA_PATH === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = ORIGINAL_DATA_PATH
  fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true })
})

// eslint-disable-next-line import/first
import {
  buildAppKey,
  buildKnownAppsBrief,
  buildRows,
  extractAppStoreId,
  filterRows,
  judge,
  readMarketResearch,
  sortRows,
  upsertMarketApps,
  valueScore,
  type MarketResearchInput,
} from './app-market-research'

const APP_URL = 'https://apps.apple.com/jp/app/sample-app/id1234567890'

function input(overrides: Partial<MarketResearchInput> = {}): MarketResearchInput {
  return {
    appName: 'サンプル計測アプリ',
    developer: '個人開発者A',
    developerScale: 'individual',
    appStoreUrl: APP_URL,
    category: 'ユーティリティ',
    serverBurden: 'low',
    operationBurden: 'low',
    contentBurden: 'low',
    snapshot: {
      monetization: 'ads',
      hitType: 'surging',
      currentCategoryRank: 42,
      ratingCount: 820,
      reviewCount: 120,
      reproducibility: 4,
      sourceUrls: ['https://apps.apple.com/jp/app/id1234567890'],
      checkedAt: '2026-08-23T00:00:00.000Z',
    },
    ...overrides,
  }
}

test('App Store URL から一意キーを作り、同じアプリを重複登録しない', async () => {
  assert.equal(extractAppStoreId(APP_URL), '1234567890')
  assert.equal(extractAppStoreId('https://example.com/app'), null)
  assert.equal(buildAppKey({ appStoreUrl: APP_URL, appName: '別名でも同じ' }), 'as-1234567890')

  const first = await upsertMarketApps([input()])
  assert.equal(first[0].mode, 'new')

  // URLは同じで表記ゆれのある名前 → 同じレコードへスナップショット追加
  const second = await upsertMarketApps([
    input({
      appName: 'サンプル計測アプリ（表記ゆれ）',
      snapshot: { monetization: 'ads', currentCategoryRank: 18, ratingCount: 1140, checkedAt: '2026-08-24T00:00:00.000Z' },
    }),
  ])
  assert.equal(second[0].mode, 'updated')
  assert.equal(second[0].snapshotCount, 2)

  const store = await readMarketResearch()
  assert.equal(store.apps.length, 1, 'アプリのレコードは増えない')
  assert.equal(store.apps[0].snapshots.length, 2, 'スナップショットは積み上がる')
})

test('前回スナップショットとの差分を計算する（順位は上昇をプラスにする）', async () => {
  const rows = buildRows(await readMarketResearch())
  const row = rows[0]
  assert.equal(row.latest?.currentCategoryRank, 18)
  assert.equal(row.previous?.currentCategoryRank, 42)
  assert.equal(row.delta.categoryRank, 24, '42位→18位は +24 として扱う')
  assert.equal(row.delta.ratingCount, 320, '820件→1,140件は +320')
  assert.equal(row.snapshotCount, 2)
})

test('過去のスナップショットは消えない（同時刻の再投入だけ上書き）', async () => {
  await upsertMarketApps([
    input({ snapshot: { monetization: 'ads', currentCategoryRank: 19, checkedAt: '2026-08-24T00:00:00.000Z' } }),
  ])
  const store = await readMarketResearch()
  assert.equal(store.apps[0].snapshots.length, 2, '同時刻は行を増やさず上書き')
  assert.equal(store.apps[0].snapshots[0].currentCategoryRank, 42, '古いスナップショットは保持')
  assert.equal(store.apps[0].snapshots[1].currentCategoryRank, 19)
})

test('確認できない値は推測で埋めず null のままにする', async () => {
  await upsertMarketApps([
    {
      appName: '確認不能テスト',
      developer: '不明',
      developerScale: 'unknown',
      appStoreUrl: 'https://apps.apple.com/jp/app/x/id999888777',
      snapshot: { monetization: 'unknown', checkedAt: '2026-08-23T00:00:00.000Z' },
    },
  ])
  const store = await readMarketResearch()
  const app = store.apps.find((item) => item.id === 'as-999888777')
  assert.ok(app)
  assert.equal(app.snapshots[0].ratingCount, null)
  assert.equal(app.snapshots[0].currentCategoryRank, null)
  assert.deepEqual(app.snapshots[0].sourceUrls, [])
})

test('規模不明は本採用にせず参考候補、買い切りと大手は対象外にする', () => {
  const base = {
    id: 'x', appName: 'x', developer: 'x', appStoreUrl: null, googlePlayUrl: null, androidAvailable: null,
    releaseDate: null, ageSinceRelease: null, category: null, serverBurden: 'low' as const,
    operationBurden: 'low' as const, contentBurden: 'low' as const, ipRequirement: null,
    whyGrowing: null, differentiation: null, firstCheckedAt: '', lastCheckedAt: '', snapshots: [],
  }
  const snap = {
    checkedAt: '', hitType: 'both' as const, currentCategoryRank: 10, currentOverallRank: null,
    rankTrend30d: null, longTermHitEvidence: null, ratingCount: 100, reviewCount: null,
    googlePlayDownloads: null, googlePlayRatingCount: null, monetization: 'ads' as const,
    reproducibility: 5, updateNote: null, note: null, sourceUrls: [],
  }
  assert.equal(judge({ ...base, developerScale: 'individual' }, snap).verdict, 'adopt')
  assert.equal(judge({ ...base, developerScale: 'unknown' }, snap).verdict, 'reference')
  assert.equal(judge({ ...base, developerScale: 'excluded' }, snap).verdict, 'excluded')
  assert.equal(judge({ ...base, developerScale: 'individual' }, { ...snap, monetization: 'paid' }).verdict, 'excluded')
})

test('並び替えと絞り込みが指定どおりに効く', async () => {
  const rows = buildRows(await readMarketResearch())
  assert.equal(filterRows(rows, { developerScale: 'individual' }).length, 1)
  assert.equal(filterRows(rows, { verdict: 'reference' }).length, 1)
  assert.equal(filterRows(rows, { minReproducibility: 5 }).length, 0)
  assert.equal(filterRows(rows, { q: '計測' }).length, 1)

  const byValue = sortRows(rows, 'value')
  assert.equal(byValue[0].app.developerScale, 'individual', '規模不明より個人開発が上に来る')
  assert.ok(valueScore(byValue[0]) > valueScore(byValue[1]))

  const byRank = sortRows(rows, 'rank')
  assert.equal(byRank[0].latest?.currentCategoryRank, 19, '順位が上のものが先頭')
})

test('既出一覧のブリーフに前回値が入る（重複調査の防止に使う）', async () => {
  const brief = buildKnownAppsBrief(await readMarketResearch())
  assert.match(brief, /サンプル計測アプリ/)
  assert.match(brief, /as-1234567890/)
  assert.match(brief, /カテゴリ順位=19/)
})

test('必須項目が欠けた投入はエラーにする', async () => {
  await assert.rejects(() => upsertMarketApps([]), /空です/)
  await assert.rejects(
    () => upsertMarketApps([{ appName: '', developer: 'x', developerScale: 'individual', snapshot: { monetization: 'ads' } }]),
    /appName/,
  )
  await assert.rejects(
    () => upsertMarketApps([{ appName: 'x', developer: '', developerScale: 'individual', snapshot: { monetization: 'ads' } }]),
    /developer/,
  )
})
