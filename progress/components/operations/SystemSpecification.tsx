import type { ReactNode } from 'react'
import Link from 'next/link'
import { computeFactoryStatus } from '@/lib/factory-status'
import { getAutomationConfig } from '@/lib/operations-store'
import { NAV_GROUPS } from '@/lib/nav-menu'

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const sub = 'rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50'
const h2 = 'text-base font-bold text-gray-900 dark:text-gray-100'
const h3 = 'text-xs font-bold text-gray-900 dark:text-gray-100'
const text = 'text-[11px] leading-relaxed text-gray-600 dark:text-gray-300'

// 自動実行で実際に行われる処理（定時 11/14/16/23時 = runScheduledFactory → runFactory）。
// この順番がこのページの主役。各ステップは「何をするか」を人間語で書き、内部名は括弧で残す。
const AUTO_STEPS: Array<{ title: string; detail: string; tag?: 'research' | 'idle' | 'safety' | 'run' }> = [
  { title: '二重起動を防ぐ印を付ける', detail: '同じ時刻の処理が遅延などで重なって二重実行されないよう、一時的な「実行中」マークを付けます（lock取得）。Factory OFFのときは何もしません。', tag: 'safety' },
  { title: '危険判断待ちがあるか確認', detail: '本番・課金・認証・外部公開などの「あなたの許可待ち」があれば、今回の自動実行はスキップします（勝手に危険操作をしないため）。', tag: 'safety' },
  { title: '① 修正依頼を処理（Review Fix）', detail: 'レビューで「修正する」を付けた指示を最優先で実行します。危険語を含む指示は実行せず要修正のまま残します。' },
  { title: '② 調査からゴールを提案', detail: '日々の調査結果（ニュースアプリのAIツール調査など）を読み、効果がありそう・やった方が良いことを「次に目指すゴール候補」として1〜3件提案します。承認待ちが3件未満のときだけ補充します。', tag: 'research' },
  { title: '③ 実行する大きな作業を選ぶ', detail: '目標の優先順（最優先pin→boost→優先度）に沿って、いま実行できる大きな作業（Epic）を選びます（scan）。', tag: 'run' },
  { title: '③-a 作業が無ければ「次の一歩」を自動生成', detail: 'ToDoも大きな作業も無い未達成の目標には、目標を前に進める次の1ステップを大きな作業として自動で作ります（ensureNextGoalStepEpic）。', tag: 'run' },
  { title: '③-b それでも無ければ「ゴール生成モード」', detail: '自動実行対象が無いアイドル時は、progressアプリ優先で「改善事項（失敗の解消）」「試した方がいいこと（未消化の次アクション）」を改善ゴール候補として提案し、承認対象を空にしません。承認すれば次回の自動実行が空になりません（2026-06-20追加）。', tag: 'idle' },
  { title: '④ 選んだ作業を実行', detail: '基本はClaudeが実装します。利用上限・失敗を検知したら、安全確認のうえCodexへ切り替えます（Fallback）。課金・本番・認証・破壊操作はFallbackでも自動実行しません。', tag: 'run' },
  { title: '⑤ 検証して作業報告を保存', detail: '実行のたびに型チェック・lintを走らせ、何を変更し何を確認し何が残ったかを作業報告（ExecutionRun）へ保存します。', tag: 'run' },
  { title: '⑥ 完了判定して次へ', detail: '完了条件（doneCriteria）を満たせば次の作業へ、未達なら同じ作業を継続します。1回の起動で最大3作業まで（暴走防止）。', tag: 'run' },
  { title: '⑦ 作業予約を処理（Prompt Queue）', detail: '貯めておいた自由プロンプトの作業予約を処理します。' },
  { title: '⑧ 起動1回分の結果をまとめて保存', detail: 'Review Fix・Epic・Prompt Queueが何件実行・予約・停止したかを1件の記録にまとめます（Envelope Run）。', tag: 'safety' },
]

