# 自動実行レビュー02: GoalTodo管理 棚卸し（Fableレビュー / claude）

## 1. GoalTodo管理の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: data/real/goals.json 内の goal.todos[]（goal.phases[] と phaseId で紐付け）。GoalTodo専用の独立ファイルは無い。
- 派生ビュー: 自動実行キュー(lib/auto-queue.ts toGoalTodoItem→workItemId `todo:<id>` type goal_todo)、goal-planner画面のTodoリスト、calcGoalProgress/calcPhaseProgressの進捗集計。いずれも永続化しないメモリ派生。
- 実行時に更新されるファイル: goals.json のみ。Todo 1件の更新でも writeGoals でファイル全体を書き換える。加えて syncGoalTodoStatuses は project-tasks.json を読み取り参照する（書き込みは goals.json 側のみ）。

## 2. GoalTodo管理の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: POST /api/goals（action分岐で appendGoalTodos / updateGoalTodo）、POST /api/goals/sync（syncGoalTodoStatuses: project-tasks.jsonのタスク状態→Todo状態へ同期）、POST /api/auto-queue/control・reorder（queueControl更新）。
- 画面: /goal-planner（Todo追加・状態変更・並び替え）、/queue（goal_todoアイテムの操作）。
- 自動起動経路: source=ai_generated/goal_resume/review_fix のTodo自動追加、goal-step-epic によるTodo→Epic化（relatedTodoIds=sourceTodoId記録）、Epic done時の goal-completion-sync markRelatedTodosDone、Factoryスケジュール中の syncGoalTodoStatuses。
- 出口の状態遷移: pending → active → done / skipped（GoalTodoStatus 4値）。Epic完了経由のdone化と、ユーザー手動のdone/skippedがある。

## 3. GoalTodo管理が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- appendGoalTodos/updateGoalTodo は Goal/Todo が見つからないと throw → API 500 で停止（呼び出し元にエラー表示）。
- syncGoalTodoStatuses は project-tasks.json が読めない場合 silent に {synced:0} を返し、同期失敗が表示に出ない（気付けない）。
- 未反映: relatedTodoIds が付かない経路（手動作成Epic・recommended-epics承認Epic等）で Epic done になっても対応Todoは done にならず残留する。これが『Todo消化漏れ』の残存経路で、goal-plannerで古いTodoが残ることでしか気付けない。
- 重複: appendGoalTodos は同一タイトルのTodo重複を検知しない。genId('gtodo')でID衝突はほぼ無いが、AI生成Todoの内容重複はそのまま蓄積される。
- 状態未知値は pickTodoStatus が黙って fallback（pending/現状維持）に矯正し、エラーにならない。

## 4. GoalTodo管理についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】Todo消化の完全性が relatedTodoIds 依存。goal-step-epic 経由以外で作られた Epic の完了では markRelatedTodosDone が空振りし、Todoが永久にpendingで残る。横断漏れ『あり』と判定（本レビューシリーズの主題であるTodo消化漏れそのものの残存経路）。
- 【中】syncGoalTodoStatuses のマッピングは task done 以外を active/pending へ戻すため、一度 done にしたTodoが task 側の状態次第で active に逆戻りする。完了の巻き戻しが自動発生し得るが通知は無い。
- 【中】normalizeGoal は todos を Array.isArray のみで素通しするため、壊れたTodo（title欠落・不正status）が検証されず保持される。goals.json 直編集やスキーマ変更時の破損に気付けない。
- 【低】Todo 1件更新で goals.json 全体を書き換えるため、Goal管理(レビュー01)と同じ非アトミック書き込み・lost update リスクを共有する。
- 【低】syncGoalTodoStatuses は taskId を持つTodoのみ対象で、taskId無しTodo（大半のAI生成Todo）は同期対象外。仕組みが二系統（taskId同期 / relatedTodoIds同期）あり、どちらにも乗らないTodoは手動でしか閉じない。

