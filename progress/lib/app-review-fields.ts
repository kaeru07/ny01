import fs from 'node:fs'
import path from 'node:path'

import { buildAppReviewCopyText, type AppReviewCopyRow } from './app-review-copy'
import { APP_REVIEW_GROUPS, type AppReviewGroupDef } from './app-review-groups'
import { getIosSigningGuideApps } from './ios-signing-guide'
import { readJson, writeJson } from './store'

export { APP_REVIEW_GROUPS }
export type { AppReviewGroupDef }

// ─────────────────────────────────────────────────────────────
// 審査提出準備（/app-review-fields）
//
// App Store Connect の審査提出時に入力する値を、アプリごとに人が入力・保存し、
// 項目単位／全文でコピーできるようにする。値の解決は
//   保存値（人の入力） > 自動既定値（fastlane/metadata・apps.json） > 空
// の優先度。保存値は app-review-fields.json に置く。
//
// 注意: このリポジトリ（ny01）は公開リポジトリで data/real も追跡対象のため、
// 審査用デモアカウントのID/パスワードや連絡先電話番号などの機密情報は
// ここに保存しない。画面側でも注意書きを出している。
// ─────────────────────────────────────────────────────────────

export type AppReviewFieldKey =
  | 'screenshotNote'
  | 'releaseNotes'
  | 'promotionalText'
  | 'description'
  | 'keywords'
  | 'supportUrl'
  | 'marketingUrl'
  | 'version'
  | 'copyright'
  | 'reviewNotes'
  | 'releaseMethod'
  | 'name'
  | 'subtitle'
  | 'primaryCategory'
  | 'secondaryCategory'
  | 'privacyPolicyUrl'
  | 'price'
  | 'availability'
  | 'appPrivacy'
  | 'ageRatingNote'

export interface AppReviewFieldDef {
  key: AppReviewFieldKey
  label: string
  /** true なら textarea で表示する。 */
  multiline: boolean
  placeholder: string
  /** 画面のカード分けに使う見出し（APP_REVIEW_GROUPS の name と一致させる）。 */
  group: string
  /** App Store Connect 側の文字数上限。超過は画面で警告する。 */
  maxLength?: number
}

export const APP_REVIEW_FIELD_DEFS: AppReviewFieldDef[] = [
  { key: 'screenshotNote', label: 'スクリーンショット準備メモ', multiline: true, placeholder: '例: 6.5インチ 5枚作成済み / iPad 13インチ 未作成', group: 'プレビューとスクリーンショット' },
  { key: 'releaseNotes', label: 'このバージョンの新機能', multiline: true, placeholder: 'アップデート時のみ必須。新規申請では空でよい', group: 'バージョン情報', maxLength: 4000 },
  { key: 'promotionalText', label: 'プロモーション用テキスト', multiline: true, placeholder: '審査なしで更新できる宣伝文', group: 'バージョン情報', maxLength: 170 },
  { key: 'description', label: '概要', multiline: true, placeholder: 'アプリの説明文', group: 'バージョン情報', maxLength: 4000 },
  { key: 'keywords', label: 'キーワード', multiline: true, placeholder: 'カンマ区切り', group: 'バージョン情報', maxLength: 100 },
  { key: 'supportUrl', label: 'サポートURL', multiline: false, placeholder: 'https://kaeru07.github.io/support/<app>.html', group: 'バージョン情報' },
  { key: 'marketingUrl', label: 'マーケティングURL', multiline: false, placeholder: '任意', group: 'バージョン情報' },
  { key: 'version', label: 'バージョン', multiline: false, placeholder: '例: 1.0.0', group: 'バージョン情報' },
  { key: 'copyright', label: '著作権', multiline: false, placeholder: '例: 2026 kaeru07', group: 'バージョン情報', maxLength: 200 },
  { key: 'reviewNotes', label: 'メモ', multiline: true, placeholder: '審査担当者への補足（デモアカウントのID/パスワードは書かない）', group: 'App Reviewに関する情報', maxLength: 4000 },
  { key: 'releaseMethod', label: 'リリース方法', multiline: false, placeholder: '手動でリリース / 自動でリリース / 日付指定', group: 'App Storeバージョンのリリース' },
  { key: 'name', label: 'Name', multiline: false, placeholder: 'App Store に表示するアプリ名', group: 'App情報（ASCでは別ページ）', maxLength: 30 },
  { key: 'subtitle', label: 'Subtitle', multiline: false, placeholder: 'サブタイトル', group: 'App情報（ASCでは別ページ）', maxLength: 30 },
  { key: 'primaryCategory', label: 'カテゴリ (Primary)', multiline: false, placeholder: '例: GAMES', group: 'App情報（ASCでは別ページ）' },
  { key: 'secondaryCategory', label: 'カテゴリ (Secondary)', multiline: false, placeholder: '任意', group: 'App情報（ASCでは別ページ）' },
  { key: 'privacyPolicyUrl', label: 'プライバシーポリシーURL', multiline: false, placeholder: 'https://kaeru07.github.io/privacy/<app>.html', group: 'App情報（ASCでは別ページ）' },
  { key: 'price', label: '価格', multiline: false, placeholder: '例: 無料（¥0）', group: '価格および配信状況（ASCでは別ページ）' },
  { key: 'availability', label: '配信地域', multiline: false, placeholder: '例: 全世界', group: '価格および配信状況（ASCでは別ページ）' },
  { key: 'appPrivacy', label: 'データ収集状況', multiline: false, placeholder: '例: データを収集しません（Data Not Collected）', group: 'Appのプライバシー・年齢レーティング（ASCでは別ページ）' },
  { key: 'ageRatingNote', label: '年齢レーティング', multiline: true, placeholder: '質問票で答える内容のメモ', group: 'Appのプライバシー・年齢レーティング（ASCでは別ページ）' },
]

