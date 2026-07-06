# 自動実行レビュー12: 実行記録 棚卸し（Fableレビュー / claude）

## 1. 実行記録の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: data/real/execution-runs.json（{runs:[]}）。300件超で execution-run-archive が archive/execution-runs-YYYYMM.json へローテーション（スケジュール起動の前段0.6で実行）。書き込みは lib/execution-run-writer.ts（addExecutionRun/updateExecutionRunFields/updateReviewStatus）で全件read→push/patch→全件write。
- 派生ビュー: Inbox（未レビューRun）、/activity・/report・/daily の履歴表示、doneCriteria判定エンジンの入力(直近run群)、factory-metrics/closedLoopRate等の集計。
- 実行時に更新されるファイル: execution-runs.json（Run本体+後付けパッチ: stopReason/doneCriteriaStatus/source/trigger/reviewStatus）、ローテーション時にarchiveファイルと_backups/スナップショット。

## 2. 実行記録の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: POST /api/execution-runs（外部実行者=Claude Code/Codexの手動報告。必須: targetApp/targetTodoTitle/runStatus/summary/rawReport。epicId無指定時はtargetApp/targetTodoIdからresolveEpicIdで自動結合。reviewStatus=reviewedを指定しても強制的にnot_reviewedへ矯正=新規Runは必ずレビューに残す設計)、PATCH系（reviewStatus更新）。内部はfactory-runnerのrecordRun/finishRunningRun。
- 画面: Inbox・/activity・/report・/epic詳細の直近Run。
- 自動起動経路: Factory実行ループの各Run・envelope Run・スケジュールのsource/trigger後付けタグ。
- 出口の状態遷移: runStatus completed/partial/failed/running（lintゲートNGでcompleted→partial格下げあり）。reviewStatus not_reviewed→ai_reviewed系→reviewed（レビュー17の範囲）。アーカイブ後は正本から外れ、doneCriteria判定の対象外になる。

## 3. 実行記録が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: POSTのバリデーションNGは400、内部エラーは500で呼び出し元に返る。ただし外部実行者がPOSTを忘れた場合の検知は無く、『作業したのに記録が無い』は運用ルール(CLAUDE.local.mdのPOST必須)頼み。
- 未反映・汚染: executorアダプタのchangedFiles抽出はgit差分+出力テキストパースの和集合だが、parseChangedFilesFromOutputの正規表現が『ドット付き識別子』を広く拾い、実runでepic.goalId/v0.142.5/rec.history等の非ファイルが大量記録されているのを確認。changedFiles確実記録ゴール(goal-mqluko5f)の裏で過剰記録が進行しており、doneCriteriaのL2判定(ファイル一致率)も汚染される。
- 重複: generateRunIdが factory-runner(ミリ秒付き+unique確認)/factory-schedule/auto-resume/APIルート等に重複定義され形式不統一。POST経由は重複チェックが無く、同秒の2POSTで同一runIdが並存し得る（updateExecutionRunFieldsは最初の1件しかパッチしない）。
- 全件read-modify-write+非アトミック書き込みのため、Factory実行とAPI POSTの並行で lost update が起きうる（レビュー01/03と同根）。

## 4. 実行記録についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】changedFilesのゴミ記録。記録の信頼性がdoneCriteria判定・レビュー・Activity Miningすべての土台であるため、抽出精度の改善は優先度高。『確実に記録する』ゴールは量でなく質の問題に移っている。
- 【中】runId生成の重複定義と形式不揃い（秒のみ/ミリ秒付き）。衝突時の挙動が経路により異なり、レビュー状態のパッチ先誤りという静かな不整合を生みうる。
- 【中】execution-runs.jsonの全件書き換え方式。1Run追加でもファイル全体を書くため、並行書き込み窓が広い。追記型(ndjson)への移行かロック導入が構造的対策。
- 【低】アーカイブ後のRunはdoneCriteria判定から消えるため、長寿命Epic(300件超経過)は過去の達成実績を失い判定がcontinueへ戻る可能性がある。
- 横断漏れ有無: 『あり』— changedFiles過剰記録という逆向きの反映異常と、POST忘れ検知の不在。Run自体の記録経路は網羅的で、Factory系の記録漏れは確認されず。

