export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readGoals } from '@/lib/goal-reader'

// 一時ページ: 旧Vault運用 → 今のゴール運用(progress) の対応表。
// 統合作業(①〜⑥)が終わったら役目を終える想定。正本ドキュメントは
// obsidian-sync-vault/06_research/2026-06-20_旧Vault運用と現ゴール運用の統合点検.md。

const card = 'rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900'
const text = 'text-[12px] leading-relaxed text-gray-600 dark:text-gray-300'

type MapRow = {
  oldVault: string
  progressConcept: string
  sourceOfTruth: string
  note: string
}

// 対応表（旧Vault → 今のprogress / 正本寄せ先 / 所見）。
const MAP_ROWS: MapRow[] = [
  { oldVault: '収益化の候補（candidate-001〜007）', progressConcept: '目標（Goal・収益化系）', sourceOfTruth: 'progress: Goal', note: 'Vaultは元メモ・調査背景として参照' },
  { oldVault: '候補の状態（候補/承認待ち/承認済）', progressConcept: '目標の状態（提案/実行中/保留）', sourceOfTruth: 'progress: Goal.status', note: '候補/承認/保留の判断状態をGoalStatusへ寄せる' },
  { oldVault: 'ChatGPT承認待ち・方向性レビュー', progressConcept: 'ゴール承認 ＋ レビューキュー', sourceOfTruth: 'progress: Inbox / Approval / Review', note: 'Vaultはレビュー依頼文と判断ログの置き場に限定' },
  { oldVault: 'vloopの実行待ち一覧（vloop_queue）', progressConcept: '自動実行キュー（/queue）', sourceOfTruth: 'progress: buildAutoQueue()', note: '実行順はProgressの派生キューに統一' },
  { oldVault: 'vloop（まとめてToDoを処理）', progressConcept: '自動実行（11/14/16/23時）', sourceOfTruth: 'progress: Factory / ExecutionRun', note: '実行エンジンと結果記録はProgress側へ寄せる' },
  { oldVault: '案件別ToDo一覧', progressConcept: '目標内のToDo / タスク', sourceOfTruth: 'progress: Goal.todos / Task', note: '未完了作業はGoalに紐づけて管理' },
  { oldVault: '案件別ゴール進捗', progressConcept: '目標の進捗（今/目標）', sourceOfTruth: 'progress: Goal.current / Goal.target', note: '進捗率は今/目標の数値指標へ統一' },
  { oldVault: '完了ToDoログ', progressConcept: '実行履歴（作業ログ）', sourceOfTruth: 'progress: ExecutionRun', note: '完了・検証・次アクションはExecutionRunに残す' },
  { oldVault: '収益化のEpic（A〜D）', progressConcept: '工場Epic（大きな作業）', sourceOfTruth: 'progress: Epic', note: 'VaultのEpic案はProgress Epic化後に実行対象' },
  { oldVault: '収益化ロードマップ', progressConcept: '収益（Revenue）のマイルストーン', sourceOfTruth: 'progress: Revenue milestones', note: 'ロードマップ表示と現在地はProgress側で見る' },
]

const SOURCE_RULES = [
  '実行・順番・ToDo・進捗・完了履歴はprogressを正本にする',
  'Vaultは元資料、判断ログ、ナレッジ、ChatGPTレビュー依頼の入口として残す',
  '同じ判断をVaultとprogressの2か所で更新しない',
]

// ⑤ vloop→progress 置き換え可否チェック（代替可否の検証）。
// 旧vloop（まとめてVaultのToDoを処理する仕組み）の各機能を、progressの自動実行
// （factory-runner / auto-queue / ExecutionRun）が代替できるかを1機能ずつ突き合わせた結果。
// 「やめる/寄せる」の最終決定はユーザー承認に委ね、ここでは検証材料のみを提示する。
type ParityRow = {
  vloopFeature: string
  progressCounterpart: string
  covered: '○' | '△' | '×'
  note: string
}

