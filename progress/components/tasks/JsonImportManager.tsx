'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { TaskStatus, TaskPriority } from '@/types/progress'
import { copyTextToClipboard } from '@/lib/clipboard'

const VALID_STATUSES: TaskStatus[] = ['pending_approval', 'backlog', 'todo', 'in_progress', 'impl_done', 'local_done', 'done', 'blocked']
const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']

const JSON_PROMPT = `以下の内容から、AICOMPANY補助アプリに取り込むToDo JSONを作成してください。

出力はJSONのみ。
説明文やMarkdownは不要です。

形式:
{
  "todos": [
    {
      "phaseId": "",
      "title": "",
      "priority": "high | medium | low",
      "status": "pending | active | done | skipped",
      "nextAction": "",
      "dueHint": "",
      "taskPrompt": "",
      "doneCriteria": [],
      "memo": ""
    }
  ]
}

ルール:
- titleは必須
- priorityは high / medium / low のいずれか
- statusは pending / active / done / skipped のいずれか（デフォルト: pending）
- taskPromptにはClaude Codeにどう進めてほしいかを書く（300〜800文字目安）
  - taskPromptには「何を直すか / 変更範囲 / 禁止事項 / 検証条件」を含める
  - 完了時に /api/execution-runs へPOSTすることも明記する
- workには作業内容を書く
- allowedには変更してよい範囲を書く
- forbiddenには触ってはいけない範囲を書く
- doneCriteriaには完了条件を書く
- 1タスク1目的に分ける
- 大きすぎる作業は複数ToDoに分割する`

const SAMPLE_JSON = `{
  "todos": [
    {
      "title": "iPhone表示でBottomNavが崩れないか確認する",
      "priority": "high",
      "phaseId": "",
      "status": "pending",
      "nextAction": "iPhone幅でBottomNavを確認する",
      "dueHint": "",
      "taskPrompt": "iPhone 375px幅を前提に、BottomNavの表示崩れがないか確認してください。変更範囲はBottomNav.tsxとその直接依存に限定してください。.env・既存データ・外部APIは変更禁止です。npm run build が成功することを確認し、完了後は /api/execution-runs へPOSTしてください。",
      "doneCriteria": [
        "iPhone幅で6タブが見切れない",
        "npm run build が成功する",
        "変更内容を報告する"
      ],
      "memo": "軽微なUI確認タスク"
    }
  ]
}`

