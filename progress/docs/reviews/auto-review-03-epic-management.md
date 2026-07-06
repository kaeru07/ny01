# 自動実行レビュー03: Epic管理 棚卸し（Fableレビュー / claude）

## 1. Epic管理の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: data/real/epics.json（トップレベル配列）。読み書きは lib/operations-store.ts の getEpics/updateEpic/createEpic/decideEpicAction、共通の lib/store.ts readJson/writeJson 経由。
- 派生ビュー: getEpicDetail（直近Run結合）、自動実行キュー(lib/auto-queue.ts)のepicアイテム、factory-dashboard/factory-status、/epic 画面、generateHandoffView/generateCodexPrompt。すべてメモリ派生で永続化なし。
- 実行時に更新されるファイル: epics.json（Factory実行でstatus/progress/updatedAt、キュー操作でqueueControl）。Epic完了時は連動して goals.json（goal-completion-sync）も更新される。

## 2. Epic管理の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: GET/POST/PATCH /api/operations/epics（POSTはEpic Contract検証つきcreateEpic）、POST /api/auto-queue/control・reorder（queueControl）、recommended-epics承認API（承認→createEpic）。
- 画面: /epic（一覧・詳細）、/queue（キュー上のEpic操作）、/factory（実行状況）。
- 自動起動経路: goal-step-epic（Goal/TodoのEpic化・relatedTodoIds付与）、monetization-store（収益化候補→Epic）、factory-runner（実行後の status done / progress 100 更新）。
- 出口の状態遷移: createEpicは常に status 'active' で作成。decideEpicActionで approve→approved / reject・drop→dropped / pause→paused。Factory実行ループで doneCriteria 全達成→done。型上は proposed/approved/active/in_review/done/merged/split/dropped/paused/blocked の10値があるが、自動遷移するのは active→done 系のみで in_review/merged/split/blocked への遷移コードは主要経路に見当たらない（表示専用の疑い）。

## 3. Epic管理が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- epics.json がパース不能: readJson が catch で [] を返し止まらない。updateEpic は対象が見つからず null（無害）だが、createEpic は空配列に1件pushして全体を上書き保存するため、既存Epic全消失につながる。気付ける表示は /epic 一覧が突然1件になること以外に無い。
- 未反映: updateEpic はスプレッドマージなのでフィールド脱落は起きにくい（Goal管理のnormalizeGoalより安全）。ただし patch の内容検証が無く、不正な status 文字列もそのまま保存される。
- 重複: createEpic は epicId 衝突時にbase36サフィックスで回避するが、同一タイトル・同一目的のEpicの意味的重複は検知しない。recommended-epics の二重承認等で重複Epicが作られてもキューに両方並ぶ。
- 書き込みは writeJson の直書き（非アトミック・ロック無し）。Factory実行とAPI操作が並行すると lost update が起きうる。

## 4. Epic管理についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】epics.json 破損→getEpics []→createEpic 上書きの全消失経路（レビュー01のgoals.jsonと同型の構造問題。store層共通の欠陥）。
- 【中】EpicStatus 10値のうち自動遷移が実装されているのは一部のみ。in_review/merged/split/blocked は手動PATCHでしか入らず、入ると自動実行キューの対象判定から漏れて放置される可能性（『Epicが完了しても閉じない問題』の親戚として、閉じないまま見えなくなる状態値がある）。
- 【中】writeJson が非アトミック＋ロック無し。epics.json は Factory・API・キュー操作の3主体が書くため lost update の可能性が最も高いファイルの一つ。
- 【低】relatedTodoIds は goal-step-epic 経由でのみ付与され、他経路のEpicはTodo消化に接続されない（レビュー02と同一の横断漏れ。Epic側から見ても確認）。
- 【低】updatedAt はupdateEpicで常に上書きされるため、queueControl だけの変更でも『Epicが更新された』ように見え、実作業の鮮度判定を濁す。
- 横断漏れ有無: Todo消化漏れ型は relatedTodoIds 未付与経路として『あり』。加えて表示専用status値に入ったEpicがキュー・完了処理の両方から漏れる『状態孤立』のリスクを記録する。

