import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import { readWorkCandidates, readWorkQueue, readWorkSession, calcCandidateScore, sortedQueueItems } from '@/lib/session-reader'
import { readProjectTasks, readAppProgress } from '@/lib/progress-reader'
import { updateTaskStatus } from '@/lib/progress-writer'
import type {
  WorkCandidate,
  WorkCandidateStatus,
  WorkQueueItem,
  WorkItemStatus,
  WorkSession,
} from '@/types/session'

async function writeWorkCandidates(data: { candidates: WorkCandidate[]; lastRefreshed: string }): Promise<void> {
  await fs.writeFile(path.join(getDataPath(), 'work-candidates.json'), JSON.stringify(data, null, 2), 'utf-8')
}

async function writeWorkQueue(data: { items: WorkQueueItem[]; lastGenerated: string }): Promise<void> {
  await fs.writeFile(path.join(getDataPath(), 'work-queue.json'), JSON.stringify(data, null, 2), 'utf-8')
}

async function writeWorkSession(data: WorkSession): Promise<void> {
  await fs.writeFile(path.join(getDataPath(), 'today-session.json'), JSON.stringify(data, null, 2), 'utf-8')
}

// project-tasks.json から Claude 担当の open タスクを候補として追加する
export async function refreshCandidates(): Promise<{ added: number }> {
  const [tasksData, progressData, candidatesData] = await Promise.all([
    readProjectTasks(),
    readAppProgress(),
    readWorkCandidates(),
  ])

  const OPEN_STATUSES = ['backlog', 'todo', 'in_progress', 'impl_done', 'local_done']
  const projectNameMap = Object.fromEntries(progressData.projects.map((p) => [p.id, p.name]))
  const excludedSet = new Set(progressData.projects.filter((p) => p.excluded).map((p) => p.id))

  // 既存候補の projectId+taskId セット（rejected 以外）
  const existing = new Set(
    candidatesData.candidates
      .filter((c) => c.status !== 'rejected')
      .map((c) => `${c.projectId}::${c.taskId}`)
  )

  const now = new Date().toISOString()
  let added = 0
  const newCandidates: WorkCandidate[] = []

  for (const pt of tasksData.projects) {
    if (excludedSet.has(pt.projectId)) continue
    for (const task of pt.tasks) {
      const isOpen = OPEN_STATUSES.includes(task.status)
      const assignee = task.assignee ?? 'claude'
      const isClaude = assignee === 'claude' || assignee === 'both'
      const executorAllowed =
        isClaude ||
        task.preferredExecutor === 'codex' ||
        task.fallbackExecutor === 'codex' ||
        task.canRunOnCodex === true
      const key = `${pt.projectId}::${task.id}`

      if (!isOpen || !executorAllowed || existing.has(key)) continue

      const priority = task.priority ?? 'medium'
      const effort = 'medium'
      const autoScore = calcCandidateScore(priority, effort)
      const projectName = projectNameMap[pt.projectId] ?? pt.projectId

      newCandidates.push({
        id: `cand-${pt.projectId}-${task.id}-${Date.now()}-${added}`,
        projectId: pt.projectId,
        projectName,
        taskId: task.id,
        taskTitle: task.title,
        description: task.memo || task.title,
        priority,
        preferredExecutor: task.preferredExecutor,
        fallbackExecutor: task.fallbackExecutor,
        autoFallback: task.autoFallback,
        canRunOnCodex: task.canRunOnCodex,
        requiresClaude: task.requiresClaude,
        estimatedEffort: effort,
        reason: `${task.status === 'in_progress' ? '進行中のタスク' : 'TODO タスク'}（assignee: ${assignee}・preferredExecutor: ${task.preferredExecutor ?? 'claude'}・priority: ${priority}）`,
        prerequisites: '',
        risks: '',
        doneCondition: task.memo || '完了条件を確認してください',
        status: 'pending_decision',
        userMemo: '',
        autoScore,
        createdAt: now,
        updatedAt: now,
      })
      added++
    }
  }

  const updated = {
    candidates: [...candidatesData.candidates, ...newCandidates],
    lastRefreshed: now,
  }
  await writeWorkCandidates(updated)
  return { added }
}

