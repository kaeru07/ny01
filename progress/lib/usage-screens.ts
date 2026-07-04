// progress の「画面」レジストリ。ルート → 人間語の画面名 の対応表。
// 使用状況の集計（/usage）と未使用画面（放置検知）で正本として使う。
// ナビ（BottomNav / TopNav）の対応表と整合させること。

export interface ScreenDef {
  href: string
  label: string
}

// 主要画面のみを登録する（動的詳細ページ /xxx/[id] は親画面に丸める）。
export const SCREENS: ScreenDef[] = [
  { href: '/', label: 'ホーム（司令塔）' },
  { href: '/decide', label: '今日の判断（Inbox）' },
  { href: '/portfolio', label: 'Project' },
  { href: '/goal-planner', label: '目標' },
  { href: '/queue', label: '自動実行' },
  { href: '/prompt-queue', label: '作業予約' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/guide', label: '運用ガイド' },
  { href: '/logs', label: '実行履歴' },
  { href: '/tasks', label: 'ToDo管理' },
  { href: '/tasks/import', label: 'JSON取込' },
  { href: '/verify-todos', label: '動作確認' },
  { href: '/recommended-epics', label: 'おすすめEpic' },
  { href: '/monetization', label: '収益化' },
  { href: '/approvals', label: '承認' },
  { href: '/automation', label: '自動化' },
  { href: '/epic', label: '工場Epic' },
  { href: '/codex', label: 'Codex' },
  { href: '/daily', label: '日別' },
  { href: '/ai-drive', label: 'AI自走' },
  { href: '/radar', label: 'レーダー' },
  { href: '/projects', label: '案件' },
  { href: '/inbox', label: '旧Inbox' },
  { href: '/decisions', label: '決定事項' },
  { href: '/factory/candidates', label: '工場候補' },
  { href: '/app-urls', label: 'URL一覧' },
  { href: '/usage', label: '使用状況' },
  { href: '/legacy', label: '画面一覧（Legacy）' },
]

// 長い prefix を優先して照合するための事前ソート（/tasks/import を /tasks より先に当てる）。
const SORTED = [...SCREENS].sort((a, b) => b.href.length - a.href.length)

/** 任意のパスを、登録済み画面の href に丸める（詳細ページ → 親画面）。未登録はそのまま返す。 */
export function canonicalScreen(path: string): string {
  const exact = SCREENS.find((s) => s.href === path)
  if (exact) return exact.href
  const pre = SORTED.find((s) => s.href !== '/' && path.startsWith(s.href + '/'))
  if (pre) return pre.href
  if (path === '/') return '/'
  return path
}

/** パスを人間語の画面名に変換する。未登録はパスをそのまま返す。 */
export function screenLabel(path: string): string {
  const href = canonicalScreen(path)
  const def = SCREENS.find((s) => s.href === href)
  return def ? def.label : href
}
