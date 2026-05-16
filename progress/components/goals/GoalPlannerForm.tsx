'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { GoalRole, MonetizationImpact } from '@/types/goal'

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
  perRole: Record<GoalRole, number>
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
}

const ROLE_OPTIONS: { value: GoalRole; label: string; color: string }[] = [
  { value: 'human', label: '人間', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'claude', label: 'Claude', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'codex', label: 'Codex', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
]

const IMPACT_OPTIONS: { value: MonetizationImpact; label: string }[] = [
  { value: 'high', label: '収益直結:高' },
  { value: 'medium', label: '収益直結:中' },
  { value: 'low', label: '収益直結:低' },
  { value: 'none', label: '収益化なし' },
]

export default function GoalPlannerForm({ projects, hasMainGoal }: Props) {
  const router = useRouter()
  const [goalText, setGoalText] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [monetizationFirst, setMonetizationFirst] = useState(true)
  const [phaseHint, setPhaseHint] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState<PreviewSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [setAsMain, setSetAsMain] = useState(!hasMainGoal)
  const [queueRoles, setQueueRoles] = useState<Record<GoalRole, boolean>>({ human: false, claude: true, codex: false })
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      setFallbackText(text)
      return false
    }
  }

  function buildPrompt() {
    if (!goalText.trim()) {
      setImportError('目標を入力してください')
      return
    }
    if (!projectId) {
      setImportError('対象案件を選択してください')
      return
    }
    setImportError('')

    const monetizationLine = monetizationFirst
      ? '- 収益化を最優先する。広告/課金/PR等に直結するタスクの優先度を上げる'
      : '- ユーザーが指定した目標を素直に分解する。収益化は副次的でよい'
    const hintLine = phaseHint.trim() ? `\n- 参考フェーズ案: ${phaseHint.trim()}` : ''
    const projectLine = selectedProject ? `${selectedProject.name} (id: ${projectId})` : projectId

    const prompt = `以下の目標を progress アプリの Goal Planner 用 JSON に分解してください。

# 目標
${goalText.trim()}

# 対象案件
${projectLine}

# 役割の使い分け
- human: ユーザー本人にしかできない作業（Play Console / 銀行口座 / 写真撮影 / 法的判断 / アプリ署名キー作成 等）
- claude: Claude Code(このリポジトリ内のCLI)で実装可能な作業（コード追加・修正・テスト・ビルド・ドキュメント生成）
- codex: Codex / 別 AI セッションで実施するのが向いている作業（仕様検討・案文作成・調査・命名・コピーライティング 等）

# 出力ルール
- JSON のみで返す。前後に説明文・Markdownコードフェンスを付けない
- 必ず以下のキーをすべて含める: projectId / goalTitle / goalSummary / priority / monetizationImpact / phases / todos
${monetizationLine}
- phases は 3〜6 件、達成順に order を昇順で振る
- todos は 6〜20 件、それぞれを1個の具体作業に分割（大きすぎる作業は分割する）
- todos の role は human / claude / codex のいずれか
- すべての todos に doneCriteria を 1 件以上含める（検証可能な形）
- 依存関係がある場合は dependsOn に他 todo の id を入れる
- claude / codex の todos には taskPrompt を 200〜600 字程度で具体的に書く${hintLine}

# JSON スキーマ
{
  "projectId": "${projectId}",
  "goalTitle": "(目標を1〜2行に要約)",
  "goalSummary": "(目標の背景・達成条件)",
  "priority": "high | medium | low",
  "monetizationImpact": "high | medium | low | none",
  "phases": [
    {
      "id": "phase-1",
      "title": "(フェーズ名)",
      "summary": "(このフェーズで達成すること)",
      "order": 0,
      "status": "todo"
    }
  ],
  "todos": [
    {
      "id": "todo-1",
      "phaseId": "phase-1",
      "title": "(具体作業)",
      "role": "human | claude | codex",
      "order": 0,
      "priority": "high | medium | low",
      "nextAction": "(今すぐ次にやる1行)",
      "doneCriteria": ["(検証可能な完了条件)"],
      "taskPrompt": "(Claude/Codex向け詳細指示。humanの場合は空欄でよい)",
      "memo": "(補足)",
      "dependsOn": []
    }
  ]
}

JSON のみで返答してください。`

    setGeneratedPrompt(prompt)
  }

  async function handleCopyPrompt() {
    if (!generatedPrompt) buildPrompt()
    const text = generatedPrompt || ''
    if (!text) return
    const ok = await copy(text)
    if (ok) {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2500)
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
        perRole: data.perRole ?? { human: 0, claude: 0, codex: 0 },
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
    const queueRolesList = (Object.keys(queueRoles) as GoalRole[]).filter((r) => queueRoles[r])

    setImporting(true)
    try {
      const body = {
        ...(parsed as Record<string, unknown>),
        setAsMain,
        addToQueueRoles: queueRolesList,
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
        goalId: data.goalId,
        phaseCount: data.phaseCount,
        todoCount: data.todoCount,
        queuedCount: data.queuedCount,
        queueSkippedCount: data.queueSkippedCount,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
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

  function toggleQueueRole(role: GoalRole) {
    setQueueRoles((prev) => ({ ...prev, [role]: !prev[role] }))
  }

  return (
    <div className="space-y-5">
      {fallbackText && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">クリップボードコピーに失敗しました</p>
          <textarea
            value={fallbackText}
            readOnly
            rows={6}
            className="w-full text-xs font-mono rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-gray-800 px-3 py-2"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={() => setFallbackText(null)} className="text-xs text-amber-600 dark:text-amber-400 hover:underline">閉じる</button>
        </div>
      )}

      {/* Step 1: 目標入力 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">1</span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">目標を入力する</h2>
        </div>

        <textarea
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          placeholder="例: 資格アプリを Google Play で公開して広告収入を月3000円得たい"
          rows={4}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象案件 *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">選択してください</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">参考フェーズ案 (任意)</label>
            <input
              type="text"
              value={phaseHint}
              onChange={(e) => setPhaseHint(e.target.value)}
              placeholder="例: 仕様確定 → 実装 → 内部テスト → 公開"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={monetizationFirst}
            onChange={(e) => setMonetizationFirst(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600"
          />
          収益化を最優先で分解する
        </label>

        <button
          onClick={buildPrompt}
          disabled={!goalText.trim() || !projectId}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          分解プロンプトを生成
        </button>
      </section>

      {/* Step 2: プロンプト表示 */}
      {generatedPrompt && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">2</span>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">プロンプトを Claude / Codex に渡す</h2>
          </div>
          <textarea
            value={generatedPrompt}
            readOnly
            rows={10}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 font-mono text-xs bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-y"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={handleCopyPrompt}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
          >
            {promptCopied ? '✓ プロンプトをコピーしました' : '📋 プロンプトをコピー'}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">Claude / Codex に貼り付けて、JSON を取得してください。</p>
        </section>
      )}

      {/* Step 3: JSON 貼付 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">3</span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">JSON を貼り付ける</h2>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{ "projectId": "...", "goalTitle": "...", "phases": [...], "todos": [...] }'
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
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">今日の作業キューへ追加する role:</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer select-none ${queueRoles[r.value] ? r.color : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                  <input
                    type="checkbox"
                    checked={queueRoles[r.value]}
                    onChange={() => toggleQueueRole(r.value)}
                    className="w-3 h-3 rounded accent-blue-600"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
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
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((r) => (
              <Stat key={r.value} label={r.label} value={preview.perRole[r.value] ?? 0} color="text-gray-700 dark:text-gray-200" />
            ))}
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
          <p className="text-base font-bold text-green-700 dark:text-green-300">✓ Goal を登録しました</p>
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
