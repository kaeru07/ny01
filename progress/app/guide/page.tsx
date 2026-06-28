export const dynamic = 'force-dynamic'

import Link from 'next/link'
import FaqAccordion from '@/components/guide/FaqAccordion'
import { FlowDiagram, LegendGrid, LoopDiagram, Roadmap, Slide, StatTiles } from '@/components/guide/SlideKit'
import PageGuide from '@/components/newux/PageGuide'
import AutoExecReport from '@/components/operations/AutoExecReport'
import ResearchSpecification from '@/components/operations/ResearchSpecification'
import SystemSpecification from '@/components/operations/SystemSpecification'
import { TERMS, buildInbox, buildRevenueMilestones } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'
import { getAutomationConfig } from '@/lib/operations-store'
import { getOperatingModelFreshness, readOperatingModelMeta } from '@/lib/operating-model'

// 📖 運用 = Progress が自分の使い方を説明するページ。
// 初見ユーザーが5分で「このアプリは何か / 今日何をやるか / AI工場がどう動くか」を
// 理解できることだけを目的にする。内部構造・専門用語は見せない。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const body = 'text-xs leading-relaxed text-gray-600 dark:text-gray-300'

const FAQ: Array<{ q: string; a: string }> = [
  { q: '毎日何をすればいい？', a: 'Inbox（今日の判断）だけ見れば大丈夫です。カードごとに「はい・いいえ・あとで」を選ぶだけで、3〜5分で終わります。空なら何もしなくてOKです。' },
  { q: 'Goalって何？', a: 'AI工場が向かう目標です。すべての大きな作業はどれかの目標に紐付き、目標のない作業はInboxで紐付けを求められます。' },
  { q: '自走化・最優先って何？', a: 'North Starの「AI工場OS自走化」（goal-ai-factory-os）を止めないためのアンカーです。Goal単体は実行されないため、配下の「AI工場オペレーションセンター」Epicに優先度「高」・Factory対象・検証可能な完了条件を持たせ、表示キューとFactory実行の両方で同じ最優先候補として扱います。ただし危険操作・承認待ち・ブロック中はこれまで通り自動実行しません。' },
  { q: '修正するで付けた指示は自動実行される？', a: 'はい。「修正する」で付けた修正指示は、次回の定時自動実行（11/14/16/23時）で最優先に処理されます（承認不要）。ただし安全のため、課金・本番・デプロイ・認証・「削除」などの危険語を含む指示は自動実行されず、要修正のまま残ります（人手で対応）。実行された修正は新しい作業履歴として残り、結果をレビューで確認できます。', },
  { q: '修正するを押した後は？', a: '「修正する」を押すとカード内に修正指示の入力欄（textarea）が開きます。「ここをこう直して」と具体的に書いて「修正依頼として保存」を押すと、その作業が要修正として残り、入力した指示が次回自動実行の作業指示になります（承認後にAIがその指示で再作業）。空欄では保存できません。同じ作業から重複候補は作らず、修正結果が戻ったらレビューで再確認できます。' },
  { q: '古いEpic候補は消える？', a: '消えません。30日以上動かなかった候補は期限切れとしてAI保留に移ります。必要なら候補詳細からsuggestedへ戻せます。' },
  { q: 'Goal進捗の%は何を見ている？', a: 'あなたが設定した「今/目標」の数字（例: 10/80なら13%）をそのまま進捗%にします。自動実行キュー・目標タブ・司令塔のどこでも同じ数字です。小タスクや作業の進み具合では計算しません（2026-06-18にこの方式へ統一。以前は作業件数で計算していたため、目標に小タスクが無いと常に0%になる不具合がありました）。「今/目標」を設定していない目標だけ、例外的にToDoの完了率を使います。', },
  { q: '古い作業履歴はどうなる？', a: '300件を超えたら、確認済みの古い作業履歴だけをバックアップ後に月別アーカイブへ移します。未確認・修正依頼・人間判断待ち・実行中は移しません。' },
  { q: 'レビュー用コピーは何に使う？', a: '司令塔の「レビュー用コピー」から、現在の判断・進捗・最近の作業・保留事項をMarkdownでコピーし、ChatGPT/Fableへ貼って外部レビューを受けます。結果をProgressへ戻す機能はまだないため、必要な指摘は人間がInboxへ手動起票します。' },
  { q: 'ログ画面のキュー外レビューコピーとの違いは？', a: '司令塔のレビュー用コピーはProgressに蓄積済みの現在状態を外へ出す出口です。ログ画面のキュー外レビューコピーは、Progressにまだ無い任意アウトプットを一時的にレビュー依頼文へ整える別用途です。' },
  { q: '次にAI工場が何をやるか、どこで分かる？', a: '司令塔トップの「次回自動実行予定」と「自動実行キュー（/queue）」で分かります。Epicベースの優先順位で1件＝次・3件＝候補を表示し、各カードに「なぜこれが次か」を出します。意図と違うときは、その場で最優先(pin)・保留・対象外・上下移動で並べ替えられます（手動操作は自動計算で上書きされません）。未整理メモ（Inbox）や対象外（factoryEligible=false）は自動実行候補に出ません。' },
  { q: '「最優先にしたのに候補外」と出たらどうすればいい？', a: 'その作業の下（司令塔トップと/queue）に「👉 こうすれば動きます」と解消手順＋ボタンが出ます。レビュー待ち/判断待ちなら「Inboxでレビュー/承認」、ブロック中なら「詳細を見る」でブロック解消、AI保留なら「保留解除」、対象外なら「対象に戻す」を押せば、次回の自動実行候補に入ります。最優先(pin)は安全のため、これらを解消するまでは自動実行しません。', },
  { q: '次が「実行可能なEpicがありません」になるのは？', a: '開いているEpicが全部「あなたの判断待ち」や「レビュー待ち」などで止まっている状態です。AI工場が勝手に変なものを進めないための正常動作です。判断待ち件数を見て、必要なものだけ処理すれば次が動き出します。低優先のレビュー（優先度「低」・危険なし）は工場を止めません。' },
  { q: 'レビュー待ちが増えても大丈夫？', a: '大丈夫です。レビューが100件たまっても工場は止まりません（2026-06-11の方針変更）。工場が止まるのは「危険判断待ち」「目標未設定」「人間作業待ち」だけです。レビューは時間があるときに「未確認レビューをAIで一括整理」で片付けられます。' },
  { q: 'レビュータブの見方は？', a: 'レビュータブは隠さず全件表示です（「ほか◯件」で隠しません）。上部に未確認/要修正/あとで/レビュー済みの件数が出て、フィルタで切り替えられます。各カードに「完了: 2026/06/13 13:02」を表示し、最新完了が上に並びます。件数が多いときは50件ずつのページ送り（全◯件中◯〜◯件）で全件を辿れます。' },
  { q: '次回予定からレビューへ飛ぶときは？', a: '司令塔トップの「Inboxでレビューする」は /decide?tab=review&goalId=...&focusRunId=... を開きます。今日の判断0件のタブへ飛ばず、該当Goalのレビュー一覧に絞り込み、対象カードを自動でハイライトします。カードが要修正/あとで/レビュー済み側にある場合は、そのフィルタへ自動で切り替えます。該当タブが0件でも同じGoalの他タブに件数があれば案内ボタンを出します。未紐づけは「未紐づけ」として絞り込みできます。' },
  { q: '問題なし／あとで／修正するを押すとどうなる？', a: '「問題なし」=レビュー済みになり待ち一覧から消えます（消えても「レビュー済み」タブに残り、物理削除しません）。「あとで」=後回しとして一覧に残り「あとで」バッジが付きます。「修正する」=修正指示の入力欄が開き、書いて保存すると要修正として残り、その指示が次回自動実行の作業指示になります（空欄保存は不可）。「未確認レビューをAIで一括整理」は未確認の全件が対象で、危険なもの・判断が必要なものは必ず一覧に残し、最終判断は人間が行えます。' },
  { q: 'AI保留って何？', a: '人間が判断する必要のないもの（AIレビュー・候補整理・定期実行・重複・内容不足）をAIが預かっている状態です。件数だけ表示され、あなたの判断は不要です。' },
  { q: '「ループの健全性」カードは何を見ている？', a: '自動実行（/automation）の上部にあるカードで、「実行 → レビュー → 学び（Knowledge） → 次のEpic候補」の流れが切れていないかを測定します。🟢なら全段つながり済み（こぼれ0件）、🟡ならこぼれ件数を表示します。各段の件数（レビュー済みRun・Knowledge・次Epic候補つき・修正依頼Run・修正候補）も並びます。こぼれがある時だけ「こぼれを自己修復」ボタンが押せ、未生成のKnowledge・次Epic候補・修正候補を冪等に補完します（2026-06-21追加）。', },
  { q: '下タブ（メニュー）の構成は？', a: 'iPhoneの下タブは横スクロールで、先頭が主要5つ（ホーム / ToDo / Project / 目標 / 自動実行）、続けて作業予約・Revenue・運用・実行履歴・収益化・承認…と、リンクで飛べる主要画面が全部並びます。右へスワイプすれば全画面に直接行けます（「下タブにない画面」はありません）。', },
  { q: '自動実行キューはどこ？', a: 'iPhoneの下タブ「自動実行」（/queue）です。AI工場が次に何をやるか、なぜそれが次か、判断待ち・実行可能・ブロックの件数が見えます。以前は下タブに無くて辿りにくかったため、2026-06-14に主要タブへ昇格しました。', },
  { q: 'フィルターは何に使う？', a: '自動実行キューやInboxの上部にあるチップと「絞り込み」で、Goal・Project・状態・pin済み・候補外・検索語などを表示だけ絞れます。選択はURLに同期されるので、再読み込みや共有リンクでも同じ条件を復元できます。これは表示専用で、AI工場の候補判定・スコア・実行順そのものは変えません。' },
  { q: '目標・自動実行・ゴール×todo消化はどう使い分ける？', a: '「目標」（/goal-planner）はGoalとtodoの作成・編集・並び替えをする管理画面です。「自動実行」（/queue）はAIが次に何をやるか、実行順やpin/保留/対象外を操作する実行画面です。ゴール配下todoの完了・未完了・止まっている項目と達成率は、閲覧専用の「ゴール×todo消化状況」（/goal-dashboard）でまとめて確認します。', },
  { q: '自分でゴールを追加するには？', a: '目標タブ（/goal-planner）の「ゴールを直接追加」にタイトルを入れて追加します（案件・説明は任意）。人間が直接追加したゴールは、その入力自体を実行許可とみなし、承認不要ですぐactive・自動実行対象になります。AIや調査が提案したゴールだけが「ゴール承認」タブに入り、承認後に自動実行対象になります。たくさんまとめて入れたいときは「JSONで一括追加」を使います。', },
  { q: 'AIが新しいゴールを提案してくるのは？', a: '自動実行の最初に、AI工場が「日々の調査結果」（ニュースアプリのAIツール調査など）を見て、効果がありそうな・やった方が良いことを「次に目指すべきゴール」として1〜3件提案します（例: 評価の高い新ツールを「○○を試す」「○○を調査する」、Fableを試す など）。提案ゴールは「今日の判断」（Inbox）の「ゴール承認」タブに出ます。「承認する」を押すと次回以降の自動実行の対象になり、達成まで自動で進みます。「やめる」で候補から外れます。承認するまで勝手に実行されることはありません。ゴールは優先順の高いものから処理され、達成して承認待ちが減ると、次の自動実行でまた調査から新しい候補が補充されます。承認待ちが3件たまると、それ以上は提案しません（先に承認/却下してください）。', },
  { q: '自動実行する作業が無くなったらどうなる？', a: '空のまま止まらず「ゴール生成モード」に入ります。自動実行できる作業が無いアイドル時、AI工場はprogressアプリ優先で「改善事項（失敗したまま直っていない作業の解消）」と「試した方がいいこと（過去の作業が挙げた未消化の次アクション）」をゴール候補として提案し、それでも無ければ定番の改善テーマを補充します。これらは「ゴール承認」タブに出て、承認すれば次回の自動実行の対象になります。調査が外（ニュース）から、ゴール生成モードが中（progress自身の改善）から候補を足すことで、承認対象が空のままにならず、次の自動実行が空になりません（2026-06-20追加）。承認待ちが3件たまると、それ以上は提案しません。', },
  { q: '自動実行の状況をまとめて見たい', a: 'この運用ページ上部の「自動実行レポート」タブを開いてください。AI工場の状態（稼働中/停止）・次回の自動実行予定（11/14/16/23時）・これまでの自動実行サマリー（完了/一部完了/失敗の件数）・直近の自動実行の一覧・最近の自動化の動き（ゴール提案や次の一歩の自動作成など）・承認待ちのゴール候補の件数が1画面で分かります。', },
  { q: '自動で何が動いたか確認したい', a: '「今日の判断」（Inbox）の下に「🤖 自動実行の履歴」が出ます。最近AI工場が自動で動かした作業（結果・日時）が直近10件まで一覧で見られます。詳しくは「実行履歴」（/logs）でも確認できます。', },
  { q: 'ToDoも大きな作業も無い目標は自動で進む？', a: 'はい。ToDoも大きな作業（Epic）も無い未達成の目標は、自動実行キューに「○○（達成まで自動で進める）」として並びます。AI工場がこれを拾うと、その目標を進めるための次の1ステップ（次の一歩）を大きな作業として自動で作り、実装→検証まで進めます。完了してもまだ目標が未達成なら、次の一歩がまた作られ、達成するまで繰り返します。安全のため、承認が必要な目標・手動方針の目標・危険操作を含む目標は対象外で、その場合は「Inboxで承認」「目標詳細」などの解消手順を表示します。', },
  { q: 'ToDoはどうやって目標（Goal）に紐づける？', a: '自動実行は目標を進めるために動くので、ToDoは目標に紐づけて追加します。「ToDo管理」や「目標」タブの「ToDoをGoalに紐づけて追加」フォームから、対象Goalを選んで追加できます（Goal必須）。JSON取込でも project / Goal進捗を保持します。目標やProjectを補完できないToDoは消さずに「未紐付け」と表示され、自動実行候補に入れる前に紐付けを促します。', },
  { q: '作業予約（Prompt Queue）って何？', a: 'やってほしい作業を「タスク名・プロンプト・Project・Goal進捗」の4つだけ書いて貯めておく場所です（Legacy内「作業予約」/prompt-queue）。実行するAIや優先度は選びません—未完了のものが「次回やる候補」に出て、Project/Goal進捗の状態から自動で順番が決まります。ChatGPT/ClaudeのJSONをまとめて貼り付けて一括登録もできます（旧ToDo JSONのgoalは自動でGoal進捗に寄せます）。後回し・キャンセル・完了扱いができ、消しても物理削除はしません。' },
  { q: '自分がProgressをどう使っているか分かる？', a: '「使用状況」（/usage・下タブ「使用状況」）で分かります。直近7日で「どの画面をよく開いたか（画面別アクセス回数）」「どのボタンをよく押したか（よく使うボタン操作TOP）」「最後にいつ使ったか（画面別最終使用日時）」「どの画面を1度も開いていないか（放置している画面）」を自動で集計します。画面を開いたりボタンを押したりするだけで記録され、特別な操作は要りません。これは表示専用の集計で、AI工場の判定や自動実行には一切影響しません。放置している画面は「使っていない＝不要かもしれない画面」の見直しに使えます。', },
  { q: '目的の画面に行けないときは？', a: '画面右上の ☰（メニュー）を押してください。全ページがカテゴリ別（メイン/よく使う/AI工場/判断・記録/計画・候補/全体管理・旧画面）に並んでいて、どの画面からでも1タップで目的の画面へ行けます。スマホ・パソコンどちらでも同じメニューが使えます。下タブ（スマホ）や上タブ（パソコン）にもよく使う画面は出ていますが、「下タブに見当たらない画面」も☰には必ずあります。', },
  { q: 'Legacyタブは何？', a: '全画面のカテゴリ別ディレクトリ（☰メニューと同じ一覧）と、旧画面で使う専門用語の対応表が見られる場所です。普段は☰メニューで足ります。' },
  { q: 'AI工場を止めたいときは？', a: 'Legacy内の「自動化」画面からオフにできます。オフの間、AIは新しい作業を始めません。' },
]

