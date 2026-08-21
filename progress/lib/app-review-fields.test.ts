import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

// 実運用データ（data/real）を書き換えないよう、import 前に一時ディレクトリへ差し替える。
const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'app-review-fields-test-'))
const ORIGINAL_DATA_PATH = process.env.PROGRESS_DATA_PATH

before(() => {
  process.env.PROGRESS_DATA_PATH = TMP_DATA_DIR
})

after(() => {
  if (ORIGINAL_DATA_PATH === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = ORIGINAL_DATA_PATH
  fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true })
})

process.env.PROGRESS_DATA_PATH = TMP_DATA_DIR

// eslint-disable-next-line import/first
import { APP_REVIEW_FIELD_DEFS, APP_REVIEW_GROUPS, getAppReviewFields, saveAppReviewFields } from './app-review-fields'

const ANALYZER_BUNDLE_ID = 'com.kaeru07.mahjonganalyzer'

function fieldOf(app: { fields: Array<{ key: string; value: string; source: string; autoValue: string }> }, key: string) {
  const field = app.fields.find((item) => item.key === key)
  assert.ok(field, `field ${key} が見つかりません`)
  return field
}

async function findAnalyzer() {
  const apps = await getAppReviewFields()
  const app = apps.find((item) => item.bundleId === ANALYZER_BUNDLE_ID)
  assert.ok(app, 'mahjong-analyzer が見つかりません')
  return app
}

test('App Store審査提出用のfastlaneメタデータを表示する', async () => {
  const apps = await getAppReviewFields()
  const mahjong = await findAnalyzer()

  assert.ok(Array.isArray(apps))
  assert.equal(fieldOf(mahjong, 'name').value, '麻雀手牌解析AI')
  assert.ok(fieldOf(mahjong, 'keywords').value)
  assert.equal(fieldOf(mahjong, 'privacyPolicyUrl').value, 'https://kaeru07.github.io/privacy/mahjong-analyzer.html')
  assert.match(mahjong.copyText, /麻雀手牌解析AI/)
  assert.equal(mahjong.hasMetadata, true)
})

test('年齢レーティングの注意書きは麻雀アプリにだけギャンブル項目を出す', async () => {
  const apps = await getAppReviewFields()
  const mahjong = await findAnalyzer()
  const nonMahjong = apps.find((app) => !/mahjong/i.test(app.bundleId) && !app.appName.includes('麻雀'))

  assert.match(fieldOf(mahjong, 'ageRatingNote').value, /シミュレートされたギャンブル/)
  assert.ok(nonMahjong)
  assert.doesNotMatch(fieldOf(nonMahjong, 'ageRatingNote').value, /麻雀|ギャンブル/)
})

test('保存した入力値はfastlane既定値より優先され、copyTextにも反映される', async () => {
  const saved = await saveAppReviewFields(ANALYZER_BUNDLE_ID, { copyright: '2026 テスト著作権', reviewNotes: '審査メモ' })

  assert.equal(fieldOf(saved, 'copyright').value, '2026 テスト著作権')
  assert.equal(fieldOf(saved, 'copyright').source, 'saved')
  assert.match(saved.copyText, /2026 テスト著作権/)
  assert.ok(saved.savedAt)

  // 再読込しても保存値が残る
  const reloaded = await findAnalyzer()
  assert.equal(fieldOf(reloaded, 'copyright').value, '2026 テスト著作権')
  assert.equal(fieldOf(reloaded, 'reviewNotes').value, '審査メモ')
})

test('空文字を保存すると自動既定値に戻る', async () => {
  await saveAppReviewFields(ANALYZER_BUNDLE_ID, { copyright: '2026 消される値' })
  const cleared = await saveAppReviewFields(ANALYZER_BUNDLE_ID, { copyright: '' })

  const field = fieldOf(cleared, 'copyright')
  assert.equal(field.value, field.autoValue)
  assert.equal(field.source, 'auto')
})

test('未知キーは無視し、未知bundleId・型違い・長すぎる値はエラーにする', async () => {
  const saved = await saveAppReviewFields(ANALYZER_BUNDLE_ID, { unknownKey: 'x', subtitle: '審査用サブタイトル' })
  assert.equal(fieldOf(saved, 'subtitle').value, '審査用サブタイトル')
  assert.equal((saved.fields as Array<{ key: string }>).some((field) => field.key === 'unknownKey'), false)

  await assert.rejects(() => saveAppReviewFields('com.example.unknown', { subtitle: 'x' }), /未知の bundleId/)
  await assert.rejects(() => saveAppReviewFields(ANALYZER_BUNDLE_ID, { subtitle: 123 as unknown as string }), /文字列/)
  await assert.rejects(() => saveAppReviewFields(ANALYZER_BUNDLE_ID, { subtitle: 'あ'.repeat(4001) }), /長すぎます/)
})

test('入力欄の並びはApp Store Connectのバージョンページの順に固定する', async () => {
  const mahjong = await findAnalyzer()

  // グループ順（ASCの画面順）
  assert.deepEqual(
    APP_REVIEW_GROUPS.map((group) => group.name).slice(0, 4),
    ['プレビューとスクリーンショット', 'バージョン情報', 'App Reviewに関する情報', 'App Storeバージョンのリリース'],
  )

  // バージョン情報グループの項目順
  assert.deepEqual(
    APP_REVIEW_FIELD_DEFS.filter((def) => def.group === 'バージョン情報').map((def) => def.key),
    ['releaseNotes', 'promotionalText', 'description', 'keywords', 'supportUrl', 'marketingUrl', 'version', 'copyright'],
  )

  // アプリ側の fields も同じ並びで返る
  assert.deepEqual(mahjong.fields.map((field) => field.key), APP_REVIEW_FIELD_DEFS.map((def) => def.key))
})

test('ASCの文字数上限を項目に持ち、バージョンはXcodeのMARKETING_VERSIONを初期値にする', async () => {
  const mahjong = await findAnalyzer()
  const limits = Object.fromEntries(APP_REVIEW_FIELD_DEFS.map((def) => [def.key, def.maxLength]))

  assert.equal(limits.promotionalText, 170)
  assert.equal(limits.description, 4000)
  assert.equal(limits.keywords, 100)
  assert.equal(limits.copyright, 200)
  assert.equal(limits.name, 30)
  assert.equal(limits.subtitle, 30)
  assert.equal(limits.supportUrl, undefined)

  assert.match(fieldOf(mahjong, 'version').value, /^\d+(\.\d+)*$/)
})