const STEP_TAG_STYLE: Record<NonNullable<(typeof AUTO_STEPS)[number]['tag']>, { label: string; cls: string }> = {
  research: { label: '調査', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  idle: { label: 'ゴール生成', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  safety: { label: '安全', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  run: { label: '実行', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

const OVERVIEW = ['二重起動防止', '①修正依頼', '②調査→目標提案', '③作業を選ぶ/生成', '④実行(Claude→Codex)', '⑤検証・報告', '⑦作業予約', '⑧結果保存']

const SAFETY_RULES = [
  ['危険判断待ち（本番・課金・認証・公開）', '今回の自動実行をスキップ。あなたの許可が出るまで待つ'],
  ['Goal未設定のEpic', 'そのEpicだけ対象外。全候補がGoal未設定なら実質停止'],
  ['billing / production_db / auth_secret / migration / destructive / external_publish', '承認必須。Fallbackでも自動実行しない'],
  ['approval_required', '該当作業だけ人間判断待ち（他は止めない）'],
  ['manual / factoryEligible=false', '自動実行対象外'],
  ['deploy', '注意表示のみ。単独では自動実行を止めない'],
  ['Epic status=blocked / blockersあり', '該当Epicをブロック。次のEpicへ進む'],
  ['レビュー未確認', '原則として実行継続。レビュー件数では工場を止めない'],
] as const

const RUNNERS = [
  ['Review Fix Runner', 'needs_followup + fixPrompt', '危険語を含まない修正依頼', 'ExecutionRunを追加し元Runを更新'],
  ['Epic Runner', 'Epic / 未達成Goal', 'Epic Contract・Approval・riskFlags・Goal紐付け', '実装、検証、ExecutionRun、Epic進捗'],
  ['Prompt Queue Runner', 'Prompt Queue候補', '危険語・未紐付け・状態', '予約またはExecutionRun、Queue状態更新'],
] as const

const DATA_STORES = [
  ['goals.json', 'Goal・Phase・GoalTodo', '正本'],
  ['epics.json', 'Epic Contract・進捗・安全設定・キュー手動操作', '正本'],
  ['execution-runs.json', '実行結果・レビュー状態・検証・選定理由', '正本'],
  ['approvals.json', '承認要求と決定状態', '正本'],
  ['project-tasks.json', 'Project配下のToDo', '正本'],
  ['prompt-queue.json', '自由プロンプトの作業予約', '正本'],
  ['recommended-epics.json', 'AIが推薦したEpic候補', '正本'],
  ['monetization-candidates.json', '収益化候補', '正本'],
  ['automation-config.json', 'Factory ON/OFF・Executor設定', '設定'],
  ['operational-decisions.ndjson', '人間の判断履歴', '追記ログ'],
  ['automation-log.ndjson', '自動化イベント・停止理由', '追記ログ'],
  ['work-log.ndjson', '作業イベント', '追記ログ'],
  ['knowledge-records.json', 'レビューから得た学習記録', '正本'],
  ['app-progress.json', 'Project進捗', '既存正本'],
  ['verify-todos.json', '人間による動作確認項目', '正本'],
  ['work-queue.json / work-candidates.json', '旧キュー・旧候補', '互換・非正本'],
  ['codex-runs.json', 'Codex実行管理', '補助正本'],
] as const

const API_GROUPS = [
  ['実行・状態', '/api/operations/factory-schedule, factory-run, factory-status, factory-overview, health, metrics, automation-config, automation-log'],
  ['安全・切替', '/api/operations/approvals, claude-limit, auto-fallback, auto-resume, codex-prompt, handoff'],
  ['Epic', '/api/operations/epics, epics/[epicId], factory-candidates, factory-dispatch, done-criteria, next-actions'],
  ['Goal', '/api/goals, goals/main, goals/propose, goals/[goalId]/approve, goals/[goalId]/priority, goals/sync'],
  ['キュー', '/api/auto-queue, auto-queue/control, queue, queue/[id], queue/reorder, queue/add-from-task'],
  ['Run・レビュー', '/api/execution-runs, execution-runs/[runId], operations/ai-review, operations/review-copy'],
  ['Project・Task・補助', '/api/projects, tasks, session, prompt-queue, inbox, codex/runs, app-urls, usage, verify-todos'],
] as const

const PLAIN_TERMS = [
  ['調査からのゴール提案', '自動実行の最初に、日々の調査結果（ニュースアプリのAIツール調査など）から効果がありそうなことを「次に目指すゴール候補」として提案する処理です。'],
  ['ゴール生成モード', '自動実行できる作業が無いアイドル時に、progress優先で改善事項・試した方がいいことをゴール候補として提案し、承認対象が空のままにならないようにする処理です（2026-06-20追加）。'],
  ['ExecutionRun', 'AIが1回何を行い、何を変更し、何を確認し、何が残ったかを保存する作業報告です。'],
  ['Envelope Run', '定時起動1回全体のまとめ記録です。各Runnerが何件実行・保留・停止したかを1件へ記録します。'],
  ['Runner', '実際の作業を担当する処理です。「修正依頼を処理する係」「Epicを進める係」「作業予約を処理する係」に分かれます。'],
  ['ゲート', '作業開始前の安全確認です。危険操作・承認待ち・Factory OFFを確認し、問題がある作業だけ止めます。'],
  ['lock取得', '同じ定時処理が重なって二重実行されないよう、一時的に「実行中」の印を付ける処理です。終了時に外します。'],
  ['Executor / Fallback', '作業を実行するAI（Claude・Codex）や人です。Fallbackは上限・障害時に安全確認後へ別の実行者へ切り替える仕組みです。'],
  ['Epic Contract', '大きな作業をAIへ任せる前提条件です。目的・完了条件・優先度・危険性・承認方針を明記します。'],
  ['riskFlags', '課金・本番DB・認証情報・外部公開など、注意・承認が必要な危険性を示す印です。'],
  ['正本 / 派生ビュー', '正本は更新先の唯一の元データ。派生ビュー（自動実行キュー等）は正本から毎回計算する表示で、別ファイルに保存しません。'],
  ['systemd', 'VPSで決めた時刻や起動時に処理を開始するOSの仕組みです。11時・14時・16時・23時の起動に使います。'],
] as const

const LEGACY_ITEMS = [
  ['factoryRunState', '廃止済み', '複数Runnerを一括停止する合成ゲートだった。現在は起動ゲートにも表示にも使わず、過去ログの文字列だけ監査用に残す。'],
  ['work-queue.json / work-candidates.json', '互換', '旧キュー・旧候補データ。自動実行順の正本には使わない。'],
  ['/legacy/queue・/approvals', '互換画面', '閲覧用。現行キューは /queue、通常判断は /decide に集約。'],
  ['Auto Resume / Auto Fallback', '部分・半自動', 'Auto Resumeは再開候補の評価・記録。FallbackはCodex用プロンプト生成まで（外部Codexの完全自動起動は保証しない）。'],
] as const

function Arrow() {
  return <span className="shrink-0 text-gray-300 dark:text-gray-600">→</span>
}

/** 折りたたみ参照セクション（iPhone で初期スクロールを短くするため既定で閉じる）。 */
function Section({ title, hint, children, open = false }: { title: string; hint?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className={`${card} group`}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
        <span className={h2}>{title}</span>
        <span className="shrink-0 text-xs text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      {hint && <p className={`mt-2 ${text}`}>{hint}</p>}
      <div className="mt-3">{children}</div>
    </details>
  )
}

export default async function SystemSpecification() {
  const [status, config] = await Promise.all([computeFactoryStatus(), getAutomationConfig()])
  const screenCount = NAV_GROUPS.reduce((sum, group) => sum + group.links.length, 0)

  return (
    <article className="space-y-4">
      {/* ヘッダ */}
      <section className={`${card} border-2 border-indigo-300 dark:border-indigo-800`}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Progress system specification</p>
        <h2 className="mt-1 text-lg font-black text-gray-950 dark:text-white">自動実行のしくみ（Progress 仕様）</h2>
        <p className={`mt-2 ${text}`}>
          いちばん知りたい「自動実行で何が起きるか」を先頭にまとめました。詳しい参照（安全条件・Runner・データ・API・画面）は下の各見出しをタップで開けます。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Factory" value={config.factoryEnabled ? 'ON' : 'OFF'} />
          <Metric label="現在状態" value={status.state} />
          <Metric label="実行候補" value={`${status.runnable}件`} />
          <Metric label="到達画面" value={`${screenCount}`} />
        </div>
      </section>

      {/* ★主役: 自動実行フロー（既定で開く） */}
      <section className={`${card} border-2 border-blue-300 dark:border-blue-800`}>
        <h2 className={h2}>自動実行で行われる処理（11 / 14 / 16 / 23時）</h2>
        <p className={`mt-1 ${text}`}>定時になると、この順番で1回分が動きます。② に「調査」、③-b に「ゴール生成モード」が含まれます。</p>

        {/* 全体像（横スクロールせず折り返す簡易フロー） */}
        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {OVERVIEW.map((item, i) => (
            <span key={item} className="flex items-center gap-1">
              {i > 0 && <Arrow />}
              <span className="rounded-md bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{item}</span>
            </span>
          ))}
        </div>

        {/* 詳しい手順 */}
        <ol className="mt-4 space-y-2">
          {AUTO_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{i + 1}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                  {step.title}
                  {step.tag && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${STEP_TAG_STYLE[step.tag].cls}`}>{STEP_TAG_STYLE[step.tag].label}</span>
                  )}
                </p>
                <p className={`mt-0.5 ${text}`}>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className={`mt-3 rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200 ${text}`}>
          調査（②）と ゴール生成モード（③-b）は、どちらも「次にやることが尽きて自動実行が空になる」のを防ぐ補充役です。調査は外（ニュース）から、ゴール生成モードは中（progress自身の改善）から候補を足します。提案はすべて承認待ちとして残り、承認したものだけが次回の自動実行対象になります。
        </p>
      </section>

      {/* 以下は折りたたみ参照（既定で閉じる＝iPhoneで縦に伸びすぎない） */}

      <Section title="どこで止まるか（安全条件）" hint="人間しか判断できないものだけ止めます。レビュー件数や過去の失敗では全体停止しません。">
        <div className="space-y-2">
          {SAFETY_RULES.map(([key, value]) => (
            <div key={key} className="grid gap-1 rounded-lg bg-gray-50 p-2.5 sm:grid-cols-[230px_1fr] dark:bg-gray-800/50">
              <code className="text-[10px] font-bold text-gray-700 dark:text-gray-200">{key}</code>
              <p className={text}>{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="作業係（Runner）と実行担当（Executor）" hint="定時起動は3つの作業係を順に呼び、各係が自分の候補と安全条件を個別に判定します。">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead><tr className="border-b border-gray-200 text-gray-400 dark:border-gray-700"><th className="p-2">作業係</th><th className="p-2">受け取るもの</th><th className="p-2">開始前の確認</th><th className="p-2">残すもの</th></tr></thead>
            <tbody>{RUNNERS.map((row) => <tr key={row[0]} className="border-b border-gray-100 dark:border-gray-800">{row.map((cell) => <td key={cell} className="p-2 align-top text-gray-600 dark:text-gray-300">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className={`mt-3 ${text}`}>実行担当は基本Claude。利用上限・失敗を検知したら安全確認のうえCodexへ切り替えます（Fallback）。課金・本番DB・認証・外部公開・破壊操作はFallbackでも自動実行しません。</p>
      </Section>

      <Section title="自動実行キューの並び順" hint="キューは正本ではなく、目標・大きな作業・作業報告・承認から毎回計算する派生ビューです。">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {['目標', '小作業', '大きな作業', '承認状況', '作業報告', '実行可否を判定', '優先順を計算', '次の1件+候補'].map((item, i) => (
            <span key={item} className="flex items-center gap-1">
              {i > 0 && <Arrow />}
              <span className="rounded-md bg-gray-50 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{item}</span>
            </span>
          ))}
        </div>
        <ol className={`mt-3 space-y-1 ${text}`}>
          <li>1. 明示pin（手動で最優先・絶対上位）</li>
          <li>2. Review Fix・自走化アンカー（安全のため据え置き）</li>
          <li>3. Goal順（pin → boost → 優先度 高→中→低）</li>
          <li>4. Goal内（手動の上下 → 自動評価点 → 優先度 → 更新時刻）</li>
          <li>5. 安全条件を満たさない作業は順位を保持しても候補外</li>
        </ol>
      </Section>

      <Section title="状態モデル" hint="現在使う具体状態だけ。合成状態 factoryRunState は廃止しました。">
        <ul className={`space-y-1 ${text}`}>
          <li>・Factory ON/OFF: automation-config.json</li>
          <li>・WorkItemStatus: executable / waiting_user / ai_hold / review_waiting / blocked / manual / done</li>
          <li>・RunStatus: running / completed / failed / partial</li>
          <li>・ReviewStatus: not_reviewed / reviewed / needs_followup / needs_human / snoozed</li>
          <li>・GoalStatus: proposed / active / paused / done / dropped / archived（proposed=AI/調査/ゴール生成モードの提案。承認でactive）</li>
        </ul>
      </Section>

      <Section title="元データ（正本）・ログ・互換データ">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead><tr className="border-b border-gray-200 text-gray-400 dark:border-gray-700"><th className="p-2">ファイル</th><th className="p-2">内容</th><th className="p-2">区分</th></tr></thead>
            <tbody>{DATA_STORES.map(([file, purpose, kind]) => <tr key={file} className="border-b border-gray-100 dark:border-gray-800"><td className="p-2 font-mono text-[10px]">{file}</td><td className="p-2 text-gray-600 dark:text-gray-300">{purpose}</td><td className="p-2 font-semibold text-gray-500">{kind}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title="受付口（API）" hint="画面・定時処理・別アプリがProgressへ依頼する受付口です。">
        <div className="space-y-2">
          {API_GROUPS.map(([group, endpoints]) => (
            <details key={group} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <summary className="cursor-pointer text-xs font-bold text-gray-900 dark:text-gray-100">{group}</summary>
              <p className="mt-2 break-words font-mono text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">{endpoints}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section title="画面と到達保証" hint="全画面メニューの正本は nav-menu.ts。下タブ・上タブにない画面も☰から到達できます。">
        <div className="grid gap-3 sm:grid-cols-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={sub}>
              <h3 className={h3}>{group.title}</h3>
              <ul className="mt-2 space-y-1">
                {group.links.map((link) => <li key={link.href}><Link href={link.href} className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400">{link.label}</Link><span className="text-[10px] text-gray-400"> — {link.note}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="用語を人間語で" hint="専門名はコードを探せるよう括弧で残し、その前に実際の動きを書いています。">
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAIN_TERMS.map(([term, explanation]) => (
            <div key={term} className={sub}>
              <h3 className={h3}>{term}</h3>
              <p className={`mt-1 ${text}`}>{explanation}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="設計原則・互換・変更時チェック">
        <h3 className={h3}>最重要設計原則</h3>
        <ul className={`mt-2 space-y-1 ${text}`}>
          <li>・キューは正本ではない。Goal・Epic・Run・Approvalから毎回生成する派生ビュー。</li>
          <li>・安全判定は作業単位。無関係な承認待ちや候補不足で全Runnerを止めない。</li>
          <li>・スケジューラは起動と二重起動防止だけ。作業可否は各Runnerへ委譲。</li>
          <li>・人間判断が必要な操作だけ止める。レビュー件数・過去の失敗では止めない。</li>
          <li>・実行結果は必ずExecutionRunへ記録。物理削除より状態変更・アーカイブ。</li>
        </ul>
        <h3 className={`${h3} mt-4`}>残存・互換・廃止</h3>
        <div className="mt-2 space-y-2">
          {LEGACY_ITEMS.map(([name, state, detail]) => (
            <div key={name} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2"><code className="text-[11px] font-bold">{name}</code><span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{state}</span></div>
              <p className={`mt-1 ${text}`}>{detail}</p>
            </div>
          ))}
        </div>
        <h3 className={`${h3} mt-4`}>変更時の必須チェック</h3>
        <ol className={`mt-2 space-y-1 ${text}`}>
          <li>1. 新しい正本を増やしていないか</li>
          <li>2. 表示用派生値を実行ゲートへ流用していないか</li>
          <li>3. あるRunnerの候補不足が別Runnerを止めていないか</li>
          <li>4. 危険操作だけが人間判断へ送られているか</li>
          <li>5. ExecutionRunに選定理由・結果・検証・未対応点が残るか</li>
          <li>6. nav-menu.tsへ画面を追加し孤立ページを作っていないか</li>
          <li>7. tsc・build・GET画面・状態APIを確認したか</li>
        </ol>
      </Section>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5 text-center dark:bg-gray-800/50">
      <p className="text-[10px] font-semibold text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-black text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}