function GuideTabBar({ active }: { active: 'guide' | 'report' | 'system' | 'research' }) {
  const base = 'flex-1 min-w-[80px] whitespace-nowrap text-center rounded-lg px-2 py-2 text-[11px] font-bold transition-colors'
  const on = 'bg-blue-600 text-white'
  const off = 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href="/guide" className={`${base} ${active === 'guide' ? on : off}`}>使い方ガイド</Link>
      <Link href="/guide?tab=report" className={`${base} ${active === 'report' ? on : off}`}>自動実行レポート</Link>
      <Link href="/guide?tab=system" className={`${base} ${active === 'system' ? on : off}`}>システム仕様</Link>
      <Link href="/guide?tab=research" className={`${base} ${active === 'research' ? on : off}`}>調査仕様</Link>
    </div>
  )
}

export default async function OperationsGuidePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const rawTab = typeof searchParams?.tab === 'string' ? searchParams.tab : ''
  const tab = rawTab === 'report' ? 'report' : rawTab === 'system' ? 'system' : rawTab === 'research' ? 'research' : 'guide'
  if (tab === 'report') {
    return (
      <div className="space-y-5 px-4 pb-6 pt-6">
        <PageGuide
          title="運用"
          guide="AI工場が自動で何をしたか・次に何をするかの報告です。承認待ちのゴール候補や直近の自動実行をここで確認できます。"
        />
        <GuideTabBar active="report" />
        <section className={`${card} border-blue-200 dark:border-blue-900/50`}>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            自動実行レポートは独立ページへ昇格しました。このタブでも引き続き確認できますが、検索・実行者・対象アプリ・レビュー状態まで使う場合は専用ページが便利です。
          </p>
          <Link href="/report" className="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
            専用レポートページを開く
          </Link>
        </section>
        <AutoExecReport
          range={typeof searchParams?.range === 'string' ? searchParams.range : ''}
          status={typeof searchParams?.status === 'string' ? searchParams.status : ''}
        />
      </div>
    )
  }
  if (tab === 'system') {
    const freshness = await getOperatingModelFreshness()
    const freshnessWarnings = [
      freshness.invalidUpdated
        ? 'current-operating-model.md の updated が未設定、または YYYY-MM-DD 形式ではありません。'
        : '',
      !freshness.invalidUpdated && freshness.days >= 14
        ? `運用ドキュメントが ${freshness.days} 日更新されていません。`
        : '',
      freshness.implementationChangedAfterDoc
        ? `監視対象の実装が updated（${freshness.updated || '未設定'}）より新しい可能性があります: ${freshness.latestImplementationPath}（${freshness.latestImplementationDate}）`
        : '',
    ].filter(Boolean)
    return (
      <div className="space-y-5 px-4 pb-6 pt-6">
        <PageGuide
          title="運用"
          guide="自動実行で何が起きるか（調査→目標→実行→検証→報告）を先頭にまとめた内部仕様です。詳しい参照（安全条件・データ・API・画面）は各見出しをタップで開けます。"
        />
        <GuideTabBar active="system" />
        {freshness.stale && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-bold">⚠ current-operating-model.md の鮮度を点検してください。</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {freshnessWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <SystemSpecification />
      </div>
    )
  }
  if (tab === 'research') {
    return (
      <div className="space-y-5 px-4 pb-6 pt-6">
        <PageGuide
          title="運用"
          guide="毎朝の調査→試す候補の自動提案→承認→自動実行の流れと仕様"
        />
        <GuideTabBar active="research" />
        <ResearchSpecification />
      </div>
    )
  }

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
    <div className="space-y-4 px-4 pb-6 pt-6">
      <PageGuide
        title="運用ガイド"
        guide="このページを5分読めば、Progressの使い方がすべて分かります。困ったらいつでもここに戻ってください。"
      />

      <GuideTabBar active="guide" />

      <Slide n={1} title="このアプリとは" accent="blue" lead="あなたは毎日5〜15分だけ判断">
        <p className={body}>
          AI工場を動かすための<strong>司令塔</strong>です。あなたは毎日<strong>5〜15分だけ判断</strong>します。
          残りはAIが進めます。
        </p>
        <div className="mt-4">
          <FlowDiagram
            steps={[
              { label: 'AIが調査する', icon: '🔎' },
              { label: 'AIが実装する', icon: '🛠️' },
              { label: 'AIがレビュー候補を作る', icon: '📝' },
              { label: 'あなたが判断する（ここだけ）', icon: '🧑‍⚖️', highlight: true },
              { label: '必要ならレビュー用コピーで外部レビュー', icon: '📋' },
            ]}
          />
        </div>
      </Slide>

      <Slide n={2} title="今日の流れ" accent="amber" lead="朝と夜、それぞれ数分で終わります。">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-amber-200 bg-white p-2 dark:border-amber-900/60 dark:bg-gray-900">
            <p className="mb-2 text-sm font-black text-amber-700 dark:text-amber-300">🌅 朝</p>
            <FlowDiagram steps={['司令塔を開く', 'Inboxを開く', '判断する', '必要ならレビュー用コピー', '終了'].map((label) => ({ label }))} />
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white p-2 dark:border-indigo-900/60 dark:bg-gray-900">
            <p className="mb-2 text-sm font-black text-indigo-700 dark:text-indigo-300">🌙 夜</p>
            <FlowDiagram steps={['司令塔を開く', 'Inboxを開く', 'おすすめ次作業を確認', '必要ならレビュー用コピー', '終了'].map((label) => ({ label }))} />
          </div>
        </div>
      </Slide>

      <Slide n={3} title="AI工場の流れ" accent="gray" lead="すべての作業はこの順番でぐるぐる回ります。">
        <LoopDiagram
          steps={factoryStages.map((stage) => {
            const hit = bottleneck?.stage === stage
            return {
              label: stage,
              icon: stage === '目標' ? '🎯' : stage === 'レビュー' ? '📝' : stage === '学習' ? '🧠' : '⚙️',
              highlight: hit,
              sub: hit ? `現在 ${bottleneck!.text} ⚠ ここがボトルネックです` : undefined,
            }
          })}
        />
        {!bottleneck && (
          <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-black text-green-700 dark:bg-green-950/20 dark:text-green-300">
            ✅ 現在、詰まりはありません
          </p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          レビューで「修正する」を選ぶと、修正依頼は次の作業候補へ戻ります。AI工場の「今」は実行中の作業があれば表示し、30分以上残った古い実行中表示は待機中として扱います。
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          画面表示では同じ読み取り結果を画面内だけで使い回します。更新APIは別経路なので、判断ボタンを押した直後の読み戻しは従来どおり最新データを読みます。
        </p>
      </Slide>

      <Slide n={4} title="今日やること（いま現在）" accent="blue">
        {todayLines.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-5 text-center text-base font-black text-green-700 dark:bg-gray-900 dark:text-green-300">
            🎉 判断待ちなし
          </p>
        ) : (
          <>
            <p className={body}>あなたの作業:</p>
            <div className="mt-3 space-y-2">
              {todayLines.map((l) => (
                <div key={l.label} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-sm font-black leading-snug text-gray-900 dark:text-gray-100">⚠️ {l.label}</p>
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-black text-white">{l.count}件</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-blue-200 bg-white p-4 text-center dark:border-blue-900/60 dark:bg-gray-900">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">予想時間（Inboxで処理できます）</p>
              <p className="mt-1 text-4xl font-black text-blue-700 dark:text-blue-300">約{estimatedMinutes}分</p>
            </div>
          </>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          司令塔の「レビュー用コピー」は、Progress内の現在状態を読み取り専用でMarkdown化します。外部レビューの結果をProgressへ戻す経路はまだないため、採用する指摘は人間がInboxへ手動で起票します。
        </p>
      </Slide>

      <Slide n={5} title="用語辞典" accent="gray" lead="画面に出てくる言葉はすべて人間語に直しています。内部の英語が出てきたらこの表で読み替えてください。">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TERMS).map(([key, t]) => (
            <div key={key} className="rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-black leading-snug text-gray-900 dark:text-gray-100">
                {t.ja}
                <span className="ml-1 text-[10px] font-bold text-gray-400">（{key}）</span>
              </p>
              <p className="mt-1 line-clamp-3 text-[10px] font-medium leading-snug text-gray-500 dark:text-gray-400">{t.help}</p>
            </div>
          ))}
        </div>
      </Slide>

      <Slide n={6} title="現在の工場状態" accent={config.factoryEnabled ? 'green' : 'rose'}>
        <div className={`mb-3 rounded-full px-4 py-2 text-center text-sm font-black ${
          config.factoryEnabled
            ? 'bg-green-600 text-white'
            : 'bg-rose-600 text-white'
        }`}>
          AI工場はいま{config.factoryEnabled ? '稼働中' : '停止中'}です。
        </div>
        <StatTiles tiles={stateRows} />
      </Slide>

      <Slide n={7} title="収益化ロードマップ" accent="green" lead="収益設定の対象アプリを先頭に、この順番で「はじめての収益 1円」を目指します。現在の初期対象はBirdLogです。">
        <Roadmap items={milestones} />
      </Slide>

      <Slide n={8} title="自動実行キュー" accent="indigo" lead="司令塔トップの「次回自動実行予定」と /queue は、同じ派生ロジックを見ています。新しいキュー正本は作らず、既存の大きな作業・目標・作業履歴・承認から毎回計算します。">
        <LegendGrid
          items={[
            { dot: 'bg-green-500', term: '実行可能', desc: 'AIが自動実行できる候補です。' },
            { dot: 'bg-amber-500', term: '判断待ち', desc: '人間の承認や方針判断が必要です。' },
            { dot: 'bg-blue-500', term: 'レビュー待ち', desc: '結果確認待ちです。低優先レビューでは工場全体を止めません。' },
            { dot: 'bg-gray-400', term: 'AI保留', desc: '保留中です。解除後、条件を満たせば候補に戻ります。' },
            { dot: 'bg-red-500', term: 'Block', desc: 'blockerや失敗で詰まっています。' },
            { dot: 'bg-gray-500', term: '手動/対象外', desc: '自動実行しません。' },
          ]}
        />
        <details className="mt-3 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <summary className="min-h-11 cursor-pointer list-none px-3 py-2 text-sm font-black text-gray-900 marker:hidden dark:text-gray-100">
            <span className="flex items-center justify-between gap-2">
              操作
              <span className="text-blue-600 dark:text-blue-300">＋</span>
            </span>
          </summary>
          <ul className="border-t border-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
            <li>・自動実行を最優先: 実行可能なら次回候補の最上位へ固定します。</li>
            <li>・復帰時に最優先: いま候補外の作業を、条件が解けた時に上位へ戻します。</li>
            <li>・↑ / ↓: 実行可能キュー内の相対順を保存します。</li>
            <li>・保留 / 保留解除: AI保留へ移す、または戻します。</li>
            <li>・対象外: 自動実行対象から外します。</li>
            <li>・詳細: 大きな作業の詳細へ移動します。</li>
          </ul>
        </details>
        <details className="mt-2 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <summary className="min-h-11 cursor-pointer list-none px-3 py-2 text-sm font-black text-gray-900 marker:hidden dark:text-gray-100">
            <span className="flex items-center justify-between gap-2">
              並び順（Goal順）
              <span className="text-blue-600 dark:text-blue-300">＋</span>
            </span>
          </summary>
          <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-800">
            <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              自動実行キューは <span className="font-semibold">Goalごとにまとまって</span>表示され、<span className="font-semibold">Goalの順番がキューの順番</span>になります。Goalの並びは「最優先(pin) → boost → 優先度(高→中→低)」で決まり、目標タブでGoalを並べ替えると、次にAIが自動実行する作業も変わります。Goalに紐づかない作業は末尾の「Goal未設定」にまとまります。
            </p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
              <li>1. 明示pin（手動で最優先にした作業・絶対上位）</li>
              <li>2. 自走化アンカー / 要修正（安全のため上に据え置き）</li>
              <li>3. Goal順（pin &gt; boost &gt; 優先度）</li>
              <li>4. Goal内（手動の上下移動 → スコア → 優先度）</li>
            </ul>
          </div>
        </details>
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          重要: 最優先指定は安全条件を上書きしません。人間判断待ち・レビュー待ち・ブロック中・手動/対象外の作業は自動実行されず、司令塔と /queue に「最優先指定中だが候補外」と理由を表示します。
        </p>
        <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold leading-relaxed text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          Inboxでレビューするボタンは、/decide のレビュータブへ直接移動します。Goal単位で絞り込み、可能なら該当作業履歴をハイライトするため、レビュー件数があるのに今日の判断0件で止まることはありません。
        </p>
      </Slide>

      <Slide n={9} title="動作確認Todo" accent="rose" lead="AIの作業やEpic完了後に「人間がこの画面をこう確認してほしい」という項目を一覧管理する場所です（上部メニュー「動作確認」／ /verify-todos）。AIが作業を終えるたびに、アプリ名・Epic名・確認URL・確認手順・期待結果を1件ずつ登録します。">
        <LegendGrid
          items={[
            { dot: 'bg-gray-400', term: '未確認', desc: 'まだ人間が確認していない項目です。' },
            { dot: 'bg-green-500', term: '確認済', desc: '確認URLを開き、手順どおりに操作して期待結果と一致したものです。' },
            { dot: 'bg-red-500', term: 'NG', desc: '期待結果とずれていた項目です。修正が必要です。' },
            { dot: 'bg-amber-500', term: '保留', desc: '後回しにする項目です。' },
          ]}
        />
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          アプリ・Epic・状態で絞り込めます。確認URL（iPhoneから押せる公開URL推奨）を押すと対象画面が開きます。
        </p>
      </Slide>

      <Slide n={10} title="よくある質問" accent="gray">
        <FaqAccordion items={FAQ} />
      </Slide>

      {/* 最終更新（docs/operations/current-operating-model.md の frontmatter から動的表示） */}
      <footer className="rounded-xl bg-gray-50 px-4 py-3 text-center dark:bg-gray-800/50">
        <p className="text-[11px] text-gray-400">最終更新</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{meta.updated || '—'}</p>
        {meta.updateNote && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{meta.updateNote}</p>}
      </footer>
    </div>
  )
}
