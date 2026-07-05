import Link from 'next/link'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { buildInbox } from '@/lib/command-center'
import { STATUS_SUBTABS } from '@/lib/nav-groups'
import { getProjectCompletionView, type ProjectCompletion, type ProjectCompletionProgress, type ProjectWithoutGoals } from '@/lib/project-completion'

export const dynamic = 'force-dynamic'

export default async function ProjectCompletePage() {
  const [view, inbox] = await Promise.all([
    getProjectCompletionView(),
    buildInbox(),
  ])
  const achievedGoalIds = new Set(inbox.achievedGoalIds)
  const achievementReviewCount = (projectId: string) =>
    inbox.reviews.filter((card) => card.projectId === projectId && card.goalId && achievedGoalIds.has(card.goalId)).length

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="プロジェクト完了サマリー"
        guide="プロジェクトの完了状況。分母は動いている(active)ゴールと達成済みゴールのみで、保留・提案中は数えません"
      />
      <SubTabBar items={STATUS_SUBTABS} />

      <section className="space-y-3">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">完了したプロジェクト</h2>
        {view.completions.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            全ゴールが達成済みのプロジェクトはまだありません。
          </div>
        ) : (
          view.completions.map((completion) => (
            <CompletionCard
              key={completion.projectId}
              completion={completion}
              reviewCount={achievementReviewCount(completion.projectId)}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">もうすぐ完了</h2>
        {view.nearCompletions.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
            active/done ゴールを持つ未完了プロジェクトはありません。
          </p>
        ) : (
          <div className="space-y-2">
            {view.nearCompletions.map((item) => (
              <NearCompletionRow key={item.projectId} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">ゴール未設定のプロジェクト</h2>
        {view.projectsWithoutGoals.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
            ゴールが1件も無いプロジェクトはありません。
          </p>
        ) : (
          <div className="space-y-2">
            {view.projectsWithoutGoals.map((project) => (
              <ProjectWithoutGoalsRow key={project.projectId} project={project} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function CompletionCard({ completion, reviewCount }: { completion: ProjectCompletion; reviewCount: number }) {
  const achievementHref = `/decide?tab=achievement&projectId=${encodeURIComponent(completion.projectId)}`

  return (
    <article className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{completion.projectId}</p>
          <h2 className="text-base font-black text-gray-900 dark:text-gray-100">{completion.projectTitle}</h2>
          <SupplementaryNote pausedCount={completion.pausedCount} proposedCount={completion.proposedCount} />
        </div>
        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700 dark:bg-green-900/30 dark:text-green-200">
          ✅ 全{completion.achievedGoals.length}ゴール達成
        </span>
      </div>

      <section className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
        <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">提供した内容（現運用への差分）</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          このプロジェクトが運用に追加・変更した達成ゴールの一覧です。
        </p>
        <ul className="mt-2 space-y-2">
          {completion.achievedGoals.map((goal) => (
            <li key={goal.id} className="rounded-lg bg-white p-2 text-xs dark:bg-gray-950">
              <p className="font-bold text-gray-900 dark:text-gray-100">{goal.title}</p>
              {goal.summary ? <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{goal.summary}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-200">残っている確認</p>
          <p className="mt-1 text-xl font-black text-blue-900 dark:text-blue-100">{reviewCount}件</p>
        </div>
        <Link
          href={achievementHref}
          className="flex min-h-20 items-center justify-center rounded-xl bg-blue-600 px-3 text-center text-xs font-black text-white"
        >
          達成確認を開く
        </Link>
      </section>

      <section className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">次に必要な候補</h3>
        {completion.nextCandidates.length === 0 ? (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
              次の候補はまだありません。アイドル時の自動実行（ゴール生成モード）で補充されます。
            </p>
            <Link href="/goal-planner" className="inline-flex rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              目標を確認
            </Link>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {completion.nextCandidates.map((candidate) => (
              <li key={candidate.id} className="rounded-lg bg-gray-50 p-2 text-xs dark:bg-gray-900">
                <p className="font-bold text-gray-900 dark:text-gray-100">{candidate.title}</p>
                <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{candidate.kind}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}

function NearCompletionRow({ item }: { item: ProjectCompletionProgress }) {
  const pct = item.total > 0 ? Math.round((item.achieved / item.total) * 100) : 0
  const shown = item.remainingGoals.slice(0, 3)
  const rest = Math.max(0, item.remainingGoals.length - shown.length)
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">{item.projectId}</p>
          <h3 className="break-words text-sm font-black text-gray-900 dark:text-gray-100">{item.projectTitle}</h3>
          <SupplementaryNote pausedCount={item.pausedCount} proposedCount={item.proposedCount} />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black text-gray-900 dark:text-gray-100">{item.achieved}/{item.total}</p>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{pct}%</p>
        </div>
      </div>
      <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
        <p className="text-[11px] font-black text-gray-700 dark:text-gray-200">残りゴール</p>
        {shown.length === 0 ? (
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">残りactiveゴールはありません。</p>
        ) : (
          <p className="mt-1 break-words text-xs leading-relaxed text-gray-700 dark:text-gray-300">
            {shown.map((goal) => goal.title).join(' / ')}
            {rest > 0 ? ` ほか${rest}件` : ''}
          </p>
        )}
      </div>
    </article>
  )
}

function ProjectWithoutGoalsRow({ project }: { project: ProjectWithoutGoals }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">{project.projectId}</p>
        <h3 className="break-words text-sm font-black text-gray-900 dark:text-gray-100">{project.projectTitle}</h3>
      </div>
      <Link href="/goal-planner" className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-100">
        追加
      </Link>
    </article>
  )
}

function SupplementaryNote({ pausedCount, proposedCount }: { pausedCount: number; proposedCount: number }) {
  if (pausedCount === 0 && proposedCount === 0) return null
  return (
    <p className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
      ほか保留{pausedCount}・提案{proposedCount}（分母外）
    </p>
  )
}
