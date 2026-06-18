import { readGoals } from '@/lib/goal-reader'

// 自動実行中（Factory アイドル時）にAIへ「次に目指すべきゴールを提案して」と依頼するための補助。
// 実際の候補生成はAI実行者（Claude / Codex）が下記プロンプトに従い POST /api/goals/propose を呼ぶことで行う
// （Factory は LLM をインプロセスで持たないため、提案の起点＝依頼の発行までを担当する）。
// 承認は Inbox（今日の判断）で行い、承認されたゴールが次回以降の自動実行対象になる。

/** これ以上 proposed を積み増さない上限（承認待ちが溜まりすぎないように）。 */
const MAX_PENDING_PROPOSALS = 3

export interface GoalProposalRequest {
  requested: boolean
  reason: string
  prompt?: string
  pendingCount: number
}

function buildProposalPrompt(activeTitles: string[]): string {
  return [
    'あなたはAI工場の戦略担当です。今は自動実行できる作業が無い「アイドル状態」です。',
    '次に会社が目指すべき「ゴール候補」を1〜3件提案してください。',
    '各ゴールは検証可能で、既存ゴールと重複しないこと。',
    activeTitles.length > 0 ? `既存のゴール（重複禁止）: ${activeTitles.join(' / ')}` : '既存のゴールはありません。',
    '',
    '提案は次のエンドポイントに POST して登録すること（承認されるまで自動実行されません）:',
    'POST http://localhost:3010/api/goals/propose',
    'body: { "source": "factory_idle", "candidates": [',
    '  { "title": "ゴール名", "summary": "1-2行の説明", "metric": "指標名", "target": 目標値, "current": 現在値, "priority": "P0|P1|P2", "rationale": "なぜ今これを提案するか" }',
    '] }',
  ].join('\n')
}

/**
 * 承認待ちの提案ゴールが上限未満なら、ゴール提案を依頼する（プロンプトを返す）。
 * 既に上限以上の proposed がある場合は依頼しない（承認を促す）。
 */
export async function requestGoalProposalIfIdle(): Promise<GoalProposalRequest> {
  const data = await readGoals()
  const pending = data.goals.filter((g) => g.status === 'proposed')
  if (pending.length >= MAX_PENDING_PROPOSALS) {
    return {
      requested: false,
      reason: `承認待ちのゴール提案が${pending.length}件あるため新規提案は依頼しない（Inboxで承認/却下してください）`,
      pendingCount: pending.length,
    }
  }
  const activeTitles = data.goals.filter((g) => g.status === 'active').map((g) => g.title)
  return {
    requested: true,
    reason: '実行できる作業が無いため、次に目指すゴールの提案をAIに依頼します（承認後に自動実行対象になります）',
    prompt: buildProposalPrompt(activeTitles),
    pendingCount: pending.length,
  }
}
