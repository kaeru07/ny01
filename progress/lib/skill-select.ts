import { readSkills } from './skill-store'
import type { Skill } from './types/skill'

export interface SkillSelectableEpic {
  epicId: string
  skillId?: string
  targetApp?: string
  targetApps?: string[]
  goalId?: string
  title?: string
  goal?: string
}

function includesProgress(epic: SkillSelectableEpic): boolean {
  const values = [epic.targetApp, ...(epic.targetApps ?? [])]
  // progress改善ゴールは company-mgmt プロジェクト配下が実態（targetApp未設定も多い）。
  // targetApp が progress / company-mgmt、または targetApp未設定の goalstep Epic は progress作業とみなす。
  if (values.some((value) => {
    const v = value?.toLowerCase()
    return v === 'progress' || v === 'company-mgmt'
  })) return true
  const noTarget = values.every((value) => !value)
  return noTarget && epic.epicId.startsWith('epic-goalstep-')
}

function isResearchEpic(epic: SkillSelectableEpic): boolean {
  const text = `${epic.title ?? ''} ${epic.goal ?? ''}`.toLowerCase()
  return text.includes('research') || text.includes('調査')
}

export async function selectSkillForEpic(
  epic: SkillSelectableEpic,
): Promise<{ skill: Skill; version: number } | null> {
  try {
    const skills = await readSkills()
    const enabled = new Map(skills.filter((skill) => skill.enabled).map((skill) => [skill.id, skill]))
    const selectedId =
      epic.skillId && enabled.has(epic.skillId)
        ? epic.skillId
        : epic.goalId?.startsWith('goal-app-')
          ? 'skill-store-app-scaffold'
          : includesProgress(epic)
            ? 'skill-progress-feature'
            : isResearchEpic(epic)
              ? 'skill-research-ingest'
              : undefined
    if (!selectedId) return null
    const skill = enabled.get(selectedId)
    return skill ? { skill, version: skill.version } : null
  } catch {
    return null
  }
}

export function skillPromptBlock(selection: { skill: Skill; version: number } | null): string[] {
  if (!selection) return []
  const { skill, version } = selection
  const body: string[] = []
  if (skill.procedure?.trim()) body.push(skill.procedure.trim())
  if (skill.promptTemplate?.trim()) body.push(skill.promptTemplate.trim())
  if (body.length === 0) return []
  return [`## 実行手順（Skill: ${skill.name} v${version}）`, body.join('\n\n')]
}
