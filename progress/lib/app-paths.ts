import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_APP_CWD = '/root/company/apps/ny01/progress'
export const GENERATED_APPS_ROOT = '/root/company/apps/generated'

const APP_CWD_BY_TARGET = new Map<string, string>([
  ['progress', DEFAULT_APP_CWD],
  ['ny01/progress', DEFAULT_APP_CWD],
  ['company-mgmt', DEFAULT_APP_CWD],
  ['try-research', DEFAULT_APP_CWD],
  ['autoexec-test-proj', DEFAULT_APP_CWD],
  ['news-app', '/root/company/apps/ny01/news-app'],
  ['ny01-news-app', '/root/company/apps/ny01/news-app'],
  ['anglerlog', '/root/company/apps/ny01/anglerlog'],
  ['birdlog', '/root/company/apps/ny01/birdlog'],
  ['mahjong', '/root/company/apps/mahjong'],
  // 麻雀系アプリ（ny01 モノレポ配下・news-app と同じ扱い）。
  // 未登録だと factory が「repoパス未登録」で毎回スキップし自動実行がアイドル化していた（2026-08-09 修正）。
  ['mahjong-trainer', '/root/company/apps/ny01/mahjong-trainer'],
  ['ny01-mahjong-trainer', '/root/company/apps/ny01/mahjong-trainer'],
  ['ny01/mahjong-trainer', '/root/company/apps/ny01/mahjong-trainer'],
  ['mahjong-analyzer', '/root/company/apps/ny01/mahjong-analyzer'],
  ['ny01-mahjong-analyzer', '/root/company/apps/ny01/mahjong-analyzer'],
  ['ny01/mahjong-analyzer', '/root/company/apps/ny01/mahjong-analyzer'],
  ['mahjong-quiz', '/root/company/apps/ny01/mahjong-quiz'],
  ['ny01-mahjong-quiz', '/root/company/apps/ny01/mahjong-quiz'],
])

export function resolveAppCwd(targetApp?: string | null): string | null {
  const key = targetApp?.trim()
  if (!key) return DEFAULT_APP_CWD
  const mapped = APP_CWD_BY_TARGET.get(key)
  if (mapped) return mapped
  if (!/^[a-z0-9-]+$/.test(key)) return null
  const generatedPath = path.join(GENERATED_APPS_ROOT, key)
  return fs.existsSync(generatedPath) && fs.statSync(generatedPath).isDirectory() ? generatedPath : null
}
