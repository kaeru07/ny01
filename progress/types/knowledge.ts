export interface KnowledgeRecord {
  id: string
  sourceRunId: string
  sourceEpicId?: string
  goalId?: string
  title: string
  summary: string
  learnings: string[]
  nextActions: string[]
  changedFiles: string[]
  vaultReviewPath: string
  researchPath: string
  decisionLogPath: string
  nextEpicCandidateId?: string
  createdAt: string
  updatedAt: string
}

export interface KnowledgeLoopResult {
  knowledge: KnowledgeRecord
  recommendationId: string
  createdKnowledge: boolean
  createdRecommendation: boolean
}
