# 自動実行レビュー01: Goal管理 棚卸し（Fableレビュー / claude）

## 1. Goal管理の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: data/real/goals.json（トップレベル {goals[], mainGoalId, updatedAt}）。読み取りは lib/goal-reader.ts readGoals()、書き込みは lib/goal-writer.ts writeGoals()。
- 派生ビュー: rankGoals()/calcGoalProgress()/goalAchievement()/findNorthStarGoal() 等はすべてメモリ上の派生で永続化しない。自動実行キュー(lib/auto-queue.ts)・goal-dashboard・goal-planner が goals.json から派生表示。
- 実行時に更新されるファイル: goals.json のみ（lastSelectedRunId/lastSelectedAt/autonomyNotify* がFactory実行時に更新される）。Goal metric は goal-metric-sync が current/metricSyncedAt を更新。

## 2. Goal管理の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: GET/POST/PATCH /api/goals、PATCH /api/goals/[goalId]、POST /api/goals/propose（AI提案）、propose-research、triage-research、sync（syncGoalTodoStatuses）、sync-metrics、main（メインゴール設定）、link-project、enrich-proposals。
- 画面: /goal-planner（一覧・操作）、/goal-dashboard（達成率）、/approvals（proposedゴールの承認）、/decide。
- 自動起動経路: Factory実行ループの propagateEpicDoneToGoal（Epic done→Goal todo/phase同期）、goal-proposal（調査由来の自動提案→proposed投入）、スケジュールrunの goal-metric-sync。
- 出口の状態遷移: proposed→active（setGoalApproval approve）/dropped（reject）。active→paused/done/dropped/archived（PATCH または完了同期）。done化は goal-completion-sync 経由でも発生。

## 3. Goal管理が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- goals.json がパース不能: readGoals は catch で EMPTY（goals:[]）を返し、エラーとして止まらない。画面はゴール0件表示で気付く…が、最悪ケースではそのまま writeGoals する経路（updateGoalControl 等の read-modify-write）で全ゴールが空で上書きされ、消失に気付くのは表示が空になった後。止まるべき所で止まらない。
- 未反映: normalizeGoal に列挙されていない新規フィールドは read→write のたびに脱落（過去に proposalSource 脱落事故）。status未知値は 'active' に矯正され、proposed の承認待ちが承認タブから消える型の事故が既知。
- 重複: normalizeGoal は id 無しゴールに goal-${Date.now()} を採番するため、同一ms内の複数ゴールで id 重複が理論上可能。重複検知の仕組みは無し。

## 4. Goal管理についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】readGoals 失敗→EMPTY→writeGoals の全消失経路。読込失敗と『本当に0件』を区別できない設計。
- 【高】writeGoals が fs.writeFile 直書きで非アトミック。クラッシュ・同時書き込みで goals.json 破損リスク。ロックも無くAPI/Factory並行で lost update が起きうる。
- 【中】VALID_STATUSES（goal-reader）と VALID_GOAL_STATUS（goal-writer）の二重定義。片方だけ更新すると読込時に active へ矯正される既知バグ型が再発しうる。
- 【中】normalizeGoal のフィールド列挙方式は『新フィールド追加漏れ=データ脱落』という横断漏れ（Todo消化漏れと同型: 書いたのに反映されない）を構造的に抱える。スプレッド保持+上書き方式への変更を検討すべき。
- 【低】description と summary が相互フォールバックで、どちらが正か曖昧。
- 横断漏れ有無: Todo消化漏れと同型の『状態反映漏れ』は normalizeGoal フィールド脱落・status矯正の2箇所に存在確認。goals.json 更新自体はAPI経由で一貫しており、複数書き込み主体（API/Factory/sync）の直列化だけが未保証。
