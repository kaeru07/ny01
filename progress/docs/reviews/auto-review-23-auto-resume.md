# 自動実行レビュー23: Auto Resume 棚卸し（Fableレビュー / claude）

## 1. Auto Resumeの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 状態の独立正本は持たず毎回評価(evaluateAutoResume)。入力はautomation config(autoResume ON/OFF・executorMode)、evaluateAutoFallbackの安全ゲート結果、Epic契約(getFactoryEligibility)、直近の再開記録(getLastResumedAt=automation log)、再開可能作業数(countResumableSafeWork)。上限検知はclaude-limit-detector(execution-runs.jsonの構造化フィールドerrors/fallbackReasonのみ・時間窓内・重み付けhigh/medium/low)。
- 派生ビュー: /automation・/factoryのAuto Resume状態(paused/blocked/running/auto_resumed)、resumeContext(Codex再開プロンプト)。
- 実行時に更新されるファイル: triggerAutoResume時にexecution-runs.json(再開Run)とautomation log。評価のみでは無書き込み。

## 2. Auto Resumeの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: /api/operations/auto-resume(評価・トリガ)、/api/operations/claude-limit(検知)。
- 画面: /automation(設定と状態)、/factory。
- 自動起動経路: claude-limit-detectorの検知(detectClaudeLimit)→triggerAutoFallback/triggerAutoResume。rate_limited_no_codexでFactoryが停止した後の再開手段として位置付け。
- 出口の状態遷移: autoResume OFF→paused / 安全ゲートNG or Epic契約不足 or executor無し→blocked(理由付き) / 通過→running→トリガでauto_resumed+再開Run記録。再開executorはpickResumeExecutorでcodex固定(executorMode=claudeならundefined=再開不可)。

## 3. Auto Resumeが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: blockedは理由(blockedReasons/executorNote)が構造化されて返り、可視性は良好。検知はambiguous(上限か判定できない失敗)を安全側のblockedに倒す(暴走しない)。
- 未実装ギャップ: 機能名はAuto Resumeだが実体は『上限中にCodexで続きをやる』であり、『Claude上限が回復したらClaudeで再開する』(goal-mqnyuqu7-7cean active)の回復検知は存在しない。上限回復のプローブ・回復時トリガ・溜めた作業の一括再開のいずれも未実装で、ゴールと実装の名前空間が重なっているだけの状態。
- 構造的不可: executorMode=claude(Codex無効運用)では上限中の再開手段がゼロ。この場合の待機→回復→再開はユーザー手動のみ。
- 継承ブロック: evaluateAutoFallbackのグローバル承認待ちゲート(epicId無し評価時)を継承するため、無関係な承認滞留1件で再開全体がblockedになる(レビュー11と同根)。
- 重複: justTriggeredフラグで多重トリガの状態は区別されるが、連続トリガの抑止(クールダウン)は無し。

## 4. Auto ResumeについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】『上限回復時の自動再開』の不在。activeゴールの中核機能が未実装で、現状のAuto Resumeで代替できると誤認しやすい。ゴール側のスコープ定義(回復検知を作るのか、Codex継続で十分とするのか)を今日の判断に上げるべき。
- 【中】承認待ちグローバルゲート継承(レビュー11/17と同根の連鎖)。上限時こそ自動で進めたいのに、無関係な滞留で止まる。
- 【低】再開Run記録はあるが『何を再開したか』の粒度が粗く、再開後の完走率を測る仕組みが無い。
- 【低】検知の時間窓・重みの閾値は固定で、運用実績によるチューニング導線が無い。
- 横断漏れ有無: 『あり』— ゴール(回復時再開)と実装(上限中Codex継続)の意味ズレは、管理上『対応済みに見えるが未対応』となるTodo消化漏れ型の上位互換。検知・評価自体の記録は良好。

