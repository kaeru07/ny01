# 自動実行レビュー18: 今日の判断 棚卸し（Fableレビュー / claude）

## 1. 今日の判断の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: approvals.json（Approval: approvalId/epicId/title/category/options/recommended/status pending→decided/expired）。確定履歴は operational-decisions.ndjson（追記専用・decisionId=dec-<epoch>）。効果適用ロジックは lib/approval-effects.ts（retry承認/Goal一時停止/プロジェクトhold解除/Epic done化等をdecidedOptionに応じて実行）。
- 派生ビュー: /decide（今日の判断・ラウンドロビン表示で方針判断が埋もれない設計）、Inboxの承認待ちバッジ、buildDecisionContext（判断の文脈生成）。
- 実行時に更新されるファイル: approvals.json、operational-decisions.ndjson、決定に応じて epics.json（notes追記+効果適用でのstatus変更）、goals.json（pauseGoal等）。

## 2. 今日の判断の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: GET/POST /api/operations/approvals（POST=decideApproval+効果適用）、bulk-recommended（一括）、POST /api/operations/ensure-blocked-decisions（blocked状態から判断を自動起票）。作成側の入口は複数: AI一次レビューのneeds_human（危険語・判断要）、Factory実行のneedsApproval（executor_fallbackカテゴリ）、parseDecisionRequests（Run報告に埋め込まれた判断依頼）、goal-proposalの承認、手動起票。
- 画面: /decide（今日の判断）、/approvals、/pending。
- 自動起動経路: AI一次レビューのバッチ（Factory実行毎）とensureBlockedDecisions、スケジュール前段の期限切れ処理(expireStale系)。
- 出口の状態遷移: pending→decided（decidedOption/decidedBy/decidedAt記録+decision log追記+Epic notesに『[今日の判断 日付] タイトル→選択肢』を追記）→approval-effectsが実状態へ反映（retry/pause/hold解除/done化）。pendingが古くなるとexpired。判断結果が自動実行キューへ反映されることの確認はgoal-mqvpt6w4がactive。

## 3. 今日の判断が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: 対象approvalが無い/既決定なら404で気付ける。Epic notes追記失敗は空catchで握る（判断確定を優先する意図的設計・コメントあり）。
- 未反映リスク: decideApproval（状態確定）とapplyApprovalEffect（効果適用）が分離しており、API route側で順に呼ぶ構造。効果適用が失敗・スキップされてもapprovalはdecidedのままで、『判断したのに何も起きていない』状態が検出できない。適用結果(applied)がapprovals.jsonに残らないため後からの突合も不可。
- 重複: 承認の作成側で同一epicIdのpending存在チェックにより二重起票は抑止されるが、逆に別件の判断が抑止される副作用（レビュー17で記録）。decisionIdがDate.now()由来のため同msの二重決定でID衝突理論上あり。
- 期限切れ: 長期間pendingのアラートは未実装（goal-mqluko5l-8jznd proposed）。

## 4. 今日の判断についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】判断確定と効果適用の分離+適用結果の未記録。『今日の判断で決めたのにキューが変わらない』というユーザー体感の不具合(goal-mqvpt6w4の確認対象)の最有力原因構造。applied結果をapprovalへ書き戻すだけで検出可能になる。
- 【中】判断の入口が4系統以上あり、カテゴリ(multi_option/billing/secret等)の使い分けが暗黙的。判断系ルーティングの運用ルール(消す/方針選択はmulti_optionで今日の判断へ)がコードコメントと運用メモに分散しておりguide正本が無い。
- 【低】operational-decisions.ndjsonは追記専用で堅牢(良好)。ただし参照する画面が少なく、過去の判断の検索性が低い。
- 【低】Epic notesへの判断追記は便利だがnotesが無限に伸びる(judgment履歴の置き場としては不適切)。
- 横断漏れ有無: 『あり』— 効果適用の未記録は『判断のTodo消化漏れ』そのもの。決定ログ(ndjson)と実状態(epics/goals)の突合手段が無い点を最重要の横断漏れとして記録。

