import type { EpicRiskFlag } from '@/lib/types/operations'

export interface Skill {
  id: string
  name: string
  description?: string
  promptTemplate?: string
  procedure?: string
  inputs: string[]
  outputs: string[]
  riskFlags: EpicRiskFlag[]
  version: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillVersion {
  id: string
  skillId: string
  version: number
  promptTemplate?: string
  procedure?: string
  changeSummary: string
  changeReason: string
  sourceReviewId?: string
  sourceRunId?: string
  createdAt: string
}

export type SkillImprovementCandidateStatus = 'pending' | 'approved' | 'rejected' | 'snoozed'
export type SkillImprovementPriority = 'P0' | 'P1' | 'P2'

export interface SkillImprovementCandidate {
  id: string
  skillId: string
  reason: string
  evidence: string[]
  suggestedChange: string
  status: SkillImprovementCandidateStatus
  priority: SkillImprovementPriority
  riskFlags: EpicRiskFlag[]
  createdAt: string
}

export interface SkillsData {
  skills: Skill[]
  updatedAt: string
}