interface ParsedItem {
  index: number
  title: string
  priority: TaskPriority
  risk: string
  targetApp: string
  targetPath: string
  status: TaskStatus
  phaseId: string
  nextAction: string
  dueHint: string
  taskPrompt: string
  memo: string
  allowed: string[]
  forbidden: string[]
  doneCriteria: string[]
  blockedReason: string
  unblockAction: string
  nextQuestion: string
  warnings: string[]
  hasError: boolean
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function normalizeItem(raw: Record<string, unknown>, index: number): ParsedItem {
  const warnings: string[] = []

  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const hasError = !title

  let priority: TaskPriority = 'medium'
  if (typeof raw.priority === 'string' && VALID_PRIORITIES.includes(raw.priority as TaskPriority)) {
    priority = raw.priority as TaskPriority
  } else if (raw.priority !== undefined && raw.priority !== '') {
    warnings.push(`priorityをmediumに補正しました (元: ${String(raw.priority)})`)
  }

  const riskRaw = typeof raw.risk === 'string' ? raw.risk.trim() : ''
  let risk = ''
  if (['high', 'medium', 'low'].includes(riskRaw)) {
    risk = riskRaw
  } else if (riskRaw) {
    risk = 'medium'
    warnings.push(`riskをmediumに補正しました (元: ${riskRaw})`)
  }

  const statusRaw = typeof raw.status === 'string' ? raw.status.trim() : ''
  let status: TaskStatus = 'pending_approval'
  if (statusRaw === 'pending' || statusRaw === '' || statusRaw === undefined) {
    status = 'pending_approval'
  } else if (VALID_STATUSES.includes(statusRaw as TaskStatus)) {
    if (statusRaw === 'in_progress' || statusRaw === 'todo') {
      status = 'pending_approval'
      warnings.push(`statusをpending_approvalに補正しました (元: ${statusRaw}) — ユーザー承認後に着手してください`)
    } else {
      status = statusRaw as TaskStatus
    }
  } else {
    warnings.push(`statusをpending_approvalに補正しました (元: ${statusRaw})`)
  }

  const targetApp = typeof raw.targetApp === 'string' ? raw.targetApp.trim() : ''
  if (!targetApp) warnings.push('targetAppが未指定です')

  const memo =
    typeof raw.memo === 'string' && raw.memo.trim()
      ? raw.memo.trim()
      : typeof raw.work === 'string'
      ? raw.work.trim()
      : ''

  return {
    index,
    title,
    priority,
    risk,
    targetApp,
    targetPath: typeof raw.targetPath === 'string' ? raw.targetPath.trim() : '',
    status,
    phaseId: typeof raw.phaseId === 'string' ? raw.phaseId.trim() : '',
    nextAction: typeof raw.nextAction === 'string' ? raw.nextAction.trim() : '',
    dueHint: typeof raw.dueHint === 'string' ? raw.dueHint.trim() : '',
    taskPrompt: typeof raw.taskPrompt === 'string' ? raw.taskPrompt.trim() : '',
    memo,
    allowed: toStringArray(raw.allowed),
    forbidden: toStringArray(raw.forbidden),
    doneCriteria: toStringArray(raw.doneCriteria),
    blockedReason: typeof raw.blockedReason === 'string' ? raw.blockedReason.trim() : '',
    unblockAction: typeof raw.unblockAction === 'string' ? raw.unblockAction.trim() : '',
    nextQuestion: typeof raw.nextQuestion === 'string' ? raw.nextQuestion.trim() : '',
    warnings,
    hasError,
  }
}

function parseJson(text: string): { items: ParsedItem[]; parseError: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { items: [], parseError: `JSONパースエラー: ${(e as Error).message}` }
  }

  let rawItems: unknown[]
  if (Array.isArray(parsed)) {
    rawItems = parsed
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.todos)) {
      rawItems = obj.todos
    } else if (Array.isArray(obj.tasks)) {
      rawItems = obj.tasks
    } else {
      return { items: [], parseError: '形式が不正です。配列か {"todos": [...]} 形式にしてください。' }
    }
  } else {
    return { items: [], parseError: 'JSONの形式が不正です。' }
  }

  if (rawItems.length === 0) {
    return { items: [], parseError: 'ToDoが0件です。' }
  }

  const items = rawItems
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item, i) => normalizeItem(item, i))

  return { items, parseError: null }
}

interface Props {
  projects: { id: string; name: string }[]
  goals: { id: string; title: string; projectId?: string; phases: { id: string; title: string }[] }[]
  existingTasks: { title: string; status: string; targetPath?: string }[]
}

