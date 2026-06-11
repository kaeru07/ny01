export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import { TERMS, buildInbox, buildRevenueMilestones } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'
import { getAutomationConfig } from '@/lib/operations-store'
import { readOperatingModelMeta } from '@/lib/operating-model'

// 📖 運用 = Progress が自分の使い方を説明するページ。
// 初見ユーザーが5分で「このアプリは何か / 今日何をやるか / AI工場がどう動くか」を
// 理解できることだけを目的にする。内部構造・専門用語は見せない。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const h2 = 'text-sm font-bold text-gray-900 dark:text-gray-100'
const body = 'text-xs leading-relaxed text-gray-600 dark:text-gray-300'

function FlowSteps({ steps }: { steps: string[] }) {
  return (
    <div className="mt-3 flex flex-col items-stretch gap-1">
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          {i > 0 && <span className="text-gray-300 dark:text-gray-600">↓</span>}
          <span className="w-full rounded-lg bg-gray-50 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
            {s}
          </span>
        </div>
      ))}
    </div>
  )
}

const FAQ: Array<{ q: string; a: string }> = [
  { q: '毎日何をすればいい？', a: 'Inbox（今日の判断）だけ見れば大丈夫です。カードごとに「はい・いいえ・あとで」を選ぶだけで、3〜5分で終わります。空なら何もしなくてOKです。' },
  { q: 'Goalって何？', a: 'AI工場が向かう目標です。すべての大きな作業はどれかの目標に紐付き、目標のない作業はInboxで紐付けを求められます。' },
  { q: 'レビュー待ちが増えても大丈夫？', a: '大丈夫です。レビューが100件たまっても工場は止まりません（2026-06-11の方針変更）。工場が止まるのは「危険判断待ち」「目標未設定」「人間作業待ち」だけです。レビューは時間があるときに「AIにまとめて確認させる」で片付けられます。' },
  { q: 'AI保留って何？', a: '人間が判断する必要のないもの（AIレビュー・候補整理・定期実行・重複・内容不足）をAIが預かっている状態です。件数だけ表示され、あなたの判断は不要です。' },
  { q: 'Legacyタブは何？', a: '以前の画面がそのまま残っている場所です。普段は使いません。細かいデータを見たいときだけ開いてください。' },
  { q: 'AI工場を止めたいときは？', a: 'Legacy内の「自動化」画面からオフにできます。オフの間、AIは新しい作業を始めません。' },
]

