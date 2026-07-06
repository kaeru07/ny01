# 自動実行レビュー15: Epic完了後処理 棚卸し（Fableレビュー / claude）

## 1. Epic完了後処理の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 処理ロジックは lib/factory-runner.ts(doneCriteria done時の一連: updateEpic status done/progress 100→propagateEpicDoneToGoal→run patch)とlib/goal-completion-sync.ts applyCompletedEpicToGoalData(純関数・テストあり)。更新対象の正本は epics.json / goals.json / execution-runs.json。
- 派生ビュー: /goal-dashboard の達成率、キューからの消滅(CLOSED_EPIC_STATUSES)、factory-metricsのclosedLoopRate。
- 実行時に更新されるファイル: epics.json(status done+progress 100)、goals.json(relatedTodoIds→todo done化、フェーズ全done化、条件成立時goal自体のdone化+current=target埋め)、execution-runs.json(doneCriteriaStatus=done/stopReason=epic_done)。

## 2. Epic完了後処理の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 専用API無し。入口は2つ: (1)Factory実行ループのdoneCriteria verdict=done時 (2)approval-effects(承認操作の効果適用)からのpropagateEpicDoneToGoal。
- 画面: /epic(done表示)、/goal-planner(Todo消化反映)、/factory(epic_done停止理由)。
- 自動起動経路: Factory実行ループ内で自動。完了後は excludedEpics に登録→AI一次レビューbatch→pickNextEpicで次Epicへ。
- 出口の状態遷移: Epic active→done。Goal側は (a)relatedTodoIds該当Todo→done (b)全Todo done/skippedのフェーズ→done (c)goal-app-*以外で他open epic無し+自動(非human)Todo無しならGoal→done+current=target。goal非activeの場合は同期スキップ。

## 3. Epic完了後処理が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: propagateEpicDoneToGoalはgoal不在・非activeで静かにスキップ(結果オブジェクトは返るがFactory側で未使用)。Todo同期件数0は正常系と区別されず、relatedTodoIds未設定Epicの完了では何も同期されない(レビュー02/03で記録済みのTodo消化漏れ残存経路)。
- 早閉じ: goalCompleted判定はmetric達成度(goalAchievement)を参照しない。target=80/current=47のようなmetric型Goalでも、最後のopen epicが完了し自動Todoが無ければstatus doneになり、current=targetへ強制上書きされる。実達成47.8%のgoal-execution-review-loopのようなGoalが構造上早閉じし得る(現在は他のopen epic/todoが存在するため未発生)。
- 人手作業の宙吊り: hasOpenAutoTodoはrole=humanのTodoを除外するため、人手Todoが未完了でもGoalがdoneになる。done後のGoalはキュー・進捗ビューから消え、human Todoの存在自体が不可視になる。
- 重複: 同一Epicの二重done化は冪等(status上書きのみ)で無害。

## 4. Epic完了後処理についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】metric無視のGoal自動done+current=target上書き。達成率の正本を書き換えるため、『閉じたが実は未達』が数字上見えなくなる。Epic/ゴールが閉じない問題(goal-mqrj2bqc)の修正と逆方向の過修正リスクとして要注意。
- 【中】human役Todo残存でのGoal done化。人手作業(ストア公開・課金設定等)が残ったままGoalが閉じ、manual作業の追跡先が消える。Todo消化漏れの変種として記録。
- 【中】relatedTodoIds未設定Epicの完了時に何も起きない問題の影響がここに集約される(同期0件が正常扱い)。同期0件+goal配下に類似タイトルTodoありの場合に警告する仕組みが緩和策。
- 【低】propagateEpicDoneToGoalの結果(todoSynced/goalCompleted)がautomation logに残らず、後から『この完了で何が同期されたか』を追跡できない。
- 横断漏れ有無: 『あり』— human Todo宙吊り・metric無視早閉じ・relatedTodoIds未設定時の無同期の3点。いずれもTodo消化漏れと同型の『完了状態が実態を反映しない』問題として記録。