/** 1項目あたりの保存上限。App Store Connect の概要欄（4000文字）に合わせる。 */
export const APP_REVIEW_FIELD_MAX_LENGTH = 4000

const OVERRIDE_FILE = 'app-review-fields.json'

/** 値の出どころ。画面でバッジ表示する。 */
export type AppReviewFieldSource = 'saved' | 'auto' | 'empty'

export interface AppReviewField extends AppReviewFieldDef {
  value: string
  /** 保存値を消したときに戻る自動既定値。 */
  autoValue: string
  source: AppReviewFieldSource
}

export interface AppReviewApp {
  id: string
  appName: string
  bundleId: string
  appPathLabel: string
  hasMetadata: boolean
  fields: AppReviewField[]
  copyText: string
  /** 保存値の最終更新時刻。未保存なら null。 */
  savedAt: string | null
}

interface AppReviewOverrideEntry {
  fields: Partial<Record<AppReviewFieldKey, string>>
  updatedAt: string
}

export interface AppReviewOverrideStore {
  updatedAt: string
  apps: Record<string, AppReviewOverrideEntry>
}

const EMPTY_STORE: AppReviewOverrideStore = { updatedAt: '', apps: {} }

function isFieldKey(value: string): value is AppReviewFieldKey {
  return APP_REVIEW_FIELD_DEFS.some((def) => def.key === value)
}

async function readOverrides(): Promise<AppReviewOverrideStore> {
  const store = await readJson<AppReviewOverrideStore>(OVERRIDE_FILE, EMPTY_STORE)
  const apps = store && typeof store.apps === 'object' && store.apps !== null ? store.apps : {}
  return { updatedAt: store?.updatedAt ?? '', apps }
}

function readMetadata(filePath: string): string | null {
  try {
    const value = fs.readFileSync(filePath, 'utf8').trim()
    return value || null
  } catch {
    return null
  }
}

/**
 * 年齢レーティング質問票のガイダンス文。
 * 麻雀アプリは「シミュレートされたギャンブル」の該当有無を毎回聞かれるため、
 * 対象アプリのときだけ注意書きを足す（他アプリに麻雀固有の文言を出さない）。
 */
function buildAgeRatingNote(appName: string, bundleId: string): string {
  const base = '年齢レーティング質問票に回答し、App Store Connect 側の判定結果を確認する。'
  const isMahjong = /mahjong/i.test(bundleId) || appName.includes('麻雀')
  if (!isMahjong) return base
  return `${base} 麻雀アプリのため「シミュレートされたギャンブル」該当有無を要確認（賭博・課金・オンライン対戦がなければ該当しない想定）。`
}