const PARITY_ROWS: ParityRow[] = [
  { vloopFeature: 'まとめてToDo/Epicを処理', progressCounterpart: 'factory-runner（scan→pick→Dispatch→Run→記録→次へ）', covered: '○', note: '一括処理の中核はfactory-runnerが担う' },
  { vloopFeature: 'Epic完了優先（doneCriteriaまで回す）', progressCounterpart: 'auto-queue（doneCriteria進捗）＋ caps(maxPerEpic)', covered: '○', note: 'Epic単位の進捗・完了判定はauto-queue側にある' },
  { vloopFeature: '定時実行', progressCounterpart: '自動実行 11/14/16/23時', covered: '○', note: 'スケジュール実行はprogress側で稼働中' },
  { vloopFeature: '実行待ち一覧（vloop_queue）', progressCounterpart: 'auto-queue / 自動実行キュー（/queue）', covered: '○', note: '実行順はProgressの派生キューに一本化済み' },
  { vloopFeature: '完了ログ記録', progressCounterpart: 'ExecutionRun（検証・次アクション付き）', covered: '○', note: '記録の構造化はProgress側が上位互換' },
  { vloopFeature: 'Claude上限時の継続', progressCounterpart: 'Codex fallback（factory-runner）', covered: '○', note: 'vloopは上限「検知」のみ。継続はProgressが上' },
  { vloopFeature: '承認/Decision待ちのgating', progressCounterpart: 'auto-queueの承認・Decision待ち除外', covered: '○', note: '危険作業・承認待ちの停止はProgressで担保' },
  { vloopFeature: 'pm2常駐プロセス', progressCounterpart: 'スケジュール駆動（常駐プロセスなし）', covered: '△', note: '実行形態が違う。廃止時はautoexec routeの扱いを決める' },
]

// 廃止する場合に後始末が要るコード上のvloop参照（⑥の片付け対象）。
const PARITY_RESIDUALS = [
  'claude-limit-detector.ts: vloop実行ログ(stop_reason)を上限検知のSource2として参照',
  'operations-store.ts: vloopSourceOfTruth / executionTarget がVaultパスをハードコード',
  'api/operations/autoexec/route.ts: pm2の"vloop"プロセスをstart/stop前提',
]

