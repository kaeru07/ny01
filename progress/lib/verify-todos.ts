import { readJson, writeJson } from '@/lib/store'
import { normalizeUrlString } from '@/lib/url-normalize'

// ─────────────────────────────────────────────────────────────
// 動作確認Todo（人間が確認すべき画面・URL・手順の一元管理）
//
// Claude Code / Codex が日々の作業や Epic 完了後に「人間がこの画面を開いて
// この手順で確認してほしい」という確認項目をここへ登録する。人間は未確認 →
// 確認済 / NG / 保留 で状態を更新し、アプリ・Epic・状態で絞り込んで消化する。
// app-urls.json（URL 台帳）とは別物で、こちらは「確認手順と期待結果を持つ
// チェックリスト」を扱う。
// ─────────────────────────────────────────────────────────────

export type VerifyTodoStatus = 'unconfirmed' | 'confirmed' | 'ng' | 'pending'

export interface VerifyTodo {
  id: string
  appName: string
  epicName: string
  url: string
  steps: string
  expectedResult: string
  status: VerifyTodoStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface VerifyTodoRegistry {
  updatedAt: string
  operationMemo: string
  todos: VerifyTodo[]
}

export const VERIFY_TODO_STATUSES: VerifyTodoStatus[] = ['unconfirmed', 'confirmed', 'ng', 'pending']

const EMPTY_REGISTRY: VerifyTodoRegistry = {
  updatedAt: '',
  operationMemo:
    'Claude Code / Codex が作業完了時や Epic 完了後に「人間が確認すべき画面・URL・手順」をここへ登録する。' +
    '人間は確認URLを開き、確認手順に沿って操作し、期待結果と一致すれば「確認済」、ずれていれば「NG」、後回しなら「保留」に更新する。' +
    'iPhone から押せる公開URL（Vercel / 公開VPS）を登録すること。localhost / 内部ポートは iPhone から直接開けない点に注意。',
  todos: [],
}

export async function readVerifyTodos(): Promise<VerifyTodoRegistry> {
  const reg = await readJson<VerifyTodoRegistry>('verify-todos.json', EMPTY_REGISTRY)
  return { ...EMPTY_REGISTRY, ...reg, todos: Array.isArray(reg.todos) ? reg.todos : [] }
}

export async function writeVerifyTodos(registry: VerifyTodoRegistry): Promise<void> {
  await writeJson<VerifyTodoRegistry>('verify-todos.json', registry)
}

function nowIso(): string {
  return new Date().toISOString()
}

function isValidStatus(value: unknown): value is VerifyTodoStatus {
  return typeof value === 'string' && VERIFY_TODO_STATUSES.includes(value as VerifyTodoStatus)
}

function genId(): string {
  return `vt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface VerifyTodoInput {
  appName?: string
  epicName?: string
  url?: string
  steps?: string
  expectedResult?: string
  status?: VerifyTodoStatus
  notes?: string
}

// 入力を 1 件の VerifyTodo に正規化する。url は normalizeUrlString で https 補完。
// 不正な status は安全側で 'unconfirmed' にフォールバックする。
export function normalizeTodoInput(input: VerifyTodoInput): Omit<VerifyTodo, 'id' | 'createdAt' | 'updatedAt'> {
  const rawUrl = (input.url ?? '').trim()
  return {
    appName: (input.appName ?? '').trim(),
    epicName: (input.epicName ?? '').trim(),
    url: rawUrl ? normalizeUrlString(rawUrl) : '',
    steps: (input.steps ?? '').trim(),
    expectedResult: (input.expectedResult ?? '').trim(),
    status: isValidStatus(input.status) ? input.status : 'unconfirmed',
    notes: (input.notes ?? '').trim(),
  }
}

// 新規 Todo を追加し、更新後の registry を返す。
export function addTodo(registry: VerifyTodoRegistry, input: VerifyTodoInput): { registry: VerifyTodoRegistry; todo: VerifyTodo } {
  const base = normalizeTodoInput(input)
  const ts = nowIso()
  const todo: VerifyTodo = { id: genId(), createdAt: ts, updatedAt: ts, ...base }
  const next: VerifyTodoRegistry = {
    ...registry,
    todos: [todo, ...registry.todos],
    updatedAt: ts,
  }
  return { registry: next, todo }
}

// 既存 Todo を部分更新する。見つからなければ null。
export function updateTodo(
  registry: VerifyTodoRegistry,
  id: string,
  patch: VerifyTodoInput,
): { registry: VerifyTodoRegistry; todo: VerifyTodo } | null {
  const idx = registry.todos.findIndex((t) => t.id === id)
  if (idx === -1) return null
  const prev = registry.todos[idx]
  const ts = nowIso()
  const next: VerifyTodo = {
    ...prev,
    ...(patch.appName !== undefined ? { appName: patch.appName.trim() } : {}),
    ...(patch.epicName !== undefined ? { epicName: patch.epicName.trim() } : {}),
    ...(patch.url !== undefined ? { url: patch.url.trim() ? normalizeUrlString(patch.url.trim()) : '' } : {}),
    ...(patch.steps !== undefined ? { steps: patch.steps.trim() } : {}),
    ...(patch.expectedResult !== undefined ? { expectedResult: patch.expectedResult.trim() } : {}),
    ...(patch.status !== undefined && isValidStatus(patch.status) ? { status: patch.status } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
    updatedAt: ts,
  }
  const todos = [...registry.todos]
  todos[idx] = next
  return { registry: { ...registry, todos, updatedAt: ts }, todo: next }
}

// Todo を削除する。削除した場合 true。
export function deleteTodo(registry: VerifyTodoRegistry, id: string): { registry: VerifyTodoRegistry; removed: boolean } {
  const todos = registry.todos.filter((t) => t.id !== id)
  if (todos.length === registry.todos.length) return { registry, removed: false }
  return { registry: { ...registry, todos, updatedAt: nowIso() }, removed: true }
}
