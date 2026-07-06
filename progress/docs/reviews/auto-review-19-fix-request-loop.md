# 自動実行レビュー19: 修正依頼ループ 棚卸し（Fableレビュー / claude）

## 1. 修正依頼ループの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: execution-runs.json の run.reviewStatus='needs_followup' + run.fixPrompt/fixRequestedAt（人間がInboxで入力）。実行側は lib/review-fix-runner.ts。消費判定は source='review_fix'かつdispatchMode='auto'かつcompleted/partialのfollowup Run(followupOfRunId)の存在。
- 派生ビュー: キューのfixRequestedフラグ+REVIEW_FIX_SCORE_BOOST(優先度加点)、Inboxレビュータブの要修正表示、needs_followup処理状況の一覧化はgoal-mqluko5i-l4a3xで提案中。
- 実行時に更新されるファイル: execution-runs.json(修正Run追加+元Runとの紐付け)、修正作業自体による対象アプリのファイル変更。

## 2. 修正依頼ループの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 人間がInboxでfixPromptを入力(PATCH系)→スケジュール起動の runReviewFixDispatch(mode auto/confirm、maxItems=1)が自動実行。Factory本体より先に実行される(レビュー09の処理順)。
- 画面: Inboxレビュータブ(要修正入力)、/factory(review-fixの実行結果)。
- 自動起動経路: スケジュール起動毎に1件だけ、fixRequestedAt昇順(古い順)で処理。安全ゲートはroutesToApprovalQueue(title+fixPrompt)で危険語があればblocked。プロンプトには禁止事項(認証/課金/本番/deploy/secret/.env/migration/破壊的削除の禁止)が明記される(良好)。
- 出口の状態遷移: 対象Run(needs_followup)→修正Run実行(source=review_fix・followupOfRunId付き)→completed/partialで消費済み→キューのfixRequestedフラグ解除。blockedなら承認キューへ。

## 3. 修正依頼ループが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: 修正Runがfailedなら消費されず次回再試行される(安全)。blockedは理由付きで記録され気付ける。
- 早すぎる消費: 修正Runがpartial(未完了・lintゲート格下げ含む)でも消費済み扱いとなり、元の修正依頼はfixRequestedフラグが消える。『修正を依頼したが中途半端に終わり、そのまま完了扱い』というTodo消化漏れ型の穴。partialの修正RunはAI一次レビューで再びneeds_followupになる可能性があるが、fixPromptは引き継がれないため人間の指示が失われる。
- 滞留: maxItems=1×1日4回=最大4件/日の処理能力。レビュー滞留解消ゴール(goal-mqueb7b0)の未レビュー多数の状況では、修正依頼の消化が構造的に追いつかない。
- 二系統: fixPromptありはfix runner、なし(AI判定のpartial等)は修正候補(recommendation)生成と、similar名称で経路が異なる。UIでどちらに乗ったか判別しにくい。
- 重複: 手動実行の修正Run(dispatchMode!=auto)は消費判定に入らず、同じ依頼が自動でも再実行されうる軽微な重複経路。

## 4. 修正依頼ループについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】partial消費による人間指示の喪失。人間のfixPromptは最優先で扱う設計意図に対し、未完了でも1回で使い捨てになる実装は意図とずれている。completed限定+partial時の指示引き継ぎが対策。
- 【中】処理能力4件/日の上限。修正依頼が優先されるのは正しいが、滞留の可視化(何件待ち・最古何日)が無く、ユーザーは遅いとしか感じられない。
- 【低】手動修正Runの消費判定漏れによる重複実行。dispatchMode条件を外すか手動Runにもfollowup記録を促す。
- 【低】禁止事項はプロンプト内テキストで、実行側の強制ではない(実行者の遵守依存)。安全ゲートの実効性はレビュー10/31の論点と同根。
- 横断漏れ有無: 『あり』— partial消費でfixPromptが失われる点が本レビューシリーズの主題(Todo消化漏れ)と同型。needs_followupの処理状況一覧(goal-mqluko5i-l4a3x)の実装が検出手段として有効。