/** Xcode プロジェクトの MARKETING_VERSION を App Store のバージョン既定値として読む。 */
function readAppVersion(appDir: string): string {
  const pbxproj = path.join(appDir, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')
  const raw = readMetadata(pbxproj)
  const matched = raw ? /MARKETING_VERSION = ([^;]+);/.exec(raw) : null
  return matched ? matched[1].trim() : ''
}

/** fastlane/metadata・apps.json から取れる自動既定値。人の保存値が無いときに使う。 */
function buildAutoValues(base: ReturnType<typeof getIosSigningGuideApps>[number]): Record<AppReviewFieldKey, string> {
  const metadataDir = path.join(base.appDir, 'fastlane', 'metadata')
  const jaDir = path.join(metadataDir, 'ja')
  const meta = (...segments: string[]) => readMetadata(path.join(...segments)) ?? ''

  return {
    screenshotNote: '',
    releaseNotes: meta(jaDir, 'release_notes.txt'),
    promotionalText: meta(jaDir, 'promotional_text.txt'),
    description: meta(jaDir, 'description.txt'),
    keywords: meta(jaDir, 'keywords.txt'),
    supportUrl: base.supportUrl ?? meta(jaDir, 'support_url.txt'),
    marketingUrl: meta(jaDir, 'marketing_url.txt'),
    version: readAppVersion(base.appDir),
    copyright: meta(metadataDir, 'copyright.txt'),
    reviewNotes: '',
    releaseMethod: '手動でリリース',
    name: meta(jaDir, 'name.txt') || base.appName,
    subtitle: meta(jaDir, 'subtitle.txt'),
    primaryCategory: meta(metadataDir, 'primary_category.txt'),
    secondaryCategory: meta(metadataDir, 'secondary_category.txt'),
    privacyPolicyUrl: base.privacyPolicyUrl ?? meta(jaDir, 'privacy_url.txt'),
    price: '無料（¥0）',
    availability: '全世界',
    appPrivacy: 'データを収集しません（Data Not Collected）',
    ageRatingNote: buildAgeRatingNote(base.appName, base.bundleId),
  }
}

function buildApp(
  base: ReturnType<typeof getIosSigningGuideApps>[number],
  override: AppReviewOverrideEntry | undefined,
): AppReviewApp {
  const autoValues = buildAutoValues(base)
  const saved = override?.fields ?? {}

  const fields: AppReviewField[] = APP_REVIEW_FIELD_DEFS.map((def) => {
    const savedValue = typeof saved[def.key] === 'string' ? (saved[def.key] as string) : ''
    const autoValue = autoValues[def.key]
    const value = savedValue || autoValue
    const source: AppReviewFieldSource = savedValue ? 'saved' : value ? 'auto' : 'empty'
    return { ...def, value, autoValue, source }
  })

  const rows: AppReviewCopyRow[] = fields.map((field) => ({ label: field.label, value: field.value }))

  return {
    id: base.id,
    appName: base.appName,
    bundleId: base.bundleId,
    appPathLabel: base.appPathLabel,
    hasMetadata: fs.existsSync(path.join(base.appDir, 'fastlane', 'metadata')),
    fields,
    copyText: buildAppReviewCopyText(base, rows),
    savedAt: override?.updatedAt ?? null,
  }
}

/** 審査提出準備の全アプリ分（保存値マージ済み）を返す。 */
export async function getAppReviewFields(): Promise<AppReviewApp[]> {
  const overrides = await readOverrides()
  return getIosSigningGuideApps().map((base) => buildApp(base, overrides.apps[base.bundleId]))
}

/**
 * 1アプリ分の入力値を保存する。
 * - ホワイトリスト外のキーは無視する
 * - 空文字は「保存値を消して自動既定値に戻す」意味として扱う
 * - 未知の bundleId・型違い・文字数超過はエラー（呼び出し側で 400 にする）
 */
export async function saveAppReviewFields(
  bundleId: string,
  fields: Record<string, unknown>,
): Promise<AppReviewApp> {
  const base = getIosSigningGuideApps().find((app) => app.bundleId === bundleId)
  if (!base) throw new Error(`未知の bundleId です: ${bundleId}`)
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    throw new Error('fields はオブジェクトで指定してください')
  }

  const store = await readOverrides()
  const current = store.apps[bundleId]?.fields ?? {}
  const next: Partial<Record<AppReviewFieldKey, string>> = { ...current }

  for (const [key, raw] of Object.entries(fields)) {
    if (!isFieldKey(key)) continue
    if (typeof raw !== 'string') throw new Error(`${key} は文字列で指定してください`)
    if (raw.length > APP_REVIEW_FIELD_MAX_LENGTH) {
      throw new Error(`${key} が長すぎます（${APP_REVIEW_FIELD_MAX_LENGTH}文字以内）`)
    }
    if (raw.trim() === '') delete next[key]
    else next[key] = raw
  }

  const now = new Date().toISOString()
  const nextStore: AppReviewOverrideStore = {
    updatedAt: now,
    apps: { ...store.apps, [bundleId]: { fields: next, updatedAt: now } },
  }
  await writeJson<AppReviewOverrideStore>(OVERRIDE_FILE, nextStore)

  return buildApp(base, nextStore.apps[bundleId])
}
