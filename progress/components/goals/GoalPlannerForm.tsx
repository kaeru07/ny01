'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ProjectOption {
  id: string
  name: string
}

interface Props {
  projects: ProjectOption[]
  hasMainGoal: boolean
}

interface PreviewSummary {
  goalTitle: string
  goalSummary: string
  projectId: string
  phaseCount: number
  todoCount: number
  warnings: string[]
  errors: string[]
}

interface ImportResult {
  goalId: string
  phaseCount: number
  todoCount: number
  queuedCount: number
  queueSkippedCount: number
  warnings: string[]
  createdCount?: number
}

const DEFAULT_QUEUE_ROLES = ['claude']

export default function GoalPlannerForm({ projects, hasMainGoal }: Props) {
  const router = useRouter()
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState<PreviewSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [setAsMain, setSetAsMain] = useState(!hasMainGoal)
  const [singleGoal, setSingleGoal] = useState({
    title: '',
    projectId: '',
    prompt: '',
  })
  const [singleSaving, setSingleSaving] = useState(false)
  const [singleMessage, setSingleMessage] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)

  const projectList = projects.map((p) => `${p.name}（id: ${p.id}）`).join(' / ') || '（案件なし。projectId は空でよい）'
  const chatgptPrompt = [
    'あなたは個人開発の目標設計を手伝うアシスタントです。',
    '私がやりたいことを、progress アプリに取り込める JSON（ゴール＋ToDo）に整理してください。',
    '',
    '# 出力ルール',
    '- JSON のみを出力（前後に説明文・コードフェンスを付けない）',
    '- 形式は { "goals": [ ... ] }。ゴールは1〜5件。',
    '- 各ゴールに 2〜8 個の具体的な ToDo を付ける。',
    '- projectId は任意（分かるものがあれば下記から選ぶ。無ければ "" でよい）。',
    `- 既存の案件: ${projectList}`,
    '',
    '# JSON スキーマ',
    '{',
    '  "goals": [',
    '    {',
    '      "goalTitle": "ゴール名（達成したい状態）",',
    '      "goalSummary": "1〜2行の補足",',
    '      "projectId": "",',
    '      "priority": "high | medium | low",',
    '      "todos": [',
    '        { "title": "具体作業", "nextAction": "次にやる1行", "doneCriteria": ["検証可能な完了条件"] }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    '# 私がやりたいこと（ここに書く）',
    '- ',
  ].join('\n')

  async function copyChatgptPrompt() {
    try {
      await navigator.clipboard.writeText(chatgptPrompt)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2500)
    } catch {
      setImportError('コピーに失敗しました。手動で選択してコピーしてください。')
    }
  }

  async function handlePreview() {
    setImportError('')
    setPreview(null)
    setImportResult(null)
    if (!jsonText.trim()) {
      setImportError('JSON を貼り付けてください')
      return
    }
    let parsed: unknown
    try {
      const cleaned = jsonText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '')
      parsed = JSON.parse(cleaned)
    } catch (e) {
      setImportError(`JSON パースエラー: ${(e as Error).message}`)
      return
    }

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', payload: parsed }),
      })
      const data = await res.json()
      const obj = parsed as Record<string, unknown>
      setPreview({
        goalTitle: typeof obj.goalTitle === 'string' ? obj.goalTitle : '',
        goalSummary: typeof obj.goalSummary === 'string' ? obj.goalSummary : '',
        projectId: typeof obj.projectId === 'string' ? obj.projectId : '',
        phaseCount: data.phaseCount ?? 0,
        todoCount: data.todoCount ?? 0,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        errors: Array.isArray(data.errors) ? data.errors : [],
      })
    } catch {
      setImportError('プレビュー検証に失敗しました')
    }
  }

  async function handleImport() {
    setImportError('')
    setImportResult(null)
    if (!jsonText.trim()) { setImportError('JSON を貼り付けてください'); return }
    let parsed: unknown
    try {
      const cleaned = jsonText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '')
      parsed = JSON.parse(cleaned)
    } catch (e) {
      setImportError(`JSON パースエラー: ${(e as Error).message}`)
      return
    }
    setImporting(true)
    try {
      const body = {
        ...(parsed as Record<string, unknown>),
        setAsMain,
        addToQueueRoles: DEFAULT_QUEUE_ROLES,
      }
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        const errs = Array.isArray(data.errors) && data.errors.length > 0 ? data.errors.join(' / ') : (data.error ?? '登録に失敗しました')
        setImportError(errs)
        return
      }
      setImportResult({
        goalId: data.goalId ?? '',
        phaseCount: data.phaseCount ?? 0,
        todoCount: data.todoCount ?? 0,
        queuedCount: data.queuedCount ?? 0,
        queueSkippedCount: data.queueSkippedCount ?? 0,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        createdCount: typeof data.createdCount === 'number' ? data.createdCount : undefined,
      })
      setJsonText('')
      setPreview(null)
      router.refresh()
    } catch {
      setImportError('通信エラーが発生しました')
    } finally {
      setImporting(false)
    }
  }

  async function handleSingleGoalSubmit() {
    setSingleMessage('')
    if (!singleGoal.title.trim()) {
      setSingleMessage('title を入力してください')
      return
    }
    setSingleSaving(true)
    try {
      // ユーザーが直接追加したゴールは、その入力自体を実行許可とみなし即時 active にする。
      // AI/調査由来の提案だけが proposed → 承認の対象。
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertSingle',
          goal: {
            title: singleGoal.title,
            prompt: singleGoal.prompt,
            projectId: singleGoal.projectId || undefined,
            status: 'active',
            decisionPolicy: 'autonomous',
            riskFlags: [],
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setSingleMessage(data.error ?? '追加に失敗しました')
        return
      }
      setSingleMessage('ゴールを追加しました。承認不要で次回の自動実行対象になります。')
      setSingleGoal((prev) => ({ ...prev, title: '', prompt: '' }))
      router.refresh()
    } catch {
      setSingleMessage('通信エラーが発生しました')
    } finally {
      setSingleSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold">＋</span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">ゴールを直接追加</h2>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">タイトルだけで追加できます（案件・説明は任意）。直接追加したゴールは承認不要で、すぐ次回の自動実行対象になります。</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">タイトル *</label>
            <input
              value={singleGoal.title}
              onChange={(e) => setSingleGoal((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="例: 鳥ログを収益化する"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">案件 (任意)</label>
            <select
              value={singleGoal.projectId}
              onChange={(e) => setSingleGoal((prev) => ({ ...prev, projectId: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              <option value="">未設定</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">プロンプト・説明 (任意)</label>
            <textarea value={singleGoal.prompt} onChange={(e) => setSingleGoal((prev) => ({ ...prev, prompt: e.target.value }))} rows={3} placeholder="どんな目標か / AIにどう進めてほしいか（任意）" className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-y" />
          </div>
        </div>
        {singleMessage && <p className={`text-xs ${singleMessage.includes('登録しました') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{singleMessage}</p>}
        <button onClick={handleSingleGoalSubmit} disabled={singleSaving || !singleGoal.title.trim()} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-emerald-700 transition-colors">
          {singleSaving ? '追加中...' : 'ゴール承認へ追加'}
        </button>
      </section>

      {/* JSON で一括追加 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">{'{}'}</span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">JSON で一括追加</h2>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{'ChatGPTにゴール＋ToDoを作らせて、その JSON を貼り付けて一括登録します。複数ゴール（{ "goals": [...] }）にも対応。projectId・phases は任意です。'}</p>
        <button
          onClick={copyChatgptPrompt}
          className="w-full py-2.5 rounded-xl text-sm font-medium border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
        >
          {promptCopied ? '✓ コピーしました（ChatGPTに貼り付け）' : '📋 ChatGPT用プロンプトをコピー（ゴール＋ToDo生成）'}
        </button>
        <p className="text-[11px] text-gray-400">コピー → ChatGPTに貼る → 返ってきた JSON を下に貼り付け → 「JSON を検証する」→「一括登録する」。</p>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{ "goals": [ { "goalTitle": "...", "todos": [ { "title": "..." } ] } ] }'
          rows={10}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 font-mono text-xs bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-y"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handlePreview}
            disabled={!jsonText.trim()}
            className="py-2.5 rounded-xl border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 text-sm font-semibold disabled:opacity-40 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            JSON を検証する
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !jsonText.trim()}
            className="py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-green-700 transition-colors"
          >
            {importing ? '登録中...' : '一括登録する'}
          </button>
        </div>

        {/* オプション */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={setAsMain}
              onChange={(e) => setSetAsMain(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600"
            />
            登録後にこの目標をメイン目標にする
          </label>
        </div>

        {importError && (
          <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>
        )}
      </section>

      {/* Preview result */}
      {preview && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">プレビュー</h3>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{preview.goalTitle || '(goalTitle 未設定)'}</p>
          {preview.goalSummary && <p className="text-xs text-gray-500 dark:text-gray-400">{preview.goalSummary}</p>}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="フェーズ" value={preview.phaseCount} color="text-blue-600 dark:text-blue-400" />
            <Stat label="ToDo" value={preview.todoCount} color="text-emerald-600 dark:text-emerald-400" />
            <Stat label="projectId" value={preview.projectId || '-'} small color="text-gray-600 dark:text-gray-300" />
          </div>
          {preview.errors.length > 0 && (
            <ul className="space-y-0.5">
              {preview.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-500 dark:text-red-400">✗ {e}</li>
              ))}
            </ul>
          )}
          {preview.warnings.length > 0 && (
            <ul className="space-y-0.5">
              {preview.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {w}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Import result */}
      {importResult && (
        <section className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-4 space-y-3">
          <p className="text-base font-bold text-green-700 dark:text-green-300">✓ {importResult.createdCount ? `${importResult.createdCount}件のゴールを登録しました` : 'Goal を登録しました'}</p>
          <p className="text-sm text-green-700 dark:text-green-300">phases: <span className="font-semibold">{importResult.phaseCount}</span> / todos: <span className="font-semibold">{importResult.todoCount}</span></p>
          {importResult.queuedCount > 0 && (
            <p className="text-sm text-blue-700 dark:text-blue-300">今日の作業へ追加: <span className="font-semibold">{importResult.queuedCount}件</span>{importResult.queueSkippedCount > 0 ? ` / スキップ: ${importResult.queueSkippedCount}件` : ''}</p>
          )}
          {importResult.warnings.length > 0 && (
            <ul className="space-y-0.5">
              {importResult.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {w}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Link href="/" className="flex-1 text-center py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">ダッシュボードへ</Link>
            <Link href="/tasks" className="flex-1 text-center py-2.5 rounded-xl border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">ToDo を確認</Link>
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, color, small }: { label: string; value: number | string; color: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 px-2 py-2 text-center">
      <p className={`${small ? 'text-sm font-mono' : 'text-xl font-bold'} leading-tight ${color} truncate`}>{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{label}</p>
    </div>
  )
}