export default async function OperationsGuidePage() {
  const [inbox, metrics, milestones, config, meta] = await Promise.all([
    buildInbox(),
    computeFactoryMetrics(),
    buildRevenueMilestones(),
    getAutomationConfig(),
    readOperatingModelMeta(),
  ])

  // セクション4: 今日やること（①今日の判断=工場停止要因のみ。②③は参考）
  const countBy = (kinds: string[]) => inbox.decisions.filter((i) => kinds.includes(i.kind)).length
  const todayLines = [
    { label: '危険判断（影響が大きい操作の許可）', count: countBy(['danger']) },
    { label: '方針選択（目標・優先順位を選ぶ）', count: countBy(['direction']) },
    { label: '人間作業（AIでは実行できない作業）', count: countBy(['human_task']) },
  ].filter((l) => l.count > 0)
  const estimatedMinutes = inbox.estimatedMinutes

  // セクション3: AI工場の流れ + ボトルネック表示
  const factoryStages = ['目標', '大きな作業', 'AI作業', 'レビュー', '学習', '次の作業']
  // ボトルネック表示 = 工場停止要因のみ（レビュー件数では止めない・2026-06-11 運用方針変更）
  let bottleneck: { stage: string; text: string } | null = null
  if (metrics.backpressure.level === 'pause') {
    bottleneck = {
      stage: metrics.blockers.dangerApprovalCount > 0 ? '大きな作業' : '目標',
      text:
        metrics.blockers.dangerApprovalCount > 0
          ? `危険判断待ち ${metrics.blockers.dangerApprovalCount}件（工場停止中）`
          : `目標未設定 ${metrics.blockers.goalUnsetEpicCount}件（工場停止中）`,
    }
  } else if (inbox.decisionTotal > 0) {
    bottleneck = { stage: '大きな作業', text: `あなたの判断待ち ${inbox.decisionTotal}件` }
  }

  // セクション6: 現在の工場状態
  const automationRatePct = Math.round(metrics.closedLoopRate * 1000) / 10
  const currentMilestone = milestones.find((m) => m.state === 'current')
  const stateRows = [
    {
      label: '自動化率',
      value: `${automationRatePct}%`,
      desc: 'AIが人間の手を借りずに作業を終え、学習まで残せた割合です。高いほどあなたの時間が空きます。',
    },
    {
      label: 'レビュー待ち',
      value: `${metrics.notReviewedCount}件`,
      desc: '参考情報です。たまってもAI工場は止まりません（レビュー100件でも稼働します）。',
    },
    {
      label: '今日の判断',
      value: `${inbox.decisions.length}件（レビュー${inbox.reviewTotal}・候補${inbox.candidateTotal}・AI保留${inbox.aiHoldCount}）`,
      desc: '工場が止まる原因（危険判断・方針選択・人間作業）だけを最大3件表示します。レビューと候補は放置しても工場は止まりません。',
    },
    {
      label: '収益化状況',
      value: currentMilestone?.label ?? '準備中',
      desc: '収益化ロードマップ（下のセクション参照）の現在地です。最初のゴールは「はじめての収益 1円」です。',
    },
  ]

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide
        title="運用ガイド"
        guide="このページを5分読めば、Progressの使い方がすべて分かります。困ったらいつでもここに戻ってください。"
      />

      {/* 1. このアプリとは */}
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <h2 className={h2}>1. このアプリとは</h2>
        <p className={`mt-2 ${body}`}>
          AI工場を動かすための<strong>司令塔</strong>です。あなたは毎日<strong>5〜15分だけ判断</strong>します。
          残りはAIが進めます。
        </p>
        <FlowSteps steps={['AIが調査する', 'AIが実装する', 'AIがレビュー候補を作る', 'あなたが判断する（ここだけ）']} />
      </section>

      {/* 2. 今日の流れ */}
      <section className={card}>
        <h2 className={h2}>2. 今日の流れ</h2>
        <p className={`mt-1 ${body}`}>朝と夜、それぞれ数分で終わります。</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/15">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">🌅 朝</p>
            <FlowSteps steps={['司令塔を開く', 'Inboxを開く', '判断する', '終了']} />
          </div>
          <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/15">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">🌙 夜</p>
            <FlowSteps steps={['司令塔を開く', 'Inboxを開く', 'おすすめ次作業を確認', '終了']} />
          </div>
        </div>
      </section>

      {/* 3. AI工場の流れ */}
      <section className={card}>
        <h2 className={h2}>3. AI工場の流れ</h2>
        <p className={`mt-1 ${body}`}>すべての作業はこの順番でぐるぐる回ります。</p>
        <div className="mt-3 flex flex-col items-stretch gap-1">
          {factoryStages.map((stage, i) => {
            const hit = bottleneck?.stage === stage
            return (
              <div key={stage} className="flex flex-col items-center gap-1">
                {i > 0 && <span className="text-gray-300 dark:text-gray-600">↓</span>}
                <span
                  className={`w-full rounded-lg px-3 py-2 text-center text-xs font-medium ${
                    hit
                      ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-300 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200'
                  }`}
                >
                  {stage}
                  {hit && (
                    <span className="mt-1 block text-[11px] font-bold">
                      現在 {bottleneck!.text} ⚠ ここがボトルネックです
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        {!bottleneck && (
          <p className="mt-2 text-[11px] font-semibold text-green-600 dark:text-green-400">✅ 現在、詰まりはありません</p>
        )}
      </section>

      {/* 4. 今日やること */}
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <h2 className={h2}>4. 今日やること（いま現在）</h2>
        {todayLines.length === 0 ? (
          <p className={`mt-2 ${body}`}>🎉 いまあなたの判断待ちはありません。AI工場が自動で進めています。</p>
        ) : (
          <>
            <p className={`mt-1 ${body}`}>あなたの作業:</p>
            <ul className="mt-2 space-y-1">
              {todayLines.map((l) => (
                <li key={l.label} className="text-xs font-medium text-gray-800 dark:text-gray-100">
                  ・{l.label} {l.count}件
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              予想時間: <span className="text-base font-bold text-gray-900 dark:text-gray-100">約{estimatedMinutes}分</span>
              （Inboxで処理できます）
            </p>
          </>
        )}
      </section>

      {/* 5. 用語辞典 */}
      <section className={card}>
        <h2 className={h2}>5. 用語辞典</h2>
        <p className={`mt-1 ${body}`}>画面に出てくる言葉はすべて人間語に直しています。内部の英語が出てきたらこの表で読み替えてください。</p>
        <dl className="mt-3 space-y-2">
          {Object.entries(TERMS).map(([key, t]) => (
            <div key={key} className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/50">
              <dt className="text-xs font-bold text-gray-900 dark:text-gray-100">
                {t.ja}
                <span className="ml-2 font-normal text-gray-400">（{key}）</span>
              </dt>
              <dd className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{t.help}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 6. 現在の工場状態 */}
      <section className={card}>
        <h2 className={h2}>6. 現在の工場状態</h2>
        <p className={`mt-1 ${body}`}>
          AI工場はいま{config.factoryEnabled ? '稼働中' : '停止中'}です。
        </p>
        <div className="mt-3 space-y-2">
          {stateRows.map((row) => (
            <div key={row.label} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{row.label}</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{row.value}</p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{row.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. 収益化ロードマップ */}
      <section className={card}>
        <h2 className={h2}>7. 収益化ロードマップ</h2>
        <p className={`mt-1 ${body}`}>BirdLogを先頭に、この順番で「はじめての収益 1円」を目指します。</p>
        <div className="mt-3 flex flex-col items-stretch gap-1">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex flex-col items-center gap-1">
              {i > 0 && <span className="text-gray-300 dark:text-gray-600">↓</span>}
              <span
                className={`w-full rounded-lg px-3 py-2 text-center text-xs font-medium ${
                  m.state === 'done'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                    : m.state === 'current'
                      ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800'
                      : 'bg-gray-50 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500'
                }`}
              >
                {m.state === 'done' && '✅ '}
                {m.state === 'current' && '📍 いまここ → '}
                {m.label}
                <span className="mt-0.5 block text-[11px] font-normal opacity-80">{m.note}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 8. よくある質問 */}
      <section className={card}>
        <h2 className={h2}>8. よくある質問</h2>
        <dl className="mt-3 space-y-3">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-xs font-bold text-gray-900 dark:text-gray-100">Q. {f.q}</dt>
              <dd className={`mt-1 ${body}`}>A. {f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 最終更新（docs/operations/current-operating-model.md の frontmatter から動的表示） */}
      <footer className="rounded-xl bg-gray-50 px-4 py-3 text-center dark:bg-gray-800/50">
        <p className="text-[11px] text-gray-400">最終更新</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{meta.updated || '—'}</p>
        {meta.updateNote && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{meta.updateNote}</p>}
      </footer>
    </div>
  )
}