// 候補のステータスを更新する
export async function updateCandidateStatus(
  id: string,
  status: WorkCandidateStatus,
  memo?: string
): Promise<WorkCandidate> {
  const data = await readWorkCandidates()
  const candidate = data.candidates.find((c) => c.id === id)
  if (!candidate) throw new Error(`Candidate not found: ${id}`)

  candidate.status = status
  if (memo !== undefined) candidate.userMemo = memo
  candidate.updatedAt = new Date().toISOString()

  await writeWorkCandidates(data)

  if (status === 'approved') {
    await addCandidateToQueue(candidate)
  }

  return candidate
}

// approved 候補をキューに追加する
async function addCandidateToQueue(candidate: WorkCandidate): Promise<void> {
  const queueData = await readWorkQueue()

  // 既にキューにある場合はスキップ
  if (queueData.items.some((i) => i.candidateId === candidate.id)) return

  const maxOrder = queueData.items.reduce((max, i) => Math.max(max, i.autoOrder), 0)
  const now = new Date().toISOString()

  const item: WorkQueueItem = {
    id: `queue-${candidate.id}-${Date.now()}`,
    candidateId: candidate.id,
    projectId: candidate.projectId,
    projectName: candidate.projectName,
    taskId: candidate.taskId,
    taskTitle: candidate.taskTitle,
    description: candidate.description,
    priority: candidate.priority,
    preferredExecutor: candidate.preferredExecutor,
    fallbackExecutor: candidate.fallbackExecutor,
    autoFallback: candidate.autoFallback,
    canRunOnCodex: candidate.canRunOnCodex,
    requiresClaude: candidate.requiresClaude,
    status: 'queued',
    autoOrder: maxOrder + 1,
    reason: candidate.reason,
    doneCondition: candidate.doneCondition,
    userMemo: '',
    workLog: '',
    createdAt: now,
    updatedAt: now,
  }

  queueData.items.push(item)
  queueData.lastGenerated = queueData.lastGenerated || now
  await writeWorkQueue(queueData)
}

// キューアイテムのフィールドを更新する
export async function updateQueueItem(
  id: string,
  updates: Partial<Pick<WorkQueueItem, 'status' | 'userMemo' | 'workLog' | 'taskPrompt' | 'startedAt' | 'completedAt'>>
): Promise<WorkQueueItem> {
  const data = await readWorkQueue()
  const item = data.items.find((i) => i.id === id)
  if (!item) throw new Error(`Queue item not found: ${id}`)

  Object.assign(item, updates, { updatedAt: new Date().toISOString() })

  if (updates.status === 'in_progress' && !item.startedAt) {
    item.startedAt = new Date().toISOString()
  }
  if (updates.status === 'done' && !item.completedAt) {
    item.completedAt = new Date().toISOString()
  }

  await writeWorkQueue(data)
  return item
}

// 指定 ID リストの順番でキューを並び替える（manualOrder として保存）
export async function reorderQueue(orderedIds: string[], updatedBy: 'user' | 'system' = 'user'): Promise<WorkQueueItem[]> {
  const data = await readWorkQueue()
  const now = new Date().toISOString()

  orderedIds.forEach((id, index) => {
    const item = data.items.find((i) => i.id === id)
    if (!item) return
    item.manualOrder = index + 1
    item.orderUpdatedBy = updatedBy
    item.orderUpdatedAt = now
    item.updatedAt = now
  })

  await writeWorkQueue(data)
  return sortedQueueItems(data.items)
}

// autoOrder のみ再計算する（manualOrder は維持）
export async function regenerateAutoOrder(): Promise<WorkQueueItem[]> {
  const data = await readWorkQueue()
  const PRIORITY_SCORE: Record<string, number> = { high: 30, medium: 20, low: 10 }
  const STATUS_BONUS: Record<string, number> = { in_progress: 10, queued: 0, blocked: -20, skipped: -30, done: -50 }

  const scored = data.items.map((item) => ({
    item,
    score: (PRIORITY_SCORE[item.priority] ?? 10) + (STATUS_BONUS[item.status] ?? 0),
  }))
  scored.sort((a, b) => b.score - a.score)

  const now = new Date().toISOString()
  scored.forEach(({ item }, index) => {
    item.autoOrder = index + 1
    item.updatedAt = now
  })
  data.lastGenerated = now

  await writeWorkQueue(data)
  return sortedQueueItems(data.items)
}

