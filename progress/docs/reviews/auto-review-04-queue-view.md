# 自動実行レビュー04: 自動実行キュー表示 棚卸し（Fableレビュー / claude）

## 1. 自動実行キュー表示の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 無し（純粋な派生ビュー）。lib/auto-queue.ts buildAutoQueue が epics.json / goals.json / execution-runs.json / approvals.json / inbox を毎リクエスト読み合成する。generatedAt付きで永続化しない。
- 派生ビュー: next（先頭1件）/candidates（2〜4位の3件）/executable全件/waitingUser/held/aiHold/reviewWaiting/blocked/manual/pinnedExcluded/counts/goalProgress。
- 実行時に更新されるファイル: 表示自体は何も書かない（読み取り専用）。並び順・pinの変更は auto-queue/control・reorder 側で epics.json / goals.json の queueControl に書かれる（レビュー05の範囲）。

## 2. 自動実行キュー表示の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: GET /api/auto-queue（force-dynamic・キャッシュ無効）。
- 画面: /queue（メインのキュー画面）、/（ホームの近々実行予定）、/factory（実行状況からの参照）。
- 自動起動経路: Factory実行ループの次Epic選定が rankGoals ベースの同一順位付けを共有しており、表示と実行順が一致する設計。
- 出口の状態遷移: 表示アイテムの status は executable / waiting_user / held / ai_hold / review_waiting / blocked / manual の7分類に派生され、Epic側 status が done/merged/dropped/split（CLOSED_EPIC_STATUSES）になるとキューから消える。activeゴールのTodo（role!=human・未Epic化・未done/skipped）とitemゼロの未達成activeゴール自体もアイテム化される。

## 3. 自動実行キュー表示が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- ソースJSONがパース不能: readJson/readGoals が空を返すため、キューは静かに空表示になる。『作業ゼロ』と『データ破損』が画面上区別できず、気付く手段が無い（過去の/queue白画面事故とは別種の無症状障害）。
- API例外時: GET は500を返し、画面側のエラーハンドリング次第では白画面（2026-06-16の/queue白画面事故の既知経路。クリーン再ビルド+実描画確認が再発防止策として運用に入っている）。
- 未反映: 表示は毎回再構築のため反映漏れは起きにくいが、next+candidatesが先頭4件固定なので5位以下のピン済み項目は『キューに入っているのに見えない』状態になる（今回のレビューEpic32件ピンでも表示は4件のみ）。
- 重複: 同一workItemIdは executable と各分類でMap上書き整合が取られており表示重複は無い。ただしEpicとGoalTodoが同じ作業を指す場合（relatedTodoIds未設定）は2アイテムとして並ぶ。

## 4. 自動実行キュー表示についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】next/candidates=先頭4件のみで、大量ピン時に残りが見えない。ユーザーが『キューに全部入ったか』を確認できるのはexecutable全件リストだけで、UI導線が弱いと誤解の元。
- 【中】ソース破損→空キューの無症状障害。counts=0の空表示と破損の区別が構造的に不可能（store層のreadJson catchが原因。レビュー01/03と同根）。
- 【中】goal.status!='active'のゴール配下Todoは一切キューに載らない。pausedゴールを再開し忘れるとTodoごと不可視になる（Todo消化漏れと同型の『見えなくなる』横断漏れ、経路は異なる）。
- 【低】reviewPendingでも『自動実行は継続』でexecutableに残る設計。レビュー滞留があると未レビューのまま同系作業が積み重なる（既存の運用改善ゴールと一致する既知課題）。
- 【低】毎リクエスト全ファイル読込+O(N×M)合成でキャッシュ無し。現在の規模では問題ないがrunsアーカイブ肥大で遅くなる。
- 横断漏れ有無: Todo消化漏れ型として『非activeゴール配下Todoの不可視化』『Epic/Todo二重表示』を記録。表示自体の状態反映漏れは毎回再構築のため無し。

