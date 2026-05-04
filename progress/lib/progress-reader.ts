import fs from 'fs/promises'
import path from 'path'
import type { AppProgress, ProjectTasksData, WorkLogEntry } from '@/types/progress'

export function getDataPath(): string {
  return process.env.PROGRESS_DATA_PATH ?? path.join(process.cwd(), 'data/sample')
}

export async function readAppProgress(): Promise<AppProgress> {
  try {
    const filePath = path.join(getDataPath(), 'app-progress.json')
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as AppProgress
  } catch {
    return { projects: [] }
  }
}

export async function readProjectTasks(): Promise<ProjectTasksData> {
  try {
    const filePath = path.join(getDataPath(), 'project-tasks.json')
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as ProjectTasksData
  } catch {
    return { projects: [] }
  }
}

export async function readWorkLog(limit?: number): Promise<WorkLogEntry[]> {
  const filePath = path.join(getDataPath(), 'work-log.ndjson')
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const entries = lines.map((line) => JSON.parse(line) as WorkLogEntry)
    entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    return limit !== undefined ? entries.slice(0, limit) : entries
  } catch {
    return []
  }
}

export async function readOverallProgress(): Promise<string> {
  const filePath = path.join(getDataPath(), 'overall-progress.md')
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}
