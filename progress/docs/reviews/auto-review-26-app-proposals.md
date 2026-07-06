# 自動実行レビュー26: App proposals 棚卸し（Fableレビュー / claude）

## 1. App proposalsの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: アプリ案候補はapp factory candidates(getAppFactoryCandidates/addAppFactoryCandidate、lib/app-factory-candidates.ts)、決定済み案はapp-proposals(lib/app-proposals.ts、decision: approved/rejected/held/not_needed、pipelineStatus: queued/held/in_progress/blocked/completed)。生成はlib/app-proposal-generator.ts(シード収集→claude/codex CLI起動→JSON抽出、promptVersion=store-app-proposal-v2-market-observation)。設計詳細はapp-specs/app-designs系。
- 派生ビュー: /app-proposals(案の承認UI・詳細モーダル: MVP範囲/難易度/外部API/初期Goal案)、/app-designs(設計一覧)、決定済みタブの進行状態バッジ(goal-opus-pipeline-badges done)。
- 実行時に更新されるファイル: 候補ストア(app-factory-candidates)、app-proposals.json、automation log(app_proposal_generatedイベント)。

## 2. App proposalsの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: /api/app-proposals系(承認・却下・保留・詳細)、/api/app-specs系。自動生成の入口はスケジュール前段のensureDailyAppProposal(1日1件・JST日付で判定)。
- 画面: /app-proposals(日次案の判断)、/app-designs、/app-decisions。
- 自動起動経路: スケジュール起動前段(1日4回呼ばれるがisTodayJstで1日1回に制御)。シードはmarket-research/ai-news/収益化候補から収集し、市場観測(genres/monetizationHints/highlights)を添えてAI生成。AI失敗時はfallbackProposal(定型案)を必ず1件入れる。
- 出口の状態遷移: 候補→ユーザー判断(approved/rejected/held/not_needed)→approvedはアプリ開発ゴール(goal-app-*)や初期Goal案へ接続→pipelineStatus(queued→in_progress→blocked/completed)で進行管理。アプリ開発はストア公開仕様が完成条件(運用前提)。

## 3. App proposalsが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: 生成失敗はautomation logのapp_proposal_generated(mode=fallback)で記録され、fallback案が必ず投入されるため『案ゼロの日』は構造上発生しない(良好)。ただしensureDailyAppProposal自体の例外はスケジュール前段のcatchでdaily_app_proposal_failedとして記録される(レビュー09)。
- 枠の浪費: fallback案が投入された日はisTodayJstの existing 判定により、その日のAI再試行が行われない。AI生成が朝失敗すると、その日の案は定型fallbackで確定し、良い案の機会損失になる。
- 重い前段: 生成はclaude/codex CLIをprocess.cwd()で同期起動するため、スケジュール前段の所要時間が読めず、Factory本体の起動を遅らせる(レビュー09の直列前段問題の主要因)。
- 未反映: pipelineStatusとgoal-app-*ゴールの実進捗の同期は自動化が部分的で、開発が進んでもバッジがqueuedのまま残る型の表示ずれが起きうる(attachPipelineStatusesの結合条件依存)。
- 重複: 1日1回制御はJST日付で堅牢。ただしcandidatesが空でfallbackへ入る分岐でも複数proposalsが返るとMAX_AI_PROPOSALSまで複数件追加され、『1日1案』の運用前提(最低1案・良ければ複数)とは整合。

## 4. App proposalsについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】fallback案の枠消費。AI生成の失敗が『その日の提案品質の確定的低下』に直結する。fallback投入時はgenerated扱いにせず次回スケジュールで再試行し、成功したら差し替える方式が改善候補。
- 【中】スケジュール前段でのCLI同期起動。タイムアウト・失敗がFactory全体の起動遅延になる(レビュー09と合わせ、前段の非同期化/分離が構造対策)。
- 【低】promptVersionのバージョン管理は良い実践。ただし過去バージョンとの生成品質比較の仕組みは無い。
- 【低】pipelineStatusの手動更新依存箇所。アプリ開発自走ゴール(goal-mqnyuqu7-a2pp1)が進むほど表示ずれが目立つはず。
- 横断漏れ有無: 『あり』— pipelineStatusと実進捗のずれはTodo消化漏れ型。日次生成の記録(automation log)と1日1回制御は堅牢で生成漏れは無し。

