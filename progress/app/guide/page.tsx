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
  { q: '修正するを押した後は？', a: '「修正する」を押すとカード内に修正指示の入力欄（textarea）が開きます。「ここをこう直して」と具体的に書いて「修正依頼として保存」を押すと、その作業が要修正として残り、入力した指示が次回自動実行の作業指示になります（承認後にAIがその指示で再作業）。空欄では保存できません。同じ作業から重複候補は作らず、修正結果が戻ったらレビューで再確認できます。' },
  { q: '古いEpic候補は消える？', a: '消えません。30日以上動かなかった候補は期限切れとしてAI保留に移ります。必要なら候補詳細からsuggestedへ戻せます。' },
  { q: 'Goal進捗の%は何を見ている？', a: 'GoalにTodoがあればTodo完了率、なければ紐付く大きな作業の平均、それもなければGoalの数値指標を使います。司令塔のGoalカードに根拠を1行表示します。' },
  { q: '古い作業履歴はどうなる？', a: '300件を超えたら、確認済みの古い作業履歴だけをバックアップ後に月別アーカイブへ移します。未確認・修正依頼・人間判断待ち・実行中は移しません。' },
  { q: 'レビュー用コピーは何に使う？', a: '司令塔の「レビュー用コピー」から、現在の判断・進捗・最近の作業・保留事項をMarkdownでコピーし、ChatGPT/Fableへ貼って外部レビューを受けます。結果をProgressへ戻す機能はまだないため、必要な指摘は人間がInboxへ手動起票します。' },
  { q: 'ログ画面のキュー外レビューコピーとの違いは？', a: '司令塔のレビュー用コピーはProgressに蓄積済みの現在状態を外へ出す出口です。ログ画面のキュー外レビューコピーは、Progressにまだ無い任意アウトプットを一時的にレビュー依頼文へ整える別用途です。' },
  { q: '次にAI工場が何をやるか、どこで分かる？', a: '司令塔トップの「次回自動実行予定」と「自動実行キュー（/queue）」で分かります。Epicベースの優先順位で1件＝次・3件＝候補を表示し、各カードに「なぜこれが次か」を出します。意図と違うときは、その場で最優先(pin)・保留・対象外・上下移動で並べ替えられます（手動操作は自動計算で上書きされません）。未整理メモ（Inbox）や対象外（factoryEligible=false）は自動実行候補に出ません。' },
  { q: '「最優先にしたのに候補外」と出たらどうすればいい？', a: 'その作業の下（司令塔トップと/queue）に「👉 こうすれば動きます」と解消手順＋ボタンが出ます。レビュー待ち/判断待ちなら「Inboxでレビュー/承認」、ブロック中なら「詳細を見る」でブロック解消、AI保留なら「保留解除」、対象外なら「対象に戻す」を押せば、次回の自動実行候補に入ります。最優先(pin)は安全のため、これらを解消するまでは自動実行しません。', },
  { q: '次が「実行可能なEpicがありません」になるのは？', a: '開いているEpicが全部「あなたの判断待ち」や「レビュー待ち」などで止まっている状態です。AI工場が勝手に変なものを進めないための正常動作です。判断待ち件数を見て、必要なものだけ処理すれば次が動き出します。低優先のレビュー（P2・危険なし）は工場を止めません。' },
  { q: 'レビュー待ちが増えても大丈夫？', a: '大丈夫です。レビューが100件たまっても工場は止まりません（2026-06-11の方針変更）。工場が止まるのは「危険判断待ち」「目標未設定」「人間作業待ち」だけです。レビューは時間があるときに「未確認レビューをAIで一括整理」で片付けられます。' },
  { q: 'レビュータブの見方は？', a: 'レビュータブは隠さず全件表示です（「ほか◯件」で隠しません）。上部に未確認/要修正/あとで/レビュー済みの件数が出て、フィルタで切り替えられます。各カードに「完了: 2026/06/13 13:02」を表示し、最新完了が上に並びます。件数が多いときは50件ずつのページ送り（全◯件中◯〜◯件）で全件を辿れます。' },
  { q: '次回予定からレビューへ飛ぶときは？', a: '司令塔トップの「Inboxでレビューする」は /decide?tab=review&goalId=...&focusRunId=... を開きます。今日の判断0件のタブへ飛ばず、該当Goalのレビュー一覧に絞り込み、対象カードを自動でハイライトします。カードが要修正/あとで/レビュー済み側にある場合は、そのフィルタへ自動で切り替えます。該当タブが0件でも同じGoalの他タブに件数があれば案内ボタンを出します。未紐づけは「未紐づけ」として絞り込みできます。' },
  { q: '問題なし／あとで／修正するを押すとどうなる？', a: '「問題なし」=レビュー済みになり待ち一覧から消えます（消えても「レビュー済み」タブに残り、物理削除しません）。「あとで」=後回しとして一覧に残り「あとで」バッジが付きます。「修正する」=修正指示の入力欄が開き、書いて保存すると要修正として残り、その指示が次回自動実行の作業指示になります（空欄保存は不可）。「未確認レビューをAIで一括整理」は未確認の全件が対象で、危険なもの・判断が必要なものは必ず一覧に残し、最終判断は人間が行えます。' },
  { q: 'AI保留って何？', a: '人間が判断する必要のないもの（AIレビュー・候補整理・定期実行・重複・内容不足）をAIが預かっている状態です。件数だけ表示され、あなたの判断は不要です。' },
  { q: '作業予約（Prompt Queue）って何？', a: 'やってほしい作業を「タスク名・プロンプト・Project・Goal進捗」の4つだけ書いて貯めておく場所です（Legacy内「作業予約」/prompt-queue）。実行するAIや優先度は選びません—未完了のものが「次回やる候補」に出て、Project/Goal進捗の状態から自動で順番が決まります。ChatGPT/ClaudeのJSONをまとめて貼り付けて一括登録もできます（旧ToDo JSONのgoalは自動でGoal進捗に寄せます）。後回し・キャンセル・完了扱いができ、消しても物理削除はしません。' },
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
    {
      label: 'データ整合',
      value: '異常時のみ表示',
      desc: '存在しない目標・大きな作業への参照、14日超の修正依頼、30分超の実行中表示を点検し、異常があるときだけ司令塔に警告します。',
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
        <FlowSteps steps={['AIが調査する', 'AIが実装する', 'AIがレビュー候補を作る', 'あなたが判断する（ここだけ）', '必要ならレビュー用コピーで外部レビュー']} />
      </section>

      {/* 2. 今日の流れ */}
      <section className={card}>
        <h2 className={h2}>2. 今日の流れ</h2>
        <p className={`mt-1 ${body}`}>朝と夜、それぞれ数分で終わります。</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/15">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">🌅 朝</p>
            <FlowSteps steps={['司令塔を開く', 'Inboxを開く', '判断する', '必要ならレビュー用コピー', '終了']} />
          </div>
          <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/15">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">🌙 夜</p>
            <FlowSteps steps={['司令塔を開く', 'Inboxを開く', 'おすすめ次作業を確認', '必要ならレビュー用コピー', '終了']} />
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
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          レビューで「修正する」を選ぶと、修正依頼は次の作業候補へ戻ります。AI工場の「今」は実行中の作業があれば表示し、30分以上残った古い実行中表示は待機中として扱います。
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
          画面表示では同じ読み取り結果を画面内だけで使い回します。更新APIは別経路なので、判断ボタンを押した直後の読み戻しは従来どおり最新データを読みます。
        </p>
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
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          司令塔の「レビュー用コピー」は、Progress内の現在状態を読み取り専用でMarkdown化します。外部レビューの結果をProgressへ戻す経路はまだないため、採用する指摘は人間がInboxへ手動で起票します。
        </p>
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
        <p className={`mt-1 ${body}`}>収益設定の対象アプリを先頭に、この順番で「はじめての収益 1円」を目指します。現在の初期対象はBirdLogです。</p>
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

      {/* 8. 自動実行キュー */}
      <section className={card}>
        <h2 className={h2}>8. 自動実行キュー</h2>
        <p className={`mt-1 ${body}`}>
          司令塔トップの「次回自動実行予定」と /queue は、同じ派生ロジックを見ています。新しいキュー正本は作らず、既存の大きな作業・目標・作業履歴・承認から毎回計算します。
        </p>
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">ステータス</p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              <li>・実行可能: AIが自動実行できる候補です。</li>
              <li>・判断待ち: 人間の承認や方針判断が必要です。</li>
              <li>・レビュー待ち: 結果確認待ちです。低優先レビューでは工場全体を止めません。</li>
              <li>・AI保留: 保留中です。解除後、条件を満たせば候補に戻ります。</li>
              <li>・Block: blockerや失敗で詰まっています。</li>
              <li>・手動/対象外: 自動実行しません。</li>
            </ul>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">操作</p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              <li>・自動実行を最優先: 実行可能なら次回候補の最上位へ固定します。</li>
              <li>・復帰時に最優先: いま候補外の作業を、条件が解けた時に上位へ戻します。</li>
              <li>・↑ / ↓: 実行可能キュー内の相対順を保存します。</li>
              <li>・保留 / 保留解除: AI保留へ移す、または戻します。</li>
              <li>・対象外: 自動実行対象から外します。</li>
              <li>・詳細: 大きな作業の詳細へ移動します。</li>
            </ul>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            重要: 最優先指定は安全条件を上書きしません。人間判断待ち・レビュー待ち・ブロック中・手動/対象外の作業は自動実行されず、司令塔と /queue に「最優先指定中だが候補外」と理由を表示します。
          </p>
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold leading-relaxed text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            Inboxでレビューするボタンは、/decide のレビュータブへ直接移動します。Goal単位で絞り込み、可能なら該当作業履歴をハイライトするため、レビュー件数があるのに今日の判断0件で止まることはありません。
          </p>
        </div>
      </section>

      {/* 9. 動作確認Todo */}
      <section className={card}>
        <h2 className={h2}>9. 動作確認Todo</h2>
        <p className={`mt-1 ${body}`}>
          AIの作業やEpic完了後に「人間がこの画面をこう確認してほしい」という項目を一覧管理する場所です（上部メニュー「動作確認」／ /verify-todos）。AIが作業を終えるたびに、アプリ名・Epic名・確認URL・確認手順・期待結果を1件ずつ登録します。
        </p>
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">状態</p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              <li>・未確認: まだ人間が確認していない項目です。</li>
              <li>・確認済: 確認URLを開き、手順どおりに操作して期待結果と一致したものです。</li>
              <li>・NG: 期待結果とずれていた項目です。修正が必要です。</li>
              <li>・保留: 後回しにする項目です。</li>
            </ul>
          </div>
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
            アプリ・Epic・状態で絞り込めます。確認URL（iPhoneから押せる公開URL推奨）を押すと対象画面が開きます。
          </p>
        </div>
      </section>

      {/* 10. よくある質問 */}
      <section className={card}>
        <h2 className={h2}>10. よくある質問</h2>
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
