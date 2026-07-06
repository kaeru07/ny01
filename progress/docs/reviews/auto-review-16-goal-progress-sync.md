# 自動実行レビュー16: Goal進捗同期 棚卸し（Fableレビュー / claude）

## 1. Goal進捗同期の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: goals.json の current/target/metric/metricDirection/metricSyncedAt。同期ロジックは lib/goal-metric-sync.ts（機械計測metricのみcurrentを自動更新、progress等の手動metricは上書きしない設計）と lib/goal-reader.ts goalAchievement（up: current/target、down: current<=targetで100%）。実測値の供給元は computeFactoryMetrics(closedLoopRate)と monetization-store(countValidatedProjectCandidates)。
- 派生ビュー: /goal-dashboard・キューのgoalProgress行・ホームの達成率表示。calcGoalProgress(Todo完了率)はtarget未設定Goalのフォールバック。
- 実行時に更新されるファイル: goals.json（current/metricSyncedAt、automation logに goalMetricSync イベント）。

## 2. Goal進捗同期の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 手動 POST /api/goals/sync-metrics。自動はスケジュール起動前段0.5b(syncGoalMetricsFromFactory、Knowledge補完直後に実行し新規分まで反映する順序設計)。
- 画面: /goal-dashboard(達成率)、/queue(goalProgress)、/(ホーム)。
- 自動起動経路: スケジュール起動のたび(1日4回)。machine-computable metric(closed_loop_rate/validated_project_count)を持つGoalのみ更新、それ以外はskippedカウント。
- 出口の状態遷移: current値の更新のみでstatusは変えない(Goal done化はレビュー15の完了同期側)。goalAchievement>=100のGoalはstep-epic生成対象外になる(レビュー06)ため、達成率の正確性が自動実行の駆動条件そのもの。

## 3. Goal進捗同期が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: metricValueForが未知metricでnullを返しskip(静かに対象外)。同期失敗はスケジュール前段の空catchに握られautomation logにも残らない場合がある(レビュー09で記録)。
- 誤計算(実データで確認): North Star『AI工場OS自走化』はmetric=daily_decision_minutes/target=15/current=60でmetricDirection未設定。『毎日の意思決定を15分以内に』という小さいほど良い指標だが、未設定時の既定はup扱いで60/15=400%→100%にクランプされ、達成率100%と表示される。さらにgoalAchievement>=100のためensureNextGoalStepEpicの自動前進対象から除外され、『North Starが達成済み扱いで自動実行が働かない』状態が実際に発生している。
- 不一致: Todo完了率はcalcGoalProgress(doneのみ)とauto-queueのbuildGoalProgress(done+skipped)で分子の定義が異なり、画面によって進捗%がずれる。
- 重複: 同期は冪等(値の上書き)で問題なし。

## 4. Goal進捗同期についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】North StarのmetricDirection未設定による達成率100%誤表示+自動前進停止(実データで現在進行中)。数字の見た目だけでなく自動実行の駆動を止めている実害があり、goals.jsonへの1フィールド追加で直る。normalizeGoalはmetricDirectionを保持するため設定すれば安定する。
- 【中】機械計測metricが2種のみで、他のGoal currentは手動更新頼み。放置するとレビュー15の早閉じ・レビュー06の無限生成の両方の入力が不正確になる。metric拡充か手動更新の定期リマインドが必要。
- 【中】同期実行がスケジュール前段の空catch圏内にあり、失敗の継続に気付けない(レビュー09と同根)。
- 【低】Todo完了率のskipped扱い不一致。進捗の見た目の信頼性問題。
- 横断漏れ有無: 『あり』— metricDirection未設定Goalの誤達成判定は『状態が実態を反映しない』型の実例で、Todo消化漏れよりも影響が大きい(自動実行が止まる)。既定値をdownに倒せないため、設定漏れ検知の仕組みが本質対策。