// manualOrder を全リセットして完全再生成
export async function fullResetQueueOrder(): Promise<WorkQueueItem[]> {
  const data = await readWorkQueue()
  data.items.forEach((item) => {
    delete item.manualOrder
    delete item.orderUpdatedBy
    delete item.orderUpdatedAt
    delete item.orderMemo
  })
  await writeWorkQueue(data)
  return regenerateAutoOrder()
}

// アイテムをキューから削除する
export async function removeFromQueue(id: string): Promise<void> {
  const data = await readWorkQueue()
  data.items = data.items.filter((i) => i.id !== id)
  await writeWorkQueue(data)
}

// 複数候補を一括で approved にする
export async function bulkApprove(ids: string[]): Promise<{ approved: number }> {
  const data = await readWorkCandidates()
  const now = new Date().toISOString()
  let approved = 0

  const toApprove: WorkCandidate[] = []
  for (const c of data.candidates) {
    if (ids.includes(c.id) && c.status === 'pending_decision') {
      c.status = 'approved'
      c.updatedAt = now
      toApprove.push(c)
      approved++
    }
  }
  await writeWorkCandidates(data)

  for (const c of toApprove) {
    await addCandidateToQueue(c)
  }

  return { approved }
}

// タスクをキューに直接追加する（candidates を経由しない）
export async function addTaskDirectlyToQueue(projectId: string, taskId: string): Promise<{ added: boolean }> {
  const [tasksData, progressData, queueData] = await Promise.all([
    readProjectTasks(),
    readAppProgress(),
    readWorkQueue(),
  ])

  const projectTasks = tasksData.projects.find((p) => p.projectId === projectId)
  const task = projectTasks?.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)
  if (task.status === 'blocked') throw new Error('BLOCKED')

  const alreadyQueued = queueData.items.some(
    (i) => i.taskId === taskId && i.status !== 'done' && i.status !== 'skipped'
  )
  if (alreadyQueued) {
    if (task.status === 'pending_approval') {
      await updateTaskStatus(projectId, taskId, 'todo')
    }
    return { added: false }
  }

  const project = progressData.projects.find((p) => p.id === projectId)
  const projectName = project?.name ?? projectId
  const maxOrder = queueData.items.reduce((max, i) => Math.max(max, i.autoOrder), 0)
  const now = new Date().toISOString()

  const item: WorkQueueItem = {
    id: `queue-${projectId}-${taskId}-${Date.now()}`,
    candidateId: '',
    projectId,
    projectName,
    taskId,
    taskTitle: task.title,
    description: task.memo || task.title,
    priority: task.priority,
    preferredExecutor: task.preferredExecutor,
    fallbackExecutor: task.fallbackExecutor,
    autoFallback: task.autoFallback,
    canRunOnCodex: task.canRunOnCodex,
    requiresClaude: task.requiresClaude,
    status: 'queued',
    autoOrder: maxOrder + 1,
    reason: 'ToDo管理から直接追加',
    doneCondition: task.memo || '完了条件を確認してください',
    userMemo: '',
    workLog: '',
    taskPrompt: task.taskPrompt,
    createdAt: now,
    updatedAt: now,
  }

  queueData.items.push(item)
  queueData.lastGenerated = queueData.lastGenerated || now
  await writeWorkQueue(queueData)
  if (task.status === 'pending_approval') {
    await updateTaskStatus(projectId, taskId, 'todo')
  }
  return { added: true }
}

// セッションを更新する
export async function updateSession(updates: Partial<WorkSession>): Promise<WorkSession> {
  const session = await readWorkSession()
  Object.assign(session, updates, { updatedAt: new Date().toISOString() })
  await writeWorkSession(session)
  return session
}

// 1アイテムの順番を1つ上に移動する
export async function moveQueueItem(id: string, direction: 'up' | 'down' | 'top' | 'bottom'): Promise<WorkQueueItem[]> {
  const data = await readWorkQueue()
  const sorted = sortedQueueItems(data.items)
  const idx = sorted.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error(`Queue item not found: ${id}`)

  const swapWith = direction === 'up' ? idx - 1 : direction === 'down' ? idx + 1 : -1

  if (direction === 'top' || direction === 'bottom') {
    const ids = sorted.map((i) => i.id)
    ids.splice(idx, 1)
    if (direction === 'top') ids.unshift(id)
    else ids.push(id)
    return reorderQueue(ids)
  }

  if (swapWith < 0 || swapWith >= sorted.length) return sorted

  const ids = sorted.map((i) => i.id)
  ;[ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]]
  return reorderQueue(ids)
}
