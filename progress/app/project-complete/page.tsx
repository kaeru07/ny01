import Link from 'next/link'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { buildInbox } from '@/lib/command-center'
import { STATUS_SUBTABS } from '@/lib/nav-groups'
import { getProjectCompletionView, type ProjectCompletion } from '@/lib/project-completion'

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
        guide="プロジェクトのゴールが全て達成されたら、提供した内容・残っている確認・次に必要な候補をまとめます。"
      />
      <SubTabBar items={STATUS_SUBTABS} />

      {view.completions.length === 0 ? (
        <EmptyState progress={view.progress} />
      ) : (
        <section className="space-y-4">
          {view.completions.map((completion) => (
            <CompletionCard
              key={completion.projectId}
              completion={completion}
              reviewCount={achievementReviewCount(completion.projectId)}
            />
          ))}
        </section>
      )}
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

function EmptyState({ progress }: { progress: Array<{ projectId: string; projectTitle: string; achieved: number; total: number }> }) {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
        全ゴールが達成済みのプロジェクトはまだありません。各プロジェクトのゴールが全て達成されると、ここに完了サマリーが表示されます。
      </div>
      {progress.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {progress.map((item) => (
            <div key={item.projectId} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
              <p className="truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">{item.projectTitle}</p>
              <p className="mt-1 text-lg font-black text-gray-900 dark:text-gray-100">{item.achieved}/{item.total}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">達成ゴール</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
          プロジェクトに紐づくゴールはまだありません。
        </p>
      )}
    </section>
  )
}
