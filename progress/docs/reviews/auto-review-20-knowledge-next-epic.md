# 自動実行レビュー20: Knowledge/Next Epic生成 棚卸し（Fableレビュー / claude）

## 1. Knowledge/Next Epic生成の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: knowledge-records.json（KnowledgeRecord: id/sourceRunId/sourceEpicId/goalId/summary/learnings/nextActions/changedFiles/vaultReviewPath/researchPath）。生成ロジックは lib/knowledge-loop.ts。二次出力として obsidian-sync-vault/20_reviews と 06_research のmdファイル、Vault decision logへの追記、recommended-epics.json のNext Epic候補(buildRecommendation)。
- 派生ビュー: closedLoopRate(getLoopClosureReport→factory-metrics→goal-execution-review-loopのcurrent)、/report・/guideのKnowledge表示、recommended-epicsの承認画面。
- 実行時に更新されるファイル: knowledge-records.json、recommended-epics.json、Vault側md 2ファイル+decision log、goals.json(metric同期経由)。

## 2. Knowledge/Next Epic生成の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: runKnowledgeLoopForRunId/runKnowledgeLoopForReviewedRun(AI一次レビューのreviewed判定直後に自動)、generateFollowupRecommendationForRun(partial時の修正候補)。スケジュール前段のbackfillReviewedKnowledgeLoop/backfillFollowupRecommendationsが取りこぼしを毎回補完。healLoopClosureが閉ループ修復。
- 画面: /recommended-epics(Next Epic候補の承認)、/report(Knowledge一覧)。
- 自動起動経路: AI一次レビューでreviewedになった全Run+スケジュール前段のbackfill(1日4回)。
- 出口の状態遷移: Run(reviewed)→KnowledgeRecord作成(sourceRunId重複時は既存返却で冪等)→RecommendedEpic(status suggested)→人間の承認でcreateEpic→通常のEpic管理へ。suggestedが古くなるとexpireStaleRecommendationsで期限切れ。

## 3. Knowledge/Next Epic生成が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: Knowledgeループ失敗はrunAiReviewBatch内で握られFactoryは止まらないが、スケジュール前段のbackfillが次回以降補完する(取りこぼし防止の二重化は良好)。
- 未反映: Vault md書き込み(writeVaultKnowledge)はobsidian-sync-vault直書きで、ob sync停止中(2026-06-13〜)のためiPhone側へは反映されない。GitHubミラー(obsidian-vault)への反映は手動運用のrsync+push頼みで、knowledge-loopの自動出力分はミラー漏れが蓄積しうる。
- 質の限界: learnings/doneCriteriaはrunのsummary/rawReport先頭行からのヒューリスティック抽出(inferLearnings)で、実質『報告の切り貼り』。Knowledge=長期資産としての検索性・再利用性は低く、Activity Mining用途には前処理が必要。
- 重複: sourceRunId単位の存在チェックで冪等(良好)。RecommendedEpicも既存チェックあり。decision log追記は追記専用で重複追記の可能性が理論上あるがbackfillはKnowledge存在で止まるため実害小。

## 4. Knowledge/Next Epic生成についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】Knowledge質の浅さ。閉ループの器(生成→承認→Epic化→実行)は完成しているが、流れる中身がテンプレ抽出のため、Next Epic候補の妥当性が元Runの報告品質に完全依存する。閉ループ率(47.8%)を上げる前に中身の質を決める判断が必要。
- 【中】Vault出力の同期断絶。ob sync停止中の運用変更(GitHubミラーは継続)がknowledge-loopの自動出力には適用されておらず、『Vaultに書いたのに誰にも届かない』状態。Todo消化漏れと同型の反映漏れとして記録。
- 【低】Vault書き込みはfs.writeFile直書きで、Vault側のフォルダ構成変更に弱い(パスがprocess.cwd()相対のハードコード)。
- 【低】expireStaleRecommendationsの期限切れ基準と、ユーザーが後から見返したい候補の保存性のバランスは要観察。
- 横断漏れ有無: 『あり』— Vaultミラー漏れ。閉ループ自体の取りこぼしはbackfill二重化で塞がれており、構造は本レビューシリーズ中で最も堅牢な部類。