// 統合の進め方（①〜⑥）。タイトル先頭の丸数字で goals.json と突き合わせて状態を出す。
const STEPS = ['①', '②', '③', '④', '⑤', '⑥']
const STEP_DEFAULT: Record<string, string> = {
  '①': '旧Vaultと今のゴール運用を見比べて、まとめ方を決める（この表）',
  '②': '収益化の候補を今のゴールに移す',
  '③': 'やることリストと自動実行の順番をprogressにまとめる',
  '④': '承認の入口（ChatGPTレビューとゴール承認）の役割を整理して重複をなくす',
  '⑤': '旧vloopの扱いを決める（やめる/progressに寄せる）',
  '⑥': '移行後の古い運用メモを片付けて、入口を今の形に更新する',
}
const STATUS_LABEL: Record<string, string> = { proposed: '承認待ち', active: '実行中', paused: '後で', done: '完了', dropped: '取りやめ', archived: '保管' }
const STATUS_CLS: Record<string, string> = {
  proposed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  paused: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  done: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

export default async function IntegrationMapPage() {
  const goals = await readGoals()
  const proposed = goals.goals.filter((g) => g.status === 'proposed')
  const tryCount = proposed.filter((g) => g.proposalSource === 'research').length
  const appCount = proposed.length - tryCount

  // ①〜⑥の現在状態（タイトル先頭の丸数字で照合）。
  const stepStatus = STEPS.map((mark) => {
    const goal = goals.goals.find((g) => g.title.trim().startsWith(mark))
    return { mark, title: goal?.title.replace(/^[①②③④⑤⑥]/, '').trim() || STEP_DEFAULT[mark], status: goal?.status }
  })

  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      <section className={`${card} border-2 border-indigo-300 dark:border-indigo-800`}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">一時ページ</p>
        <h1 className="mt-1 text-lg font-black text-gray-950 dark:text-white">旧Vault運用 → 今のゴール運用 対応表</h1>
        <p className={`mt-2 ${text}`}>
          旧Vault側の運用と、今のprogressのゴール運用が「候補→承認→キュー→実行→完了→進捗」で<strong>2つに分かれている</strong>状態の対応表です。
          統合の<strong>正本は progress に寄せ</strong>、Vaultは「判断ログ・ナレッジ・ChatGPTレビューの入口」に役割を絞ります。
        </p>
        <p className={`mt-2 ${text}`}>※ これは統合作業（下の①〜⑥）が終わるまでの一時ページです。元資料は Obsidian の「06_research / 旧Vault運用と現ゴール運用の統合点検」。</p>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">対応表</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 dark:border-gray-700">
                <th className="p-2">旧Vault運用</th>
                <th className="p-2">今のprogress（寄せ先）</th>
                <th className="p-2">正本寄せ先</th>
                <th className="p-2">所見</th>
              </tr>
            </thead>
            <tbody>
              {MAP_ROWS.map((row) => (
                <tr key={row.oldVault} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 align-top text-gray-600 dark:text-gray-300">{row.oldVault}</td>
                  <td className="p-2 align-top font-semibold text-gray-800 dark:text-gray-100">{row.progressConcept}</td>
                  <td className="p-2 align-top font-semibold text-indigo-700 dark:text-indigo-300">{row.sourceOfTruth}</td>
                  <td className="p-2 align-top text-gray-500 dark:text-gray-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`mt-3 rounded-lg bg-indigo-50 p-2.5 font-semibold text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-200 ${text}`}>
          <p>正本寄せの確定ルール</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 pl-0">
            {SOURCE_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">⑤ vloop → progress 置き換え可否チェック</h2>
        <p className={`mt-1 ${text}`}>
          旧vloop（まとめてVaultのToDoを処理する仕組み）の各機能を、progressの自動実行（factory-runner / auto-queue / ExecutionRun）が
          代替できるかを1機能ずつ突き合わせた<strong>検証材料</strong>です。「やめる/寄せる」の最終決定はゴール承認でユーザーが行います（ここでは決めません）。
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 dark:border-gray-700">
                <th className="p-2">vloopの機能</th>
                <th className="p-2">progress側の対応</th>
                <th className="p-2 text-center">カバー</th>
                <th className="p-2">所見</th>
              </tr>
            </thead>
            <tbody>
              {PARITY_ROWS.map((row) => (
                <tr key={row.vloopFeature} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 align-top text-gray-600 dark:text-gray-300">{row.vloopFeature}</td>
                  <td className="p-2 align-top font-semibold text-gray-800 dark:text-gray-100">{row.progressCounterpart}</td>
                  <td className={`p-2 text-center align-top text-base font-bold ${row.covered === '○' ? 'text-green-600 dark:text-green-400' : row.covered === '△' ? 'text-amber-500' : 'text-red-500'}`}>{row.covered}</td>
                  <td className="p-2 align-top text-gray-500 dark:text-gray-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`mt-3 rounded-lg bg-green-50 p-2.5 font-semibold text-green-900 dark:bg-green-900/20 dark:text-green-200 ${text}`}>
          <p>検証の結論（判断材料）</p>
          <p className="mt-1 font-normal">
            vloopの中核（まとめ処理・Epic完了優先・実行キュー・完了記録・上限時の継続）は progress の factory-runner / auto-queue が<strong>すべてカバー済み</strong>。
            機能面では「やめてprogressに寄せる」が成立します。残るのは下記のコード参照3点の後始末（⑥の片付け）のみで、これは実行エンジンの代替可否とは別問題です。
          </p>
        </div>
        <div className={`mt-2 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-900/15 ${text}`}>
          <p className="font-semibold text-amber-900 dark:text-amber-200">廃止時に後始末が要るコード参照（⑥対象）</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 pl-0 text-amber-800 dark:text-amber-300">
            {PARITY_RESIDUALS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">統合の進め方（①〜⑥）</h2>
        <p className={`mt-1 ${text}`}>各ステップはゴール承認に登録済み。状態はゴールと連動します。</p>
        <ol className="mt-3 grid grid-cols-2 gap-2">
          {stepStatus.map((s) => (
            <li key={s.mark} className="flex gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-800/50">
              <span className="mt-0.5 shrink-0 text-base font-bold text-indigo-500">{s.mark}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-gray-900 dark:text-gray-100">
                  {s.title}
                  {s.status && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_CLS[s.status] ?? 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Link href="/decide?tab=goalApproval" className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/15 dark:text-blue-300">ゴール承認で①〜⑥を見る →</Link>
          <span className="rounded-lg border border-gray-200 px-2.5 py-1 text-gray-500 dark:border-gray-700 dark:text-gray-400">承認待ち: 試した方がいい系 {tryCount} / アプリ系 {appCount}</span>
        </div>
      </section>
    </div>
  )
}
