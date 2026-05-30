'use client'

import { useEffect, useState } from 'react'
import type { WorkQueueItem } from '@/types/session'
import { getEffectiveOrder } from '@/lib/session-utils'

interface Props { items: WorkQueueItem[] }

function generatePrompt(items: WorkQueueItem[], decisionContext: string): string {
  const date = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  const active = [...items]
    .filter((i) => i.status === 'queued' || i.status === 'in_progress')
    .sort((a, b) => getEffectiveOrder(a) - getEffectiveOrder(b))

  if (active.length === 0) return '今日の作業キューが空です。ToDo管理でタスクを選んで「今日の作業に追加」してください。'

  const taskList = active.map((item, i) => {
    if (item.taskPrompt && item.taskPrompt.trim()) {
      const lines = [
        `## ${i + 1}. ${item.projectName}: ${item.taskTitle}`,
        '',
        `このタスクはユーザーが専用プロンプトを指定しています。`,
        `forbidden / 共通安全ルールは専用プロンプトより優先されます。`,
        '',
        `### 専用プロンプト`,
        item.taskPrompt.trim(),
        '',
        `### 完了条件`,
        item.doneCondition,
        '',
        `### 補足`,
        `優先度: ${item.priority} / 理由: ${item.reason}`,
      ]
      if (item.userMemo) lines.push(`メモ: ${item.userMemo}`)
      return lines.join('\n')
    }

    const lines = [
      `${i + 1}. **${item.projectName}: ${item.taskTitle}**`,
      `   優先度: ${item.priority} / 完了条件: ${item.doneCondition}`,
      `   理由: ${item.reason}`,
    ]
    if (item.userMemo) lines.push(`   メモ: ${item.userMemo}`)
    return lines.join('\n')
  }).join('\n\n')

  return `# 集中作業モード指示 (${date})

この作業順番はユーザーが progress アプリで確認・承認済みです。

## 🔴 絶対ルール（厳守）
- **pending_approval のToDoには絶対に着手しない**
- 作業対象は approved / queued（このリスト）のToDoのみ
- blocked / rejected のToDoはスキップする
- リストにないタスクを勝手に追加・実行しない
- 仕様・設計・優先順位の判断はユーザーが行う。自分で判断しない

## Executorルール
- 実行者は Claude 固定ではない。Claude Code / Codex / manual / other のいずれでも、このキューと ExecutionRun を正本にする
- preferredExecutor / fallbackExecutor / canRunOnCodex / requiresClaude がある場合はそれを優先する
- Claude 上限などで継続不能になった場合は、会話履歴ではなく handoff を正本として次 executor に引き継ぐ
- Codex へ自動切替してよいのは、軽微な修正、lint/typecheck/build修正、テスト追加、ドキュメント整備、Vault整理、GitHub Issue整理、UI微修正、方針決定済み実装、反復作業
- 課金、本番DB変更、destructive操作、認証情報利用、外部公開、方針未決定の設計、高リスク作業は Codex へ自動切替せず Approval Queue または waiting にする

${decisionContext}

## 作業ルール
- 上から順番に、1件ずつ処理する
- 作業開始時に status を in_progress にする
- 完了時に status を done にする
- 以下の場合はその作業を blocked にして次へ進む（確認不要）:
  - 仕様判断が必要
  - .env 変更が必要
  - DB 破壊的変更が必要
  - 本番影響が懸念される
  - 指示の解釈が複数あって迷う場合

## taskPrompt の扱い
- taskPrompt があるToDoは、**taskPromptを最優先の作業指示**として使う
- taskPrompt がないToDoは、title / reason / doneCriteria をもとに最小変更で実装する
- どちらの場合も「作業範囲を広げない」を厳守する

## 作業完了後の記録
各タスク完了後:
1. status を done に変更する
2. progress ファイルに記録する（実施内容・変更ファイル・検証結果・次アクション）
3. **POST http://localhost:3010/api/execution-runs** へ実行結果を登録する

ExecutionRun 登録例:
\`\`\`json
{
  "targetApp": "<アプリ名>",
  "targetTodoId": "<taskId>",
  "targetTodoTitle": "<タイトル>",
  "runStatus": "completed",
  "reviewStatus": "not_reviewed",
  "summary": "<実施内容1〜3行>",
  "changedFiles": [{"file": "<path>", "change": "<変更内容>"}],
  "checks": {"build": "OK", "typescript": "OK", "lint": "OK"},
  "warnings": [],
  "nextActions": [],
  "rawReport": "<完了報告全文>"
}
\`\`\`

## 上限・中断時
- 上限が近い場合は新しい作業を始めず、中断状態と残ToDoを記録する
- 中断前に必ず progress を最新状態に更新する
- handoff には 目的 / 現在地 / 変更済みファイル / 未完了作業 / 禁止事項 / 検証条件 / Decision Log / 承認待ち事項 を残す

## 本日の作業リスト

${taskList}

---
progress 正本: /root/company/apps/ny01/progress/data/real/`
}

export default function PromptCopy({ items }: Props) {
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(false)
  const [decisionContext, setDecisionContext] = useState('')
  const prompt = generatePrompt(items, decisionContext)

  useEffect(() => {
    fetch('/api/operations/decisions/context', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { promptBlock?: string } | null) => {
        if (data?.promptBlock) setDecisionContext(data.promptBlock)
      })
      .catch(() => setDecisionContext(''))
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShown(true)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={copy}
        className="w-full py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
      >
        <span>{copied ? '✓ コピー完了' : '📋 Claude Code作業開始プロンプトをコピー'}</span>
      </button>

      {shown && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">コピーできない場合は以下を手動でコピーしてください:</p>
          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">{prompt}</pre>
          <button onClick={() => setShown(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">閉じる</button>
        </div>
      )}
    </div>
  )
}
