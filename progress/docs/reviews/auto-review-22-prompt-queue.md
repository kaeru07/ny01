# 自動実行レビュー22: Prompt Queue 棚卸し（Fableレビュー / claude）

## 1. Prompt Queueの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: data/real/prompt-queue.json（PromptQueueRegistry: items[]、status 12種: queued/reserved/not_started/running/completed/failed/needs_retry/needs_user_prompt_fix/needs_review/canceled/snoozed/archived）。ロジックはlib/prompt-queue.ts(CRUD+view+JSONインポート)とprompt-queue-runner.ts(実行)。
- 派生ビュー: buildPromptQueueView(projectランク・goal open状態で次候補を並べる)、/prompt-queue画面、スケジュールenvelope Runの[prompt-queue]集計。
- 実行時に更新されるファイル: prompt-queue.json(status遷移)、execution-runs.json(実行Run)、プロンプト実行による対象ファイル変更。

## 2. Prompt Queueの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: /api/prompt-queue系(追加・更新・アーカイブ・JSON一括インポート)。画面は/prompt-queue。
- 自動起動経路: スケジュール起動がFactory本体の後にrunPromptQueueDispatch(auto/confirm/maxItems=1)を呼ぶ。次候補はNEXT_CANDIDATE_STATUSES(queued/reserved/not_started/failed/needs_retry/needs_user_prompt_fix)からprojectランク順に選定。
- 出口の状態遷移: 実行成功→completed。失敗→failed(次回も候補に残る)。危険語(routesToApprovalQueue)→blocked。claude上限→codex fallback(runner内蔵)。canceled/snoozed/archived/completedはCLOSED扱いで候補から外れる。
- 実行: claudeアダプタ→rate limit時にcodexアダプタで同一プロンプトを再実行する二段構え。

## 3. Prompt Queueが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: failedはstatusと実行Runに残り、スケジュールenvelopeにも集計されるため気付ける。ただしfailedのまま候補に残り続けるため、プロンプト自体が壊れている場合は毎スケジュール(1日4回)同じ失敗を繰り返し、実行コストとRun記録が無限に増える。needs_user_prompt_fix(ユーザーの修正待ちを意味するステータス)も候補に含まれており、修正前に再実行される矛盾がある。
- 誤cwd: runnerのcwdはopts.cwd頼みでスケジュール経路は未指定=progress固定。プロンプトが他アプリを対象とする場合の実効性はレビュー21と同じ疑い。
- 未反映: needs_review/running等の中間ステータスからの自動遷移が無く、実行プロセスが落ちるとrunningのまま残る(AI一次レビューのstale_running検知はExecutionRun側のみでprompt-queue側は対象外)。
- 重複: 同一プロンプトの重複起票チェックは無い。インポート機能で同じJSONを2回読むと重複登録の可能性。

## 4. Prompt QueueについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】壊れたプロンプトの無限リトライ。連続失敗回数の記録すら無いため、空振り検知(goal-mqv6eihx)の実装対象にPrompt Queueも含めるべき。
- 【中】needs_user_prompt_fixが候補に残る設計矛盾。ユーザー修正待ちの意味が実装上機能していない。
- 【中】cwd未解決(レビュー21と同根)。プロンプト実行の作業ディレクトリが常にprogressで、対象アプリの指定はプロンプト文面依存。
- 【低】prompt-queue.jsonもwriteJson直書きで非アトミック(横断課題)。
- 【低】runningのまま取り残されたアイテムの回収機構が無い。
- 横断漏れ有無: 『あり』— needs_user_prompt_fixの無効化(状態が意味を持たない)とrunning放置は、状態が実態を反映しないTodo消化漏れ型。closedループ系(completed遷移とRun記録)は整合している。

