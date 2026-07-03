export const dynamic = 'force-dynamic'

import Link from 'next/link'
import SubTabBar from '@/components/navigation/SubTabBar'
import CandidateActionButton from '../CandidateActionButton'
import EnableSkillButton from './EnableSkillButton'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { AUTO_EXECUTION_SUBTABS } from '@/lib/nav-groups'
import { readSkillImprovementCandidates, readSkills, readSkillVersions } from '@/lib/skill-store'
import type { ExecutionRun } from '@/types/execution-run'

interface Params {
  params: { skillId: string }
}

function runTime(run: ExecutionRun): number {
  const value = Date.parse(run.finishedAt || run.startedAt)
  return Number.isFinite(value) ? value : 0
}

function fmtDateTime(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function fmtRate(value: number | undefined): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '-'
}

function executorBadgeClass(executor?: 'claude' | 'codex'): string {
  if (executor === 'codex') return 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-200'
  if (executor === 'claude') return 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
  return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'
}

function executorLabel(executor?: 'claude' | 'codex'): string {
  if (executor === 'codex') return 'Codex推奨'
  if (executor === 'claude') return 'Claude推奨'
  return '推奨未設定'
}

function runStatusLabel(status: ExecutionRun['runStatus']): string {
  if (status === 'completed') return '完了'
  if (status === 'failed') return '失敗'
  if (status === 'partial') return '一部完了'
  return '実行中'
}

function reviewStatusLabel(status: ExecutionRun['reviewStatus']): string {
  if (status === 'reviewed') return '問題なし'
  if (status === 'needs_followup') return '要修正'
  if (status === 'needs_human') return '人間判断'
  if (status === 'snoozed') return 'あとで'
  if (status === 'copied') return 'コピー済み'
  return '未確認'
}

function metrics(runs: ExecutionRun[]) {
  const usage = runs.length
  const sorted = [...runs].sort((a, b) => runTime(b) - runTime(a))
  return {
    usage,
    closeOkRate: usage > 0 ? runs.filter((run) => run.reviewStatus === 'reviewed').length / usage : undefined,
    needsFixRate: usage > 0 ? runs.filter((run) => run.reviewStatus === 'needs_followup').length / usage : undefined,
    failedRate: usage > 0 ? runs.filter((run) => run.runStatus === 'failed').length / usage : undefined,
    lastUsed: sorted[0]?.finishedAt || sorted[0]?.startedAt,
  }
}

