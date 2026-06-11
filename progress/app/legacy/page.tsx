import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'

// Legacy = 旧Progressの全画面への入口。機能・データ・APIは何も削除していない。
// 新UI（司令塔 / Inbox / Projects / Revenue）で足りないときだけここから旧画面を開く。

const groups: Array<{ title: string; links: Array<{ href: string; label: string; note: string }> }> = [
  {
    title: '全体管理',
    links: [
      { href: '/legacy/home', label: '旧ダッシュボード', note: '以前のトップ画面（Goal/Epic/Metrics/Queue分離の全部入り）' },
      { href: '/morning', label: '朝会', note: '朝のブリーフィング画面' },
      { href: '/daily', label: '日別', note: '日別の作業まとめ' },
    ],
  },
  {
    title: 'AI工場（自動作業）',
    links: [
      { href: '/epic', label: 'AI工場（大きな作業 = Epic）', note: '作業単位の管理・進行' },
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
      { href: '/logs', label: '作業ログ', note: 'AIの作業履歴（Execution Run）の一覧' },
      { href: '/inbox', label: '旧受信箱', note: 'Vault連携の受信箱' },
      { href: '/pending', label: 'ペンディング', note: '保留中の項目' },
    ],
  },
  {
    title: '計画・候補',
    links: [
      { href: '/goal-planner', label: '目標（Goal）管理', note: '目標の作成・編集' },
      { href: '/recommended-epics', label: 'おすすめ次作業（推薦Epic）', note: 'AI提案の作業候補の全件管理' },
      { href: '/monetization', label: '収益化候補管理', note: 'アプリ候補のスコア・詳細管理' },
      { href: '/tasks', label: 'ToDo', note: '細かいタスク管理' },
      { href: '/queue', label: '今日の作業順番', note: '作業キューの並び替え' },
    ],
  },
  {
    title: '案件・その他',
    links: [
      { href: '/projects', label: '案件一覧', note: '全案件（休止中含む）の管理' },
      { href: '/radar', label: '案件レーダー', note: '案件の状態マップ' },
      { href: '/app-urls', label: 'アプリURL', note: '各アプリのURL一覧' },
    ],
  },
]

// 旧画面で使われる専門用語の対訳。新UIでは右側の言葉だけを使う。
const glossary: Array<[string, string, string]> = [
  ['Goal', '目標', '会社として目指す方向'],
  ['Epic', '大きな作業', '1つのまとまった作業単位'],
  ['Knowledge', '学習結果', '終わった作業から取り出した学び'],
  ['Execution Run', '作業履歴', 'AIが行った1回の作業の記録'],
  ['Factory', 'AI工場', '安全な作業をAIが自動で進める仕組み'],
  ['Suggested Epic', 'おすすめ次作業', 'AIが提案する次の作業候補'],
  ['Closed Loop Rate', '自動化率', 'AIが人間の介入なしで作業を終え、学習まで残せた割合'],
  ['not_reviewed', '未確認の作業履歴', 'まだ内容確認が済んでいないAIの作業結果'],
  ['needs_human', 'あなたの判断待ち', '人間の判断を待っている項目'],
]

export default function LegacyPage() {
  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide
        title="Legacy（旧画面）"
        guide="以前のProgressの全画面はここから開けます。機能もデータも削除されていません。普段の運用は司令塔・Inbox・Projectsだけで足ります。"
      />

      {groups.map((group) => (
        <section key={group.title} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">{group.title}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{link.label}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{link.note}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">用語の対応表</h2>
        <p className="mb-2 text-[11px] text-gray-400">旧画面に出てくる専門用語は、新画面では以下の言葉に置き換えています。</p>
        <ul className="space-y-1.5">
          {glossary.map(([en, ja, help]) => (
            <li key={en} className="text-xs">
              <span className="font-mono text-gray-400">{en}</span>
              <span className="mx-1.5 text-gray-300">→</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{ja}</span>
              <span className="ml-1.5 text-gray-400">（{help}）</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
