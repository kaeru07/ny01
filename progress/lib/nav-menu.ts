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
    title: 'メイン（下タブ）',
    links: [
      { href: '/', label: 'ホーム（司令塔）', note: '全体の状況・次回自動実行予定・今日やること' },
      { href: '/decide', label: '今日の判断（Inbox）', note: '工場が止まる原因だけを判断する箱。毎日ここだけ見ればOK' },
      { href: '/queue', label: '自動実行（キュー）', note: 'AIが次に何をやるか・実行順・pin/保留/対象外の操作（実行）' },
      { href: '/app-proposals', label: 'アプリ開発', note: '新アプリ案・設計一覧・仕様承認・履歴を内蔵サブタブで確認' },
      { href: '/portfolio', label: '状況', note: 'プロジェクト状況。自動実行状況・PJ完了は内蔵サブタブから確認' },
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
      { href: '/ios-builds', label: 'iOSビルド', note: 'Codemagicビルド状況・TestFlight・ビルド候補の確認と実行' },
      { href: '/ios-signing-guide', label: 'iOS署名準備', note: '新規TestFlight対象アプリのApple/Codemagic入力値をコピペ用に確認' },
      { href: '/app-review-fields', label: '審査提出準備', note: 'App Store審査に貼る価格/著作権/カテゴリ/各URL/説明文を入力・保存してコピー' },
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
      { href: '/app-proposals', label: 'アプリ概要承認', note: 'アプリ案の概要+画面イメージ(モック)を確認して承認/却下/保留' },
      { href: '/app-specs', label: '仕様承認・履歴', note: '既存/開発中アプリの画面・機能仕様承認と承認・方針決定の履歴' },
      { href: '/skills', label: 'Skills管理', note: '実行手順(Skill)の品質集計・改善候補・更新履歴' },
      { href: '/ai-drive', label: 'AI自走', note: '自走モードの管理' },
      { href: '/codex', label: 'Codex', note: 'もう1つのAI実行者の管理' },
    ],
  },
  {
    title: '判断・記録',
    links: [
      { href: '/approvals', label: '承認待ち', note: '旧承認画面（新UIではInboxに統合）' },
      { href: '/decisions', label: '決定事項', note: '過去の判断の記録（Decision Log）' },
      { href: '/project-complete', label: 'プロジェクト完了', note: 'active/doneゴールだけを分母にした完了状況・もうすぐ完了・ゴール未設定プロジェクト' },
      { href: '/report', label: 'レポート', note: '実行履歴・作業レポート' },
      { href: '/inbox', label: '旧受信箱', note: 'Vault連携の受信箱' },
    ],
  },
  {
    title: '計画・候補',
    links: [
      { href: '/guide?tab=research', label: '毎朝の調査のしくみ(図解)', note: '毎朝の調査→試す候補の自動提案→承認→自動実行 の流れを図で説明' },
      { href: '/projects/import', label: 'プロジェクト＋ゴール追加(JSON)', note: 'プロジェクトとゴールを手動でまとめて追加。ゴールは自動実行対象になりキューで優先調整可' },
      { href: '/goal-planner', label: '目標（Goal）', note: '目標とtodoの作成・編集・並び替え（管理）' },
      { href: '/stalled-goals', label: '長期未解消', note: '承認済みなのに長期間動いていないGoalを原因・解消方法・見込みで整理' },
      { href: '/portfolio?tab=goals', label: 'プロジェクト×ゴール進捗', note: 'プロジェクト別にゴールと達成率を一覧。アプリはApp Store公開仕様で「完成」表示・未紐付けゴールも警告' },
      { href: '/project-goals', label: 'プロジェクト×ゴール一覧', note: 'プロジェクトとゴールの対応一覧（旧導線復活・孤立防止）' },
      { href: '/research-flow', label: '調査フロー', note: '調査→候補→承認→自動実行のフロー画面（旧導線復活・孤立防止）' },
      { href: '/goal-dashboard', label: 'ゴール進行ボード', note: 'ゴール×実作業の進行状況（Epic/Run基準）' },
      { href: '/recommended-epics', label: 'おすすめ次作業（推薦Epic）', note: 'AI提案の作業候補の全件管理' },
      { href: '/monetization', label: '収益化候補管理', note: 'アプリ候補のスコア・詳細管理' },
      { href: '/radar', label: '案件レーダー', note: '案件の状態マップ' },
      { href: '/projects', label: '案件一覧', note: '全案件（休止中含む）の管理' },
    ],
  },
  {
    title: 'アーカイブ（ほぼ使わない）',
    links: [
      { href: '/integration-map', label: '対応表（旧Vault→今のゴール運用）', note: '一時ページ。旧Vault運用と今のゴール運用の対応表＋統合の進め方①〜⑥' },
      { href: '/app-urls', label: 'アプリURL', note: '各アプリのURL一覧' },
      { href: '/daily', label: '日別', note: '日別の作業まとめ' },
      { href: '/legacy/home', label: '旧ダッシュボード', note: '以前のトップ画面（全部入り）' },
      { href: '/legacy', label: '画面一覧（Legacy）', note: '全画面のカテゴリ別ディレクトリ＋用語対応表' },
    ],
  },
]

// 全メニューリンクを平坦化（重複チェック・到達保証テスト用）。
export const ALL_NAV_LINKS: NavLink[] = NAV_GROUPS.flatMap((g) => g.links)
