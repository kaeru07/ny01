# 自動実行レビュー11: Codex fallback 棚卸し（Fableレビュー / claude）

## 1. Codex fallbackの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 判定ロジックは lib/executor-fallback.ts decideCodexFallback（純関数: claude試行×rateLimited×autoFallback ON×executorMode both/codex×requiresClaude無し×Codex許可、の全AND）と operations-store の evaluateAutoFallback / triggerAutoFallback。設定正本は automation config（autoFallback/executorMode）。結果は execution-runs.json（autoFallback/fallbackReason/executorUsed=codex）と automation log。
- 派生ビュー: /factory・/automation のfallback状況、Run一覧のexecutor表示。
- 実行時に更新されるファイル: execution-runs.json、automation log（追記専用ndjson）。fallback成功時はCodexアダプタの実行がepicのcwd配下ファイルを変更する。

## 2. Codex fallbackの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: Factory実行ループ内（claude rateLimited検知時に decideCodexFallback→OKなら generateCodexPrompt→codexアダプタで継続実行）。手動経路として triggerAutoFallback（claude-limit-detector からの検知起点）。
- 画面: /automation（Auto Fallback ON/OFF・executorMode設定）、/factory の実行結果。
- 自動起動経路: claude実行結果の rateLimited=true が唯一の自動トリガ。evaluateAutoFallback は 0)設定ゲート 1)承認待ち(最優先) 2)decisionPolicy非autonomous 3)対象作業のpending_approval/requiresClaude 4)次アクション候補の危険シグナル、の順に評価し、全通過で codex_ready+プロンプト生成、1つでも該当なら blocked と理由リストを返す。
- 出口の状態遷移: fallback成功→Codex実行が同一Epicの次Runとして継続（fallbackReason=claude_rate_limited記録）。fallback不可→finishRunningRunでclaude_rate_limited/Codex不可としてループ停止(rate_limited_no_codex)→Auto Resume(レビュー23)へ引き継ぎ。

## 3. Codex fallbackが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: fallback不可の理由はblocked[]として構造化され、automation logと/automationで確認できる（可視性は良好）。Codex実行自体の失敗は通常のrun_failed経路。
- 未反映・誤検知: rate limit検知(looksRateLimited)が標準出力の文字列パターン依存。Claude CLIの文言変更や英日混在で偽陰性になると、実際は上限なのにrun_failed停止としてfallbackが発動しない。逆に偽陽性なら不要なCodex切替が起きる。検知精度がfallback機構全体の信頼性を規定する。
- 過剰ブロック: evaluateAutoFallback の承認待ちゲートはepicId指定が無い場合『全承認待ち』を見るため、無関係なEpicの承認待ち1件でfallback全体がblockedになる。安全側だが、承認滞留(goal-mqluko5l-8jznd)があるとfallbackが常時不能になる連鎖がある。
- 重複: fallbackは1Run内で1回のみ評価され、多重切替は構造上起きない。

## 4. Codex fallbackについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】rate limit検知の文字列依存。fallback機構・Auto Resume・上限回復再開(goal-mqnyuqu7-7cean)がすべてこの検知精度に依存しているため、検知パターンの定期テスト（実際の上限出力サンプルでの回帰テスト）が無いのはリスク。
- 【中】承認待ちグローバルゲートとfallbackの結合。承認キューに古いpendingが残り続けると、Claude上限時に本来Codexで安全に流せる作業まで全部止まる。長期pendingアラート(goal-mqluko5l-8jznd)実装が緩和策。
- 【低】Codexへ渡す作業の安全判定はテキストベース(classifyCodexEligibility)で、レビュー07/10と同一の脆さを共有。
- 【低】fallback後のCodex実行品質はlintゲート+doneCriteria判定のみで、Codex特有の検証(実装方針の逸脱チェック等)は無い。設計検証をClaude側で行う運用(実装Codex/検証Claude)がコード上は強制されない。
- 横断漏れ有無: Todo消化漏れ型は無し。fallback発生の記録(autoFallback/fallbackReason)は全経路で残り記録漏れ無し。『検知漏れ(偽陰性)時に何も起きない』ことだけが構造的盲点として残る。

