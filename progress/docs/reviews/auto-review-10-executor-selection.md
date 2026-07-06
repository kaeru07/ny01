# 自動実行レビュー10: Executor選択 棚卸し（Fableレビュー / claude）

## 1. Executor選択の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: lib/executor-roles.ts の EXECUTOR_ROLES テーブル（claude=基本実行者・codex=安全シグナル限定フォールバック・chatgpt/fable=レビュアーで自動実行不可・manual=人手。全ロール handlesDangerousOps=false固定）。Epic側の preferredExecutor/fallbackExecutor（epics.json）が個別指定の正本。危険判定は APPROVAL_REQUIRED_PATTERN（hard-deny正本）と CODEX_DENY_SIGNALS（operations-store側正本）の二段。
- 派生ビュー: buildDispatchPlan の executorCandidate/promptType、/factory の実行予定表示、run記録の executorUsed/preferredExecutor/fallbackExecutor/executorCandidate。
- 実行時に更新されるファイル: 選択自体は無書き込み。結果として execution-runs.json に executorUsed 等が記録される。

## 2. Executor選択の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 専用APIなし。factory-runner→buildDispatchPlan(factory-dispatch)内で毎Run判定。アダプタ実体は lib/executors/（claude.ts=claude -p非対話起動・codex.ts・manual・shell共通処理）。
- 画面: /factory・/epic のexecutor表示、/guide の役割分担説明。
- 自動起動経路: Factory実行ループの各Run前に自動判定。classifyCodexEligibility(goal+doneCriteria+nextActionsのテキスト)でCodex適格性を判定し、requiresClaude(preferredExecutor=claude かつ Codex不可)ならclaude、canRunOnCodexならpreferredExecutorに従いclaude/codexを選ぶ。
- 出口の状態遷移: executorCandidate=claude/codex/manual。decisionPolicy=manualはblocked(自動対象外)、危険シグナル該当は承認キューへ(routesToApprovalQueue)。選択後はアダプタrunの結果(completed/partial/failed/needs_manual+rateLimited)がRun記録に入る。

## 3. Executor選択が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: アダプタは exit code・timeout・rate limit文字列検知で status を判定し、rateLimited は failed + errorType=claude_rate_limited としてfallback評価(レビュー11)へ渡る。timeoutは partial。いずれもRun記録と/factoryのstopReasonで気付ける。
- 未反映: preferredExecutor=claude のEpicは codexEligible でもClaudeで実行される（executorCandidate = preferredExecutor==='claude' ? 'claude' : 'codex'）。goal-step-epicの既定もskill未定義時claudeのため、『実装はCodex優先』の運用方針(goal-mqncv7tw active)がEpic既定値レベルで徹底されず、Claude消費が想定より増える。
- 誤判定: 危険判定はテキストマッチのため、『削除』『認証』等を含むだけの調査・文言タスクが承認キューへ回る偽陽性、逆に言い換え表現が素通りする偽陰性の両方があり得る。rate limit検知(looksRateLimited)も出力文字列依存で、CLI側の文言変更で壊れる。
- 重複: 選択は毎Run独立で冪等。重複問題は無し。

## 4. Executor選択についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】Codex優先化方針とexecutorCandidate式の不整合。preferredExecutorの既定値がclaudeに倒れる経路が多く、Codex消費移行の実効性がskill定義依存になっている。実測(Executor別実行統計 goal-mqluko5k-zvsza)とセットで見直すべき。
- 【中】危険操作ゲートが正規表現2系統(APPROVAL_REQUIRED_PATTERN/CODEX_DENY_SIGNALS)のテキストマッチのみ。定期点検ゴール(goal-mqluko5l-zr0zg)の対象として、実行コマンドレベルの検査(実行前のコマンド解析)が無い点を記録。
- 【低】claudeアダプタ既定timeout 300秒。実装系Epicでは不足しpartial連発→doneCriteria不達→同一Epic再実行のループ要因になり得る（executorTimeoutMsで上書き可能だが既定が短い）。
- 【低】chatgpt/fableロールはcanAutoExecute=falseの表示専用定義で、Fableレビュー運用(レビュー用コピー)はシステム外の手動プロセスのまま。本レビューシリーズのような『Fableが直接棚卸しする』運用は役割表に無い形態で、役割正本の更新候補。
- 横断漏れ有無: Todo消化漏れ型は無し（選択は毎回再計算）。ただし役割正本(EXECUTOR_ROLES)と実運用(Codex優先化・Fable直接実行)のズレという『定義と実態の乖離』を記録。

