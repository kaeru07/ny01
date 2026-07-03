import { appendSkillVersion, getSkill, readSkillImprovementCandidates, upsertSkill, writeSkillImprovementCandidates } from '@/lib/skill-store'

export async function applySkillImprovement(candidateId: string): Promise<{ applied: boolean; reason: string }> {
  const candidates = await readSkillImprovementCandidates()
  const idx = candidates.findIndex((candidate) => candidate.id === candidateId)
  if (idx === -1) return { applied: false, reason: 'candidate_not_found' }
  const candidate = candidates[idx]
  const skill = await getSkill(candidate.skillId)
  if (!skill) return { applied: false, reason: 'skill_not_found' }

  const now = new Date()
  const nextVersion = skill.version + 1
  await appendSkillVersion({
    id: `skillver-${skill.id}-v${nextVersion}-${now.getTime()}`,
    skillId: skill.id,
    version: nextVersion,
    promptTemplate: skill.promptTemplate,
    procedure: skill.procedure,
    changeSummary: candidate.suggestedChange,
    changeReason: candidate.reason,
    sourceRunId: candidate.evidence[0],
    createdAt: now.toISOString(),
  })

  const note = `[改善v${nextVersion} ${now.toISOString().slice(0, 10)}] ${candidate.suggestedChange}`
  await upsertSkill({
    ...skill,
    version: nextVersion,
    procedure: skill.procedure ? `${skill.procedure}\n${note}` : note,
    updatedAt: now.toISOString(),
  })

  candidates[idx] = { ...candidate, status: 'approved' }
  await writeSkillImprovementCandidates(candidates)
  return { applied: true, reason: 'approved' }
}
