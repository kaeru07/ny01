export const dynamic = 'force-dynamic'

import SubTabBar from '@/components/navigation/SubTabBar'
import Link from 'next/link'
import CandidateActionButton from './CandidateActionButton'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { AUTO_EXECUTION_SUBTABS } from '@/lib/nav-groups'
import { readSkillImprovementCandidates, readSkills, readSkillVersions } from '@/lib/skill-store'
import type { ExecutionRun } from '@/types/execution-run'

interface SkillMetrics {
  usage: number
  closeOkRate?: number
  needsFixRate?: number
  failedRate?: number
  lastUsed?: string
}

interface NoSkillCoverageItem {
  targetApp: string
  count: number
}

function fmtDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toISOString().slice(0, 10)
}

function fmtRate(value?: number): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '-'
}

function runTime(run: ExecutionRun): number {
  const value = Date.parse(run.finishedAt || run.startedAt)
  return Number.isFinite(value) ? value : 0
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

function computeMetrics(runs: ExecutionRun[]): Map<string, SkillMetrics> {
  const bySkill = new Map<string, ExecutionRun[]>()
  for (const run of runs) {
    if (!run.skillId) continue
    const list = bySkill.get(run.skillId) ?? []
    list.push(run)
    bySkill.set(run.skillId, list)
  }
  const metrics = new Map<string, SkillMetrics>()
  for (const [skillId, skillRuns] of Array.from(bySkill.entries())) {
    const sorted = [...skillRuns].sort((a, b) => runTime(b) - runTime(a))
    const usage = sorted.length
    metrics.set(skillId, {
      usage,
      closeOkRate: usage > 0 ? sorted.filter((run) => run.reviewStatus === 'reviewed').length / usage : undefined,
      needsFixRate: usage > 0 ? sorted.filter((run) => run.reviewStatus === 'needs_followup').length / usage : undefined,
      failedRate: usage > 0 ? sorted.filter((run) => run.runStatus === 'failed').length / usage : undefined,
      lastUsed: sorted[0]?.finishedAt || sorted[0]?.startedAt,
    })
  }
  return metrics
}

function computeNoSkillCoverage(runs: ExecutionRun[], now = new Date()): { total: number; items: NoSkillCoverageItem[] } {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000
  const byTargetApp = new Map<string, number>()
  for (const run of runs) {
    if (run.skillId) continue
    const time = runTime(run)
    if (time < cutoff) continue
    const targetApp = run.targetApp?.trim() || 'targetApp未設定'
    byTargetApp.set(targetApp, (byTargetApp.get(targetApp) ?? 0) + 1)
  }
  const items = Array.from(byTargetApp.entries())
    .map(([targetApp, count]) => ({ targetApp, count }))
    .sort((a, b) => b.count - a.count || a.targetApp.localeCompare(b.targetApp))
    .slice(0, 8)
  return {
    total: Array.from(byTargetApp.values()).reduce((sum, count) => sum + count, 0),
    items,
  }
}

export default async function SkillsPage() {
  const [skills, runs, candidates, versions] = await Promise.all([
    readSkills(),
    readExecutionRuns(),
    readSkillImprovementCandidates(),
    readSkillVersions(),
  ])
  const metrics = computeMetrics(runs)
  const noSkillCoverage = computeNoSkillCoverage(runs)
  const pendingCandidates = candidates.filter((candidate) => candidate.status === 'pending')
  const sortedVersions = [...versions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return (
    <main className="px-4 pb-6 pt-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skills管理</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">実行手順の品質集計・改善候補・更新履歴</p>
      </header>
      <div className="mb-4">
        <SubTabBar items={AUTO_EXECUTION_SUBTABS} />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Skill一覧</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">name</th>
                <th className="px-3 py-2 text-left">version</th>
                <th className="px-3 py-2 text-left">推奨実行者</th>
                <th className="px-3 py-2 text-left">enabled</th>
                <th className="px-3 py-2 text-left">riskFlags</th>
                <th className="px-3 py-2 text-right">使用回数</th>
                <th className="px-3 py-2 text-right">close_ok率</th>
                <th className="px-3 py-2 text-right">needs_fix率</th>
                <th className="px-3 py-2 text-right">failed率</th>
                <th className="px-3 py-2 text-left">最終使用日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {skills.map((skill) => {
                const m = metrics.get(skill.id)
                return (
                  <tr key={skill.id}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      <Link href={`/skills/${encodeURIComponent(skill.id)}`} className="text-blue-700 hover:underline dark:text-blue-300">
                        {skill.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">v{skill.version}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${executorBadgeClass(skill.preferredExecutor)}`}>
                        {executorLabel(skill.preferredExecutor)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{skill.enabled ? 'true' : 'false'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{skill.riskFlags.length > 0 ? `⚠ ${skill.riskFlags.join(', ')}` : '-'}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{m?.usage ?? 0}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{fmtRate(m?.closeOkRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{fmtRate(m?.needsFixRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{fmtRate(m?.failedRate)}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{fmtDate(m?.lastUsed)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Skillなしで実行された作業</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          {noSkillCoverage.total === 0 ? (
            <p className="text-sm text-gray-500">すべての実行にSkillが適用されています。</p>
          ) : (
            <>
              <div className="mb-2 text-sm text-gray-700 dark:text-gray-300">直近30日: 計{noSkillCoverage.total}件</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2 text-left">targetApp</th>
                      <th className="px-3 py-2 text-right">件数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {noSkillCoverage.items.map((item) => (
                      <tr key={item.targetApp}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{item.targetApp}</td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="mt-3 text-xs text-gray-500">
            件数が多い作業種類は、新しいSkillを追加する候補です（追加は3条件: 選択経路を書ける/実行が集まる/具体的手順を書ける）。
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">改善候補</h2>
        <div className="space-y-2">
          {pendingCandidates.length === 0 && <p className="text-sm text-gray-500">pending候補はありません。</p>}
          {pendingCandidates.map((candidate) => (
            <div key={candidate.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">{candidate.priority}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{candidate.skillId}</span>
                {candidate.riskFlags.length > 0 && <span className="text-xs text-amber-600">⚠ {candidate.riskFlags.join(', ')}</span>}
              </div>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{candidate.reason}</p>
              <p className="mt-1 text-xs text-gray-500">{candidate.suggestedChange}</p>
              <p className="mt-1 text-xs text-gray-400">evidence: {candidate.evidence.join(', ') || '-'}</p>
              <div className="mt-3 flex gap-2">
                <CandidateActionButton candidateId={candidate.id} action="approve">反映する</CandidateActionButton>
                <CandidateActionButton candidateId={candidate.id} action="snooze">あとで</CandidateActionButton>
                <CandidateActionButton candidateId={candidate.id} action="reject">却下</CandidateActionButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">更新履歴</h2>
        <div className="space-y-2">
          {sortedVersions.length === 0 && <p className="text-sm text-gray-500">更新履歴はありません。</p>}
          {sortedVersions.map((version) => (
            <div key={version.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">{version.skillId}</span>
                <span className="text-gray-500">v{version.version}</span>
                <span className="text-xs text-gray-400">{fmtDate(version.createdAt)}</span>
              </div>
              <p className="mt-1 text-gray-700 dark:text-gray-300">{version.changeSummary}</p>
              <p className="mt-1 text-xs text-gray-500">{version.changeReason}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
