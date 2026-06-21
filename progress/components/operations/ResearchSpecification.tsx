import Link from 'next/link'

const card =
  'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const heading = 'text-sm font-bold text-gray-900 dark:text-gray-100'
const body = 'text-xs leading-relaxed text-gray-600 dark:text-gray-300'

function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 flex flex-col items-stretch">
      {steps.map((step, index) => (
        <div key={step} className="flex flex-col items-center">
          {index > 0 && <span className="text-gray-300">↓</span>}
          <div className="w-full rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
            {step}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ResearchSpecification() {
  return (
    <article className="space-y-4">
      <section className={`${card} border-2 border-indigo-300`}>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          🔎 毎朝の調査のしくみ
        </h1>
        <p className={`mt-2 ${body}`}>
          毎朝AIが最新ツール・ニュース・市場を調査して記録し、効果がありそうな『試す候補』を自動で提案します。あなたが承認すれば、自動実行がその候補を試します。
        </p>
      </section>

      <section className={card}>
        <h2 className={heading}>全体の流れ</h2>
        <Flow
          steps={[
            '① 毎朝 AIが調査(ツール/ニュース/市場)',
            '② Vault と news-app に記録(1件=1カード)',
            '③ 自動実行が『導入価値評価(★)』を読む',
            '④ ★4以上を『試す候補ゴール』に変換',
            '⑤ ゴール承認(今日の判断)に提案',
            '⑥ あなたが承認 → 自動実行の対象に',
            '⑦ 試す系プロジェクトで達成まで進める',
          ]}
        />
      </section>

      <section className={card}>
        <h2 className={heading}>何を調査して、どこに溜まるか</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">
              🛠 AIツール調査(daily-ai-tools)
            </h3>
            <p className={`mt-2 ${body}`}>
              新しいAIツール/SDK/MCP等。各ツールに『導入価値評価(★1〜5)』が付く。←ここが自動提案の主な入力。
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">
              📰 AIニュース(daily-ai-news)
            </h3>
            <p className={`mt-2 ${body}`}>業界の動き・新モデル・発表。</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
            <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">
              📊 市場調査(daily-market-research)
            </h3>
            <p className={`mt-2 ${body}`}>競合・収益化のヒント。</p>
          </div>
        </div>
        <p className={`mt-3 ${body}`}>
          溜まる場所: Obsidian Vault の 06_research/ と、news-app の
          content/research/。1件=1つの『Research Topic
          カード』(TL;DR・重要度・確度・タグ・根拠・参考URL・収益化への示唆・次アクション
          を持つ構造化メモ)。
        </p>
      </section>

      <section className={card}>
        <h2 className={heading}>調査の自動実行ロジック</h2>
        <Flow
          steps={[
            '自動実行の最初に daily-ai-tools の最近の調査を読む',
            '各ツールの『## 導入価値評価』の★行を解析',
            '★4以上 = 試す価値あり と判定',
            '『○○を試す/調査する』ゴール候補を生成',
            '既存ゴール(全status)と重複する候補は除外',
            '承認待ちが上限(3)未満のときだけ提案を補充',
          ]}
        />
        <p className={`mt-3 ${body}`}>
          承認したものだけが自動実行の対象になります。承認待ちが減ると、次回また調査から候補が補充されます。
        </p>
      </section>

      <section className={card}>
        <h2 className={heading}>判定の基準</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px] text-gray-700 dark:text-gray-200">
            <thead className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-2 py-2 font-medium">評価</th>
                <th className="px-2 py-2 font-medium">扱い</th>
                <th className="px-2 py-2 font-medium">優先度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr>
                <td className="whitespace-nowrap px-2 py-2">★★★★★(5)</td>
                <td className="px-2 py-2">最優先で試す</td>
                <td className="px-2 py-2">高</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-2 py-2">★★★★(4)</td>
                <td className="px-2 py-2">試す価値あり</td>
                <td className="px-2 py-2">中</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-2 py-2">★★★以下</td>
                <td className="px-2 py-2">自動提案の対象外</td>
                <td className="px-2 py-2">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={`mt-3 ${body}`}>
          同じツール名の重複は最新・高評価を1件に集約。承認/却下済みの候補は蒸し返しません。
        </p>
      </section>

      <section className={card}>
        <h2 className={heading}>承認したあとの流れ</h2>
        <Flow
          steps={[
            '試す候補ゴールを承認(active化)',
            '自動実行が『次の一歩』を作って実装・検証',
            '完了してもゴール未達なら次の一歩を繰り返す',
            '進捗は『試す系』プロジェクトに表示',
          ]}
        />
      </section>

      <section className={card}>
        <h2 className={heading}>関連ページ</h2>
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <Link className="text-blue-600 dark:text-blue-400" href="/decide?tab=goalApproval">
            今日の判断 / ゴール承認
          </Link>
          <Link className="text-blue-600 dark:text-blue-400" href="/portfolio?tab=goals">
            プロジェクト×ゴール進捗(試す系)
          </Link>
          <Link className="text-blue-600 dark:text-blue-400" href="/guide?tab=system">
            自動実行の仕様
          </Link>
        </div>
      </section>
    </article>
  )
}
