export const dynamic = 'force-dynamic'

import ProjectGoalsView from '@/components/projects/ProjectGoalsView'

export default async function ProjectGoalsPage() {
  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      <ProjectGoalsView />
    </div>
  )
}
