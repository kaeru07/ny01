export interface IosLocalGit {
  head: string | null
  lastCommitAt: string | null
  subject: string | null
  originUrl?: string | null
}

export interface IosDiscoveredApp {
  dir: string
  appDir: string
  appName: string
  bundleId: string | null
  repository: string | null
  branch: string | null
  workflowId: string | null
  version: string | null
  buildNumber: string | null
  localGit: IosLocalGit
}

export interface IosCodemagicBuild {
  buildId: string | null
  status: string | null
  workflowId: string | null
  branch: string | null
  startedAt: string | null
  finishedAt: string | null
  commitHash: string | null
}

export interface IosUnshippedCommit {
  subject: string
  committedAt: string | null
}

export interface IosUnshippedCommits {
  total: number
  commits: IosUnshippedCommit[]
  baseFinishedAt: string | null
  baseSubject: string | null
}

export interface IosCandidate {
  isCandidate: boolean
  reason?: string
}

export interface IosTestflightBuild {
  version: string | null
  processingState: string | null
  uploadedDate: string | null
}

export type IosTestflightState =
  | { available: true; builds: IosTestflightBuild[]; error?: string }
  | { available: false; reason: string; error?: string }

export interface IosBuildsAppResponse {
  dir: string
  appName: string
  bundleId: string | null
  repository: string | null
  branch: string | null
  workflowId: string | null
  localGit: Pick<IosLocalGit, 'head' | 'lastCommitAt' | 'subject'>
  codemagicAppId: string | null
  builds: IosCodemagicBuild[]
  unshippedCommits: IosUnshippedCommits | null
  testflight: IosTestflightState
  candidate: IosCandidate
  codemagicError?: string
}

export interface IosBuildsResponse {
  success: boolean
  generatedAt: string
  codemagicReady: boolean
  ascReady: boolean
  codemagicError?: string
  apps: IosBuildsAppResponse[]
}