export default async function SkillDetailPage({ params }: Params) {
  const skillId = decodeURIComponent(params.skillId)
  const [skills, runs, candidates, versions] = await Promise.all([
    readSkills(),
    readExecutionRuns(),
    readSkillImprovementCandidates(),
    readSkillVersions(),
  ])
  const skill = skills.find((item) => item.id === skillId)
  if (!skill) {
    return (
      <main className="px-4 pb-6 pt-4">
        <SubTabBar items={AUTO_EXECUTION_SUBTABS} />
        <p className="mt-4 text-sm text-gray-500">Skillが見つかりません。</p>
      </main>
    )
  }

  const skillRuns = runs.filter((run) => run.skillId === skill.id).sort((a, b) => runTime(b) - runTime(a))
  const m = metrics(skillRuns)
  const byVersion = Array.from(
    skillRuns.reduce((map, run) => {
      const version = run.skillVersion ?? 0
      const list = map.get(version) ?? []
      list.push(run)
      map.set(version, list)
      return map
    }, new Map<number, ExecutionRun[]>()),
  ).sort((a, b) => b[0] - a[0])
  const skillVersions = versions.filter((version) => version.skillId === skill.id).sort((a, b) => b.version - a.version)
  const pendingCandidates = candidates.filter((candidate) => (
    candidate.skillId === skill.id && (candidate.status === 'pending' || candidate.status === 'snoozed')
  ))

  return (
    <main className="px-4 pb-6 pt-4">
      <div className="mb-4">
        <SubTabBar items={AUTO_EXECUTION_SUBTABS} />
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/skills" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">Skills一覧へ</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{skill.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">v{skill.version}</span>
            <span className={`rounded-full px-2 py-1 font-semibold ${skill.enabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'}`}>
              {skill.enabled ? '有効' : '無効'}
            </span>
            <span className={`rounded-full px-2 py-1 font-semibold ${executorBadgeClass(skill.preferredExecutor)}`}>
              {executorLabel(skill.preferredExecutor)}
            </span>
            {skill.riskFlags.length > 0 && <span className="text-amber-600">⚠ {skill.riskFlags.join(', ')}</span>}
          </div>
        </div>
        <EnableSkillButton skillId={skill.id} enabled={skill.enabled} />
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{skill.description ?? '説明はありません。'}</p>
        <h2 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">procedure</h2>
        <div className="mt-2 whitespace-pre-line rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">{skill.procedure || '-'}</div>
        {skill.promptTemplate ? (
          <>
            <h2 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">promptTemplate</h2>
            <pre className="mt-2 overflow-x-auto rounded-md bg-gray-950 p-3 text-xs text-gray-100">{skill.promptTemplate}</pre>
          </>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {skill.inputs.map((input) => <span key={`in-${input}`} className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-200">in: {input}</span>)}
          {skill.outputs.map((output) => <span key={`out-${output}`} className="rounded-full bg-purple-50 px-2 py-1 text-purple-700 dark:bg-purple-950 dark:text-purple-200">out: {output}</span>)}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">品質</h2>
        <div className="grid gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500">使用回数</div><div className="text-lg font-bold">{m.usage}</div></div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500">close_ok率</div><div className="text-lg font-bold">{fmtRate(m.closeOkRate)}</div></div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500">needs_fix率</div><div className="text-lg font-bold">{fmtRate(m.needsFixRate)}</div></div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500">failed率</div><div className="text-lg font-bold">{fmtRate(m.failedRate)}</div></div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500">最終使用日</div><div className="text-sm font-bold">{fmtDateTime(m.lastUsed)}</div></div>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"><tr><th className="px-3 py-2 text-left">version</th><th className="px-3 py-2 text-right">件数</th><th className="px-3 py-2 text-right">failed率</th></tr></thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {byVersion.map(([version, list]) => <tr key={version}><td className="px-3 py-2">v{version || '-'}</td><td className="px-3 py-2 text-right">{list.length}</td><td className="px-3 py-2 text-right">{fmtRate(list.filter((run) => run.runStatus === 'failed').length / list.length)}</td></tr>)}
              {byVersion.length === 0 && <tr><td className="px-3 py-2 text-gray-500" colSpan={3}>使用履歴はありません。</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">使用履歴</h2>
        <div className="space-y-2">
          {skillRuns.slice(0, 20).map((run) => (
            <div key={run.runId} className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="text-xs text-gray-500">{fmtDateTime(run.finishedAt || run.startedAt)}</div>
              <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{run.targetTodoTitle}</div>
              <div className="mt-1 text-xs text-gray-500">{runStatusLabel(run.runStatus)} / {reviewStatusLabel(run.reviewStatus)}</div>
            </div>
          ))}
          {skillRuns.length === 0 && <p className="text-sm text-gray-500">使用履歴はありません。</p>}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">バージョン履歴</h2>
        <div className="space-y-2">
          {skillVersions.map((version) => (
            <div key={version.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="font-semibold">v{version.version} <span className="text-xs font-normal text-gray-500">{fmtDateTime(version.createdAt)}</span></div>
              <p className="mt-1 text-gray-700 dark:text-gray-300">{version.changeSummary}</p>
              <p className="mt-1 text-xs text-gray-500">{version.changeReason}</p>
            </div>
          ))}
          {skillVersions.length === 0 && <p className="text-sm text-gray-500">更新履歴はありません。</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">改善候補</h2>
        <div className="space-y-2">
          {pendingCandidates.map((candidate) => (
            <div key={candidate.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-gray-500">{candidate.priority}</span>
                <span className="text-gray-500">{candidate.status}</span>
                {candidate.riskFlags.length > 0 && <span className="text-amber-600">⚠ {candidate.riskFlags.join(', ')}</span>}
              </div>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{candidate.reason}</p>
              <p className="mt-1 text-xs text-gray-500">{candidate.suggestedChange}</p>
              <div className="mt-3 flex gap-2">
                <CandidateActionButton candidateId={candidate.id} action="approve">反映する</CandidateActionButton>
                <CandidateActionButton candidateId={candidate.id} action="snooze">あとで</CandidateActionButton>
                <CandidateActionButton candidateId={candidate.id} action="reject">却下</CandidateActionButton>
              </div>
            </div>
          ))}
          {pendingCandidates.length === 0 && <p className="text-sm text-gray-500">pending/snoozed候補はありません。</p>}
        </div>
      </section>
    </main>
  )
}
