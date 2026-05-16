interface PromptOptions {
  goal: string
  projectId: string
  projectName?: string
  monetizationFirst?: boolean
  phaseHint?: string
}

export function buildGoalDecomposePrompt(opts: PromptOptions): string {
  const { goal, projectId, projectName, monetizationFirst, phaseHint } = opts
  const projectLine = projectName ? `${projectName} (id: ${projectId})` : projectId
  const monetizationLine = monetizationFirst
    ? '- 収益化を最優先する。広告/課金/PR等に直結するタスクの優先度を上げる'
    : '- ユーザーが指定した目標を素直に分解する。収益化は副次的でよい'

  const hintLine = phaseHint?.trim()
    ? `\n- 参考フェーズ案: ${phaseHint.trim()}`
    : ''

  return `以下の目標を progress アプリの Goal Planner 用 JSON に分解してください。

# 目標
${goal}

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
}
