# 自動実行レビュー06: Goal/TodoのEpic化 棚卸し（Fableレビュー / claude）

## 1. Goal/TodoのEpic化の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 生成結果は epics.json（createEpic経由・epicId=epic-goalstep-<goalId>、衝突時base36サフィックス）。入力の正本は goals.json（goal/todo）と epics.json（open epic有無の判定）。
- 派生ビュー: 自動実行キューのgoal項目（『Goal達成が目的』行）はこの機能の予告表示。skill-select が epic に skillId を付与する。
- 実行時に更新されるファイル: epics.json のみ（goal側は書かない。relatedTodoIds に sourceTodoId を記録して消化はEpic完了後処理に委ねる）。

## 2. Goal/TodoのEpic化の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 専用APIなし。lib/factory-runner.ts のFactory実起動経路からのみ呼ばれる（ensureNextGoalStepEpic。表示・GET経路から呼ばない設計コメントあり＝表示のたびにEpicが増えない安全策）。
- 画面: 直接の画面なし。/queue のgoal項目と /epic の生成済みstep-epicで結果を確認。
- 自動起動経路: Factory実行ループが次作業にgoal/goal_todo項目を選んだ時に targetGoalId / sourceTodoId 付きで呼ぶ。無指定時は rankGoals 順で最上位の未達成active Goal 1件へ1Epicだけ生成（idempotent設計）。
- 出口の状態遷移: 生成Epicは常に status active で開始し、以降は通常のEpic管理(レビュー03)の遷移に乗る。対象外条件: goal非active / 達成100% / decisionPolicy manual・approval_required / 危険riskFlags / open epic保有。

## 3. Goal/TodoのEpic化が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 生成対象が無い場合は {created:false} で静かに終わる（正常系。Factory側のログで判別可能だがUI表示は無い）。
- 重複: OPEN_EPIC_STATUSES が active/approved/paused のみで、blocked や in_review のEpicを持つGoalは『open epic無し』と誤判定され、新しいstep-epicが追加生成される。blocked Epicが放置されたGoalでは同趣旨のEpicが複数並ぶ重複経路がある。
- 未反映: sourceTodoId 指定でも goal に open epic があると生成されず {created:false}。キュー上でTodoが次候補に見えているのに実行されない『見た目と実行のズレ』が起きうる（表示はTodo、実行はスキップ）。
- 無限生成: metric型Goal（target/current）で current が自動更新されない場合、step-epic 完了→Goal未達成→次のstep-epic…と成果の無い生成が続く。空振り検知（成果物変化なしの自動停止）は改善ゴールとして提案中で未実装。

## 4. Goal/TodoのEpic化についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】blocked/in_review Epic保有Goalへの重複step-epic生成。OPEN_EPIC_STATUSESの定義漏れが原因で、Epic管理(レビュー03)の『状態孤立』と組み合わさると重複が蓄積する。
- 【中】metric非連動Goalのstep-epic無限生成。1回ごとにClaude/Codex実行コストが発生するため、空振り自動停止(goal-mqv6eihx)の実装優先度を上げるべき。
- 【低】epicIdが固定プレフィクス+goalIdで、2回目以降はサフィックス付与。過去のstep-epicとのrun履歴連結はepicIdが変わるため分断される（Goal単位の履歴追跡はgoalIdで可能なので致命的ではない）。
- 【低】doneCriteriaのデフォルト文言は検証可能な形に整っているが、sourceTodo由来のcriteriaが『〜を確認する』型だとdoneCriteria判定エンジン(レビュー13)のchangedFiles必須分岐に落ちて完了できない事例を本レビュー実施中に確認済み。
- 横断漏れ有無: Todo消化漏れ型として『キューにTodoが見えるのにopen epic存在で実行されない』ズレを記録。生成自体の反映漏れは無し（createEpic直書きで即キュー反映）。

