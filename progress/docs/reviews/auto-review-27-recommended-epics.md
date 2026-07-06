# 自動実行レビュー27: Recommended Epics 棚卸し（Fableレビュー / claude）

## 1. Recommended Epicsの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: recommended-epics.json(RecommendedEpic: id/kind/sourceRef/title/goalId/status suggested→epic_created/dismissed/expired、history[]追記、dedupeKey=kind+sourceRef)。ロジックはlib/recommended-epics-store.ts。生成元はKnowledgeループ(レビュー20)・修正候補(followup)・generateRecommendationsの複数kind。
- 派生ビュー: /recommended-epics画面(承認・却下)、Inboxの候補数、スケジュールenvelopeの候補整理集計。
- 実行時に更新されるファイル: recommended-epics.json、承認時にepics.json(createEpic)とoperational-decisions.ndjson(判断記録)。

## 2. Recommended Epicsの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: GET /api/recommended-epics、POST /api/recommended-epics/[id]/approve(人間承認のみ・重複409)、[id]のPATCH(却下等)、bulk-status(一括)。
- 画面: /recommended-epics。
- 自動起動経路: 生成はAI一次レビュー後のKnowledgeループとスケジュール前段のbackfill/generate。整理はexpireStaleRecommendations(suggestedのまま30日で自動expired+history記録)。承認の自動化は明示的に禁止(コメント明記)。
- 出口の状態遷移: suggested→(人間承認)epic_created→Epic管理へ / dismissed(却下) / expired(30日)。全遷移がhistoryに追記され追跡可能。

## 3. Recommended Epicsが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: 承認の重複・二重登録は内部ブロック+409で明示され、判断はoperational-decisionsに記録される(可視性・安全性とも良好)。
- 滞留: suggestedの通知・棚卸し導線が弱く、ユーザーが/recommended-epicsを見なければ30日後にexpiredで静かに消える。良い候補の機会損失がexpire件数としてしか見えない。
- Goal未設定: 承認時のgoalIdは任意で、候補にもgoalIdが無い場合はGoal未設定Epicが生成され、Factory選定のblocked_by_goal_unset(レビュー07)で止まる連鎖がある。
- 重複: dedupeKeyはkind+sourceRefのため、同じ改善内容がKnowledge由来とfollowup由来で別候補として並ぶことがあり、一括承認すると重複Epic化する(レビュー03の意味的重複と同根)。

## 4. Recommended EpicsについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【低】本機能は『自動承認しない・重複ブロック・全履歴追記・自動expire』と安全設計の見本になっており、大きな欠陥は見当たらない。以下は運用改善レベル。
- 【中】suggested滞留の不可視。放置されたproposed/pausedゴール整理(goal-mqv6ei9w)と同じ『静かに溜まる』問題で、ダイジェスト通知が共通対策。
- 【中】Goal未設定Epicの生成経路。承認UI側でgoalId選択を必須化すれば閉じられる。
- 【低】意味的重複の束ね表示(類似調査ゴール自動まとめgoal-mqluko5i-xsi3pと同一の課題)。
- 横断漏れ有無: 実質『なし』(候補→承認→Epic化→判断記録の各段で記録が残る)。強いて挙げれば expired の理由が候補品質か放置かを区別できない点が観察課題。

