import type { Project } from '@/types/progress'
import ProjectCard from '@/components/projects/ProjectCard'

interface ProjectCardsProps {
  projects: Project[]
  taskCounts?: Record<string, number>
  title?: string
}

export default function ProjectCards({ projects, taskCounts, title = '案件' }: ProjectCardsProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{title}</h2>
      <div className="space-y-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            taskCount={taskCounts?.[project.id]}
          />
        ))}
      </div>
    </section>
  )
}
