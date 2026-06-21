// 全画面メニューの正本。ハンバーガーメニュー（HamburgerMenu）と画面一覧（/legacy）が
// この1ファイルを共有する。新しいページを追加したら必ずここへ1行足すこと（孤立ページ防止）。
//
// 方針: 「存在するページはタブかハンバーガーから必ず辿れる」。
// 主要画面は下タブ（BottomNav）にも出すが、全画面の到達保証はこのメニューが担う。
//
// 掲載対象外: リダイレクトのみのエイリアス（/operations→/automation, /pending→/tasks）と
// 親から開く詳細・新規ページ（/epic/[id], /epic/new, /projects/[id] など）。

export interface NavLink {
  href: string
  label: string
  note?: string
}

export interface NavGroup {
  title: string
  links: NavLink[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'メイン（下タブ先頭）',
    links: [
      { href: '/', label: 'ホーム（司令塔）', note: '全体の状況・次回自動実行予定・今日やること' },
      { href: '/decide', label: '今日の判断（Inbox）', note: '工場が止まる原因だけを判断する箱。毎日ここだけ見ればOK' },
      { href: '/portfolio', label: 'Project（案件ポートフォリオ）', note: '案件ごとの進捗・状態' },
      { href: '/goal-planner', label: '目標（Goal）', note: '目標の作成・編集と進捗' },
      { href: '/queue', label: '自動実行（キュー）', note: 'AIが次に何をやるか・なぜそれが次か' },
    ],
  },
  {
    title: 'よく使う',
    links: [
      { href: '/prompt-queue', label: '作業予約（Prompt Queue）', note: 'やってほしい作業を貯めておく。次回やる候補は定時に自動実行' },
      { href: '/tasks', label: 'ToDo管理', note: '細かいタスクの管理・着手判定' },
      { href: '/tasks/import', label: 'JSON取込', note: 'ChatGPT/ClaudeのJSONをToDoへ一括取り込み' },
      { href: '/verify-todos', label: '動作確認Todo', note: '人間が確認すべき画面・URL・手順のチェックリスト' },
      { href: '/logs', label: '実行履歴（作業ログ）', note: 'AIの作業履歴（Execution Run）の一覧' },
      { href: '/usage', label: '使用状況', note: 'このアプリ自身の使われ方（よく開く画面・ボタン操作・放置画面）' },
      { href: '/revenue', label: 'Revenue（収益）', note: '収益化の現在地・マイルストーン' },
      { href: '/guide', label: '運用ガイド', note: 'このアプリの使い方・最終更新' },
    ],
  },
  {
    title: 'AI工場（自動作業）',
    links: [
      { href: '/epic', label: '工場Epic（大きな作業）', note: '作業単位の管理・進行' },
      { href: '/automation', label: '自動化設定', note: 'AI工場のON/OFF・実行者の切替' },
      { href: '/factory/candidates', label: '工場候補', note: '自動実行の候補一覧' },
      { href: '/ai-drive', label: 'AI自走', note: '自走モードの管理' },
      { href: '/codex', label: 'Codex', note: 'もう1つのAI実行者の管理' },
    ],
  },
  {
    title: '判断・記録',
    links: [
      { href: '/approvals', label: '承認待ち', note: '旧承認画面（新UIではInboxに統合）' },
      { href: '/decisions', label: '決定事項', note: '過去の判断の記録（Decision Log）' },
      { href: '/inbox', label: '旧受信箱', note: 'Vault連携の受信箱' },
    ],
  },
  {
    title: '計画・候補',
    links: [
      { href: '/integration-map', label: '対応表（旧Vault→今のゴール運用）', note: '一時ページ。旧Vault運用と今のゴール運用の対応表＋統合の進め方①〜⑥' },
      { href: '/portfolio?tab=goals', label: 'プロジェクト×ゴール進捗', note: 'プロジェクト別にゴールと達成率を一覧。アプリはApp Store公開仕様で「完成」表示・未紐付けゴールも警告' },
      { href: '/goal-dashboard', label: 'ゴール達成率ダッシュボード', note: '全ゴールの状態内訳・達成率の俯瞰（進んでいない目標が上に出る）' },
      { href: '/recommended-epics', label: 'おすすめ次作業（推薦Epic）', note: 'AI提案の作業候補の全件管理' },
      { href: '/monetization', label: '収益化候補管理', note: 'アプリ候補のスコア・詳細管理' },
      { href: '/radar', label: '案件レーダー', note: '案件の状態マップ' },
      { href: '/projects', label: '案件一覧', note: '全案件（休止中含む）の管理' },
      { href: '/app-urls', label: 'アプリURL', note: '各アプリのURL一覧' },
    ],
  },
  {
    title: '全体管理・旧画面',
    links: [
      { href: '/morning', label: '朝会', note: '朝のブリーフィング画面' },
      { href: '/daily', label: '日別', note: '日別の作業まとめ' },
      { href: '/legacy/home', label: '旧ダッシュボード', note: '以前のトップ画面（全部入り）' },
      { href: '/legacy', label: '画面一覧（Legacy）', note: '全画面のカテゴリ別ディレクトリ＋用語対応表' },
    ],
  },
]

// 全メニューリンクを平坦化（重複チェック・到達保証テスト用）。
export const ALL_NAV_LINKS: NavLink[] = NAV_GROUPS.flatMap((g) => g.links)