export default function JsonImportManager({ projects, goals, existingTasks }: Props) {
  const router = useRouter()
  const [jsonText, setJsonText] = useState('')
  const [projectId, setProjectId] = useState('')
  const [goalId, setGoalId] = useState('')
  const [previewItems, setPreviewItems] = useState<ParsedItem[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [addToToday, setAddToToday] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: number; skip: number; queued: number; queueSkip: number } | null>(null)
  const [saveError, setSaveError] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  const existingTitles = useMemo(() => new Set(existingTasks.map((t) => t.title)), [existingTasks])
  const selectedGoal = useMemo(() => goals.find((goal) => goal.id === goalId), [goals, goalId])
  const inProgressPaths = useMemo(
    () => new Set(existingTasks.filter((t) => t.status === 'in_progress' && t.targetPath).map((t) => t.targetPath!)),
    [existingTasks]
  )

  function findProjectIdForTargetApp(targetApp: string): string | null {
    if (!targetApp) return null
    const lower = targetApp.toLowerCase()
    const exact = projects.find((p) => p.id.toLowerCase() === lower)
    if (exact) return exact.id
    const partial = projects.find(
      (p) =>
        p.id.toLowerCase().includes(lower) ||
        lower.includes(p.id.toLowerCase()) ||
        p.name.toLowerCase().includes(lower) ||
        lower.includes(p.name.toLowerCase())
    )
    return partial?.id ?? null
  }

  const mismatchInfo = useMemo(() => {
    if (!previewItems || !projectId) return null
    const selectedItems = previewItems.filter((i) => selected.has(i.index) && !i.hasError && i.targetApp)
    if (selectedItems.length === 0) return null
    const uniqueApps = Array.from(new Set(selectedItems.map((i) => i.targetApp)))
    if (uniqueApps.length > 1) return { type: 'mixed' as const, apps: uniqueApps }
    const targetApp = uniqueApps[0]
    const lower = targetApp.toLowerCase()
    const currentProject = projects.find((p) => p.id === projectId)
    const matches =
      currentProject &&
      (currentProject.id.toLowerCase() === lower ||
        currentProject.id.toLowerCase().includes(lower) ||
        lower.includes(currentProject.id.toLowerCase()) ||
        currentProject.name.toLowerCase().includes(lower) ||
        lower.includes(currentProject.name.toLowerCase()))
    if (!matches) return { type: 'mismatch' as const, targetApp, projectName: currentProject?.name ?? projectId }
    return null
  }, [previewItems, selected, projectId, projects])

  async function copyToClipboard(text: string) {
    try {
      const ok = await copyTextToClipboard(text)
      if (!ok) setFallbackText(text)
      return ok
    } catch {
      setFallbackText(text)
      return false
    }
  }

  async function handleCopyPrompt() {
    const ok = await copyToClipboard(JSON_PROMPT)
    if (ok) {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2500)
    }
  }

  function handlePreview() {
    if (!jsonText.trim()) {
      setParseError('JSONを入力してください')
      setPreviewItems(null)
      return
    }
    const { items, parseError: err } = parseJson(jsonText)
    setParseError(err)
    if (err || items.length === 0) {
      setPreviewItems(null)
      return
    }
    setPreviewItems(items)
    setSelected(new Set(items.filter((i) => !i.hasError).map((i) => i.index)))
    setSaveResult(null)
    setSaveError('')
  }

  function toggleAll() {
    if (!previewItems) return
    const validIndices = previewItems.filter((i) => !i.hasError).map((i) => i.index)
    if (selected.size === validIndices.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validIndices))
    }
  }

  function toggleItem(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function getExtraWarnings(item: ParsedItem): string[] {
    const warns: string[] = []
    if (existingTitles.has(item.title)) warns.push('同じtitleのToDoが既に存在します')
    if (item.targetPath && inProgressPaths.has(item.targetPath)) {
      warns.push('targetPathがin_progressのToDoと重複しています')
    }
    return warns
  }

  async function handleSave() {
    if (!goalId) { setSaveError('Goalを選択してください'); return }
    if (!previewItems || selected.size === 0) { setSaveError('保存するToDoを選択してください'); return }
    setSaving(true)
    setSaveError('')

    const toSave = previewItems.filter((item) => selected.has(item.index) && !item.hasError)
    const todos = toSave.map((item) => ({
      title: item.title,
      priority: item.priority,
      status: item.status === 'done' || item.status === 'skipped' ? item.status : item.status === 'in_progress' ? 'active' : 'pending',
      memo: item.memo,
      phaseId: item.phaseId,
      nextAction: item.nextAction,
      dueHint: item.dueHint,
      ...(item.taskPrompt && { taskPrompt: item.taskPrompt }),
      ...(item.doneCriteria.length > 0 && { doneCriteria: item.doneCriteria }),
      source: 'manual_todo',
    }))

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendTodos', goalId, todos }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaveError(data.error ?? '保存に失敗しました')
        return
      }
      const data = await res.json()
      const ok = data.count ?? 0
      const queued = addToToday ? ok : 0
      const queueSkip = 0

      setSaveResult({ ok, skip: Math.max(0, toSave.length - ok), queued, queueSkip })
      setPreviewItems(null)
      setSelected(new Set())
      setJsonText('')
      router.refresh()
    } catch {
      setSaveError('通信エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const validCount = previewItems ? previewItems.filter((i) => !i.hasError).length : 0
  const selectedValidCount = previewItems ? previewItems.filter((i) => selected.has(i.index) && !i.hasError).length : 0

  return (
    <div className="space-y-4">

      {/* Fallback copy textarea */}
      {fallbackText && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">クリップボードへのコピーに失敗しました</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">下のテキストを選択して手動でコピーしてください。</p>
          <textarea
            value={fallbackText}
            readOnly
            rows={8}
            className="w-full text-xs font-mono rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-800 dark:text-gray-100 focus:outline-none resize-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={() => setFallbackText(null)}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Step 1: copy prompt */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">1</span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">プロンプトをChatGPT / Claudeに渡す</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 pl-8">
          このプロンプトをChatGPTまたはClaudeに貼り付けて、ToDoリストをJSON形式で出力させてください。
        </p>
        <button
          onClick={handleCopyPrompt}
          className="w-full py-2.5 rounded-xl text-sm font-medium border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
        >
          {promptCopied ? '✓ プロンプトをコピーしました' : '📋 JSON取得用プロンプトをコピー'}
        </button>
      </div>

      {/* Step 2: paste JSON */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">2</span>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">JSONを貼り付ける</h2>
          </div>
          <button
            onClick={() => { setJsonText(SAMPLE_JSON); setPreviewItems(null); setParseError(null); setSaveResult(null) }}
            className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 underline flex-shrink-0"
          >
            サンプルを表示
          </button>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder={'{\n  "todos": [\n    { "title": "タスク名", "priority": "medium" }\n  ]\n}'}
          rows={10}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 font-mono text-xs bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
        />
        {parseError && (
          <p className="text-xs text-red-500 dark:text-red-400 px-1">{parseError}</p>
        )}
        <button
          onClick={handlePreview}
          disabled={!jsonText.trim()}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          プレビューを生成
        </button>
      </div>

      {/* Step 3: preview & save */}
      {previewItems && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">3</span>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">取り込むToDoを確認して保存</h2>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{previewItems.length}件</span>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Goalを選択してください</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">未選択では保存しません。未分類Goalは作成しません。</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象Goal *</label>
            <select
              value={goalId}
              onChange={(e) => { const nextGoalId = e.target.value; setGoalId(nextGoalId); setProjectId(goals.find((g) => g.id === nextGoalId)?.projectId ?? ''); setSaveError('') }}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Goalを選択してください</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.title}</option>
              ))}
            </select>
          </div>
          {selectedGoal && selectedGoal.phases.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              利用可能phase: {selectedGoal.phases.map((phase) => phase.title).join(' / ')}
            </p>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={addToToday}
              onChange={(e) => setAddToToday(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-blue-700 dark:text-blue-300">次回自動実行候補に出す</span>
              <span className="block text-xs text-blue-600 dark:text-blue-400 mt-0.5">GoalTodoとして保存します。QueueはGoalから派生して表示されます。</span>
            </span>
          </label>

          {/* Select all toggle */}
          <div className="flex items-center gap-3 py-0.5">
            <button
              onClick={toggleAll}
              className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              {selectedValidCount === validCount ? 'すべて解除' : 'すべて選択'}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {selectedValidCount} / {validCount} 件選択中
            </span>
          </div>

          {/* Item list */}
          <div className="space-y-2">
            {previewItems.map((item) => {
              const extraWarns = getExtraWarnings(item)
              const allWarns = [...item.warnings, ...extraWarns]
              const isChecked = selected.has(item.index) && !item.hasError

              return (
                <label
                  key={item.index}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    item.hasError
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 cursor-not-allowed'
                      : isChecked
                      ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={item.hasError}
                    onChange={() => !item.hasError && toggleItem(item.index)}
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0 disabled:cursor-not-allowed"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    {item.hasError ? (
                      <p className="text-[13px] font-semibold text-red-600 dark:text-red-400 leading-snug">
                        ✗ {item.title || '(titleが空です — 取り込み不可)'}
                      </p>
                    ) : (
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 leading-snug">{item.title}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityChip priority={item.priority} />
                      {item.risk && <RiskChip risk={item.risk} />}
                      <StatusChip status={item.status} />
                      {item.targetApp && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-mono">{item.targetApp}</span>
                      )}
                      {item.targetPath && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono truncate max-w-[180px]" title={item.targetPath}>{item.targetPath}</span>
                      )}
                      {item.doneCriteria.length > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">完了条件 {item.doneCriteria.length}件</span>
                      )}
                      {item.taskPrompt && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">📋 指示あり</span>
                      )}
                    </div>
                    {allWarns.length > 0 && (
                      <ul className="space-y-0.5">
                        {allWarns.map((w, i) => (
                          <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          {mismatchInfo && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-3 py-2.5">
              {mismatchInfo.type === 'mixed' ? (
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                  ⚠ targetAppが混在しています: {mismatchInfo.apps.join(' / ')}
                </p>
              ) : (
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                  ⚠ targetApp不一致: ToDoのtargetApp「{mismatchInfo.targetApp}」が保存先案件「{mismatchInfo.projectName}」と一致しません
                </p>
              )}
            </div>
          )}

          {saveError && <p className="text-xs text-red-500 dark:text-red-400">{saveError}</p>}

          <button
            onClick={handleSave}
            disabled={saving || selectedValidCount === 0 || !goalId}
            className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-green-700 transition-colors"
          >
            {saving ? '保存中...' : `選択した ${selectedValidCount} 件を保存する`}
          </button>
        </div>
      )}

      {/* Save result */}
      {saveResult && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-4 space-y-3">
          <p className="text-base font-bold text-green-700 dark:text-green-300">✓ 保存が完了しました</p>
          <div className="space-y-1">
            <p className="text-sm text-green-600 dark:text-green-400">取り込み成功: <span className="font-semibold">{saveResult.ok}件</span></p>
            {saveResult.skip > 0 && <p className="text-sm text-amber-600 dark:text-amber-400">スキップ: {saveResult.skip}件</p>}
            {saveResult.queued > 0 && <p className="text-sm text-blue-600 dark:text-blue-400">今日の作業へ追加: <span className="font-semibold">{saveResult.queued}件</span></p>}
            {saveResult.queueSkip > 0 && <p className="text-sm text-amber-600 dark:text-amber-400">今日の作業への追加スキップ: {saveResult.queueSkip}件</p>}
          </div>
          <Link
            href="/tasks"
            className="block text-center py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            ToDo一覧で確認する →
          </Link>
        </div>
      )}
    </div>
  )
}

function PriorityChip({ priority }: { priority: string }) {
  const colorMap: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  const labelMap: Record<string, string> = { high: '優先:高', medium: '優先:中', low: '優先:低' }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colorMap[priority] ?? 'bg-gray-100 text-gray-600'}`}>
      {labelMap[priority] ?? priority}
    </span>
  )
}

function RiskChip({ risk }: { risk: string }) {
  const colorMap: Record<string, string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-emerald-600 dark:text-emerald-400',
  }
  return (
    <span className={`text-xs font-medium ${colorMap[risk] ?? 'text-gray-500'}`}>
      risk:{risk}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  if (status === 'pending_approval') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        承認待ち
      </span>
    )
  }
  return null
}
