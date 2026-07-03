import { NextResponse } from 'next/server'
import { getAppProposals } from '@/lib/app-proposals'
import { ensureAppWorkspace } from '@/lib/app-workspace'

export async function POST() {
  const results: Array<{ projectId: string; created: boolean; path: string }> = []
  const errors: string[] = []

  try {
    const proposals = await getAppProposals()
    const approved = proposals.filter((proposal) => proposal.decision === 'approved' && proposal.projectId)

    for (const proposal of approved) {
      const projectId = proposal.projectId
      if (!projectId) continue
      try {
        const workspace = await ensureAppWorkspace(projectId, proposal.name)
        if (!workspace) {
          errors.push(`workspace create skipped: invalid projectId ${projectId}`)
          continue
        }
        results.push({ projectId, created: workspace.created, path: workspace.path })
      } catch (error) {
        errors.push(`workspace create failed (${projectId}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return NextResponse.json({ success: errors.length === 0, results, errors })
  } catch (error) {
    return NextResponse.json(
      { success: false, results, errors: [error instanceof Error ? error.message : 'failed to ensure workspaces'] },
      { status: 500 },
    )
  }
}
