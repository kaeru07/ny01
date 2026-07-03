import type { ExecutionRun } from '@/types/execution-run'
import type { Skill, SkillImprovementCandidate } from './types/skill'

const DAY_MS = 24 * 60 * 60 * 1000

export interface SkillMaintenanceInput {
  skills: Skill[]
  runs: ExecutionRun[]
  existingCandidates: SkillImprovementCandidate[]
  now?: Date
}

function runTime(run: ExecutionRun): number {
  const value = Date.parse(run.finishedAt || run.startedAt)
  return Number.isFinite(value) ? value : 0
}

function candidateId(skillId: string, rule: string, now: Date): string {
  return `skillcand-${now.toISOString().slice(0, 10)}-${skillId}-${rule}`
}

export function buildSkillMaintenanceCandidates(input: SkillMaintenanceInput): SkillImprovementCandidate[] {
  const now = input.now ?? new Date()
  const pendingExisting = input.existingCandidates.filter((candidate) => candidate.status === 'pending')
  if (pendingExisting.length >= 3) return []
  const pendingSkillIds = new Set(pendingExisting.map((candidate) => candidate.skillId))
  const existingIds = new Set(input.existingCandidates.map((candidate) => candidate.id))
  const since7Days = now.getTime() - 7 * DAY_MS
  const since30Days = now.getTime() - 30 * DAY_MS
  const recentRuns = input.runs.filter((run) => run.skillId && runTime(run) >= since7Days && runTime(run) <= now.getTime())
  const bySkill = new Map<string, ExecutionRun[]>()
  for (const run of recentRuns) {
    if (!run.skillId) continue
    const list = bySkill.get(run.skillId) ?? []
    list.push(run)
    bySkill.set(run.skillId, list)
  }

  const results: SkillImprovementCandidate[] = []
  function add(candidate: SkillImprovementCandidate) {
    if (results.length >= 3) return
    if (pendingSkillIds.has(candidate.skillId)) return
    if (existingIds.has(candidate.id)) return
    results.push(candidate)
    pendingSkillIds.add(candidate.skillId)
  }

  for (const skill of input.skills) {
    const runs = (bySkill.get(skill.id) ?? []).sort((a, b) => runTime(b) - runTime(a))
    const failed = runs.filter((run) => run.runStatus === 'failed')
    if (runs.length >= 3 && failed.length / runs.length >= 0.3) {
      add({
        id: candidateId(skill.id, 'failed-rate', now),
        skillId: skill.id,
        reason: `直近7日のfailed率が${Math.round((failed.length / runs.length) * 100)}%です（母数${runs.length}件）。`,
        evidence: failed.map((run) => run.runId).slice(0, 5),
        suggestedChange: '手順のどこが失敗源か点検し、事前確認と失敗時の切り分け条件を明確化する',
        status: 'pending',
        priority: failed.length / runs.length >= 0.5 ? 'P0' : 'P1',
        riskFlags: skill.riskFlags,
        createdAt: now.toISOString(),
      })
      continue
    }

    const latest3 = runs.slice(0, 3)
    if (latest3.length === 3 && latest3.every((run) => run.reviewStatus === 'needs_followup')) {
      add({
        id: candidateId(skill.id, 'needs-followup-3', now),
        skillId: skill.id,
        reason: 'needs_followup が直近3run連続しています。',
        evidence: latest3.map((run) => run.runId),
        suggestedChange: '手順のレビュー観点を点検し、完了条件と修正依頼を受けやすい箇所を明確化する',
        status: 'pending',
        priority: 'P1',
        riskFlags: skill.riskFlags,
        createdAt: now.toISOString(),
      })
      continue
    }

    const allSkillRuns = input.runs.filter((run) => run.skillId === skill.id).sort((a, b) => runTime(b) - runTime(a))
    const lastUsed = allSkillRuns[0]
    // 作成から30日未満のSkillは「未使用」扱いにしない（作成当日に未使用候補が立つ誤判定防止）。
    const skillAgedOver30d = Date.parse(skill.createdAt || '') < since30Days
    if (skill.enabled && skillAgedOver30d && (!lastUsed || runTime(lastUsed) < since30Days)) {
      add({
        id: candidateId(skill.id, 'unused-30d', now),
        skillId: skill.id,
        reason: 'enabled Skill が30日以上使用されていません。',
        evidence: lastUsed ? [lastUsed.runId] : [],
        suggestedChange: 'このSkillが現在の実行導線に紐付くべきか点検し、使う条件または不要理由を明確化する',
        status: 'pending',
        priority: 'P2',
        riskFlags: skill.riskFlags,
        createdAt: now.toISOString(),
      })
    }
  }

  return results.slice(0, Math.max(0, 3 - pendingExisting.length))
}

export async function runSkillMaintenance(): Promise<{ candidates: number }> {
  const [
    { appendAutomationLog },
    { readExecutionRuns },
    { readSkillImprovementCandidates, readSkills, writeSkillImprovementCandidates },
  ] = await Promise.all([
    import('./operations-store'),
    import('./execution-run-reader'),
    import('./skill-store'),
  ])
  const [skills, runs, existingCandidates] = await Promise.all([
    readSkills(),
    readExecutionRuns(),
    readSkillImprovementCandidates(),
  ])
  const generated = buildSkillMaintenanceCandidates({ skills, runs, existingCandidates })
  if (generated.length > 0) {
    await writeSkillImprovementCandidates([...existingCandidates, ...generated])
  }
  await appendAutomationLog({ event: 'skill_maintenance', fallbackReason: `candidates=${generated.length}` })
  return { candidates: generated.length }
}
