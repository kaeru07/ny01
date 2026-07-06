# 自動実行レビュー17: AI一次レビュー 棚卸し（Fableレビュー / claude）

## 1. AI一次レビューの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 分類ルールは lib/ai-review.ts のRISK_RULES(課金/公開デプロイ/認証秘密/本番DB/破壊的操作の5カテゴリ)・DECISION_RULES(方針判断系7パターン)・classifyRun。結果の正本は execution-runs.json の run.reviewStatus/reviewMemo/aiReview/reviewedAt。派生で approvals.json(needs_human時)・knowledge-records.json・recommended-epics.json(reviewed/partial時)。
- 派生ビュー: Inboxのレビュータブ、getAiReviewOverview(未レビュー件数・最古経過日数)、/decide(今日の判断)。
- 実行時に更新されるファイル: execution-runs.json(全対象Runへパッチ)、approvals.json、knowledge-records.json、recommended-epics.json、automation log。

## 2. AI一次レビューの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: runAiReviewBatch(limit既定10)。自動起動はFactory実行ループのbefore_pick/after_run毎(runAiReviewBatchSafely)とスケジュール前段。手動はInboxのレビュー操作(PATCH)。
- 画面: Inbox(レビュー一覧・AI判定理由表示)、/decide(needs_human分)。
- 自動起動経路: Factory実行のたびに未レビューRunが自動分類される。POST新規Runは必ずnot_reviewedで入る(レビュー12)ため、全Runがこの分類を通る設計。
- 出口の状態遷移: not_reviewed→(classifyRun)→ reviewed(clean_completed: Knowledge生成ループへ) / needs_human(危険語・判断要: Approval作成→今日の判断へ) / needs_followup(partial・errors・checks NG: 修正候補生成) / failed→reviewStatus'reviewed'(レビュータブから除外しキュー側処理へ委譲)。

## 3. AI一次レビューが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: バッチ自体の失敗はrunAiReviewBatchSafelyに握られFactoryを止めない(安全側)。分類の判定理由はreviewMemoとaiReviewに必ず残り追跡可能(良好)。
- 空白地帯: failed Runは『レビューに入れず、キュー側(失敗→blocked→今日の判断、または再キュー)で扱う』設計コメントだが、失敗Runの再拾い上げ/リトライ運用(goal-mqv6eie3)はproposedのまま未実装。現状failed Runはレビュータブにも修正候補にも出ず、run_failedでFactory停止(レビュー08)した後の追跡導線が『/factoryのstopReason表示』しかない。設計の前提と実装の進捗がずれている。
- 素通り: 危険語走査はtargetTodoTitle/summary/warnings/stopReasonのみでrawReport対象外(誤検知回避のための意図的判断)。ただし報告本文にのみ危険操作が書かれるケース(例: summaryは簡潔でrawReportに『.envを更新』等)は素通りしreviewedになり得る。
- 重複抑止の副作用: needs_humanのApproval作成は『同一runId または 同一epicId のpendingが既存』で抑止するため、長寿命Epicで1件のpendingが残っていると、別の新しい判断事項が今日の判断に上がらない。
- 未反映: reviewed判定でKnowledgeループが失敗した場合のリカバリはスケジュール前段のbackfillReviewedKnowledgeLoopが補完する(取りこぼし対策実装済み・良好)。

## 4. AI一次レビューについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】failed Runの行き場空白。ai-review側は『キューで扱う』、キュー側は『未実装(proposed)』で、責務の押し付け合いが空白になっている。失敗が続くEpicのヘッドブロッキング(レビュー08)と合わせ、失敗処理系全体の設計確定が最優先級。
- 【中】危険語走査のrawReport除外による素通り。summaryへの記載を実行者の善意に依存している。summary生成規約(危険操作は必ずsummaryに書く)の明文化かrawReportの限定走査(コマンド行のみ等)が緩和策。
- 【中】epicId単位の承認重複抑止による判断の取りこぼし。今日の判断に出るべき新規判断が静かに消える点で『判断のTodo消化漏れ』型。
- 【低】名称が『AI一次レビュー』だが実体はルールベースでLLM不使用。ユーザーの期待(内容の妥当性判断)と実際(メタデータ判定)のギャップは精度点検(goal-mqluko5i-hy3vf)の論点。
- 横断漏れ有無: 『あり』— failed Runの空白とepicId重複抑止の2点はTodo消化漏れと同型の『処理されるべきものが静かに消える』構造。reviewed→Knowledgeの取りこぼしはbackfillで塞がれており良好。

