import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import { NAV_GROUPS } from '@/lib/nav-menu'

// Legacy = 全画面のカテゴリ別ディレクトリ。機能・データ・APIは何も削除していない。
// 画面の一覧は lib/nav-menu.ts（ハンバーガーメニューと共有の正本）を参照する＝二重管理しない。
const groups = NAV_GROUPS

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
        guide="全画面の一覧（カテゴリ別）です。各画面は下タブ（横スクロール）からも直接開けます。機能もデータも削除されていません。普段の運用は下タブ先頭の ホーム / ToDo / Project / 目標 / 自動実行 で足ります。"
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
