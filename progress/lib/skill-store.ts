import { readJson, writeJson } from './store'
import type {
  Skill,
  SkillImprovementCandidate,
  SkillImprovementCandidateStatus,
  SkillVersion,
  SkillsData,
} from './types/skill'
import type { EpicRiskFlag } from './types/operations'

const SKILLS_FILE = 'skills.json'
const VERSIONS_FILE = 'skill-versions.json'
const CANDIDATES_FILE = 'skill-improvement-candidates.json'

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function asRiskFlags(value: unknown): EpicRiskFlag[] {
  return asStringArray(value).filter((v): v is EpicRiskFlag => (
    v === 'billing' ||
    v === 'production_db' ||
    v === 'auth_secret' ||
    v === 'deploy' ||
    v === 'migration' ||
    v === 'destructive' ||
    v === 'external_publish'
  ))
}

function normalizeSkill(raw: unknown): Skill | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const id = typeof obj.id === 'string' ? obj.id : ''
  const name = typeof obj.name === 'string' ? obj.name : ''
  if (!id || !name) return null
  const now = new Date().toISOString()
  return {
    id,
    name,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    promptTemplate: typeof obj.promptTemplate === 'string' ? obj.promptTemplate : undefined,
    procedure: typeof obj.procedure === 'string' ? obj.procedure : undefined,
    preferredExecutor: obj.preferredExecutor === 'claude' || obj.preferredExecutor === 'codex'
      ? obj.preferredExecutor
      : undefined,
    inputs: asStringArray(obj.inputs),
    outputs: asStringArray(obj.outputs),
    riskFlags: asRiskFlags(obj.riskFlags),
    version: typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 1,
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
  }
}

function normalizeSkillVersion(raw: unknown): SkillVersion | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const id = typeof obj.id === 'string' ? obj.id : ''
  const skillId = typeof obj.skillId === 'string' ? obj.skillId : ''
  if (!id || !skillId) return null
  return {
    id,
    skillId,
    version: typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 1,
    promptTemplate: typeof obj.promptTemplate === 'string' ? obj.promptTemplate : undefined,
    procedure: typeof obj.procedure === 'string' ? obj.procedure : undefined,
    changeSummary: typeof obj.changeSummary === 'string' ? obj.changeSummary : '',
    changeReason: typeof obj.changeReason === 'string' ? obj.changeReason : '',
    sourceReviewId: typeof obj.sourceReviewId === 'string' ? obj.sourceReviewId : undefined,
    sourceRunId: typeof obj.sourceRunId === 'string' ? obj.sourceRunId : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
  }
}

export function normalizeSkillImprovementCandidate(raw: unknown): SkillImprovementCandidate | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const id = typeof obj.id === 'string' ? obj.id : ''
  const skillId = typeof obj.skillId === 'string' ? obj.skillId : ''
  if (!id || !skillId) return null
  const status = obj.status === 'approved' || obj.status === 'rejected' || obj.status === 'snoozed' ? obj.status : 'pending'
  const priority = obj.priority === 'P0' || obj.priority === 'P1' ? obj.priority : 'P2'
  return {
    id,
    skillId,
    reason: typeof obj.reason === 'string' ? obj.reason : '',
    evidence: asStringArray(obj.evidence),
    suggestedChange: typeof obj.suggestedChange === 'string' ? obj.suggestedChange : '',
    status,
    priority,
    riskFlags: asRiskFlags(obj.riskFlags),
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
  }
}

export async function readSkillsData(): Promise<SkillsData> {
  const fallback: SkillsData = { skills: [], updatedAt: '' }
  const data = await readJson<SkillsData>(SKILLS_FILE, fallback)
  return {
    skills: Array.isArray(data.skills) ? data.skills.map(normalizeSkill).filter((s): s is Skill => Boolean(s)) : [],
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  }
}

export async function readSkills(): Promise<Skill[]> {
  return (await readSkillsData()).skills
}

export async function writeSkills(skills: Skill[]): Promise<void> {
  await writeJson<SkillsData>(SKILLS_FILE, {
    skills: skills.map((skill) => normalizeSkill(skill)).filter((s): s is Skill => Boolean(s)),
    updatedAt: new Date().toISOString(),
  })
}

export async function getSkill(id: string): Promise<Skill | undefined> {
  return (await readSkills()).find((skill) => skill.id === id)
}

export async function upsertSkill(skill: Skill): Promise<Skill> {
  const skills = await readSkills()
  const normalized = normalizeSkill(skill)
  if (!normalized) throw new Error('invalid skill')
  const idx = skills.findIndex((s) => s.id === normalized.id)
  if (idx === -1) skills.push(normalized)
  else skills[idx] = normalized
  await writeSkills(skills)
  return normalized
}

export async function readSkillVersions(): Promise<SkillVersion[]> {
  const list = await readJson<SkillVersion[]>(VERSIONS_FILE, [])
  return Array.isArray(list) ? list.map(normalizeSkillVersion).filter((v): v is SkillVersion => Boolean(v)) : []
}

export async function appendSkillVersion(version: SkillVersion): Promise<SkillVersion> {
  const normalized = normalizeSkillVersion(version)
  if (!normalized) throw new Error('invalid skill version')
  const versions = await readSkillVersions()
  versions.push(normalized)
  await writeJson<SkillVersion[]>(VERSIONS_FILE, versions)
  return normalized
}

export async function readSkillImprovementCandidates(): Promise<SkillImprovementCandidate[]> {
  const list = await readJson<SkillImprovementCandidate[]>(CANDIDATES_FILE, [])
  return Array.isArray(list)
    ? list.map(normalizeSkillImprovementCandidate).filter((c): c is SkillImprovementCandidate => Boolean(c))
    : []
}

export async function writeSkillImprovementCandidates(candidates: SkillImprovementCandidate[]): Promise<void> {
  await writeJson<SkillImprovementCandidate[]>(CANDIDATES_FILE, candidates)
}

export async function updateSkillImprovementCandidateStatus(
  id: string,
  status: SkillImprovementCandidateStatus,
): Promise<SkillImprovementCandidate | null> {
  const candidates = await readSkillImprovementCandidates()
  const idx = candidates.findIndex((candidate) => candidate.id === id)
  if (idx === -1) return null
  candidates[idx] = { ...candidates[idx], status }
  await writeSkillImprovementCandidates(candidates)
  return candidates[idx]
}
