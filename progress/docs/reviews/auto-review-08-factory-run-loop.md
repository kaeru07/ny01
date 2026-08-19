# 自動実行レビュー08: Factory実行ループ 棚卸し（Fableレビュー / claude）

## 1. Factory実行ループの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: ループ自体の正本は無く、実行のたびに execution-runs.json（各Run+Factory起動サマリRun）、epics.json（done/progress更新）、goals.json（完了同期・選定ポインタ）、approvals.json（needsApproval時）、automation log を更新する。設定は automation config（factoryMaxPerEpic等）とRunnerOptions。
- 派生ビュー: /factory 画面のFactoryRunReport（steps/stoppedReason/doneEpics）、factory-dashboard、factory-status。
- 実行時に更新されるファイル: 上記4系統のJSON+レポート。progress自身を変更した場合は finalize で self-heal（progress再ビルド系）を発火する。

## 2. Factory実行ループの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 専用エンドポイント経由（スケジュール起動=systemd、手動起動）。モードは dry_run（既定・実起動なし）/ manual / auto（confirm必須。無い場合 auto_requires_confirm で即終了）。
- 画面: /factory（実行結果とstopReason）、ホームの直近実行。
- 自動起動経路: factory-schedule（レビュー09の範囲）が定時に auto+confirm で起動。
- 出口の状態遷移: whileループ（既定無制限。env FACTORY_SAFETY_RUN_LIMIT 設定時のみ runs<safetyRunLimit で打ち切り）で 1 Run ごとに: needsApproval→承認キュー投入+Epic除外して次へ / result failed→run_failedで全体停止 / lintゲートNG→同一Epicでcontinue（staleなら次Epicへ） / doneCriteria done→Epic done化+Goal同期+次Epicへ / それ以外→同一Epicで次Run。終了時stoppedReason: completed/safety_run_limit_reached/all_epics_done/run_failed/rate_limited_no_codex/factory_off/blocked_by_danger_decision/blocked_by_goal_unset/no_candidate/all_blocked等が起動サマリRunに記録される。

## 3. Factory実行ループが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: result.status failed で stopReason=run_failed としてループ全体が即停止する。次Epicへは進まない。stopReasonはrun記録と/factoryで確認できるが、キュー先頭のEpicが失敗し続ける場合、以後の全スケジュール起動が同じEpicで停止し他の作業が一切進まない（ヘッドブロッキング）。失敗Runの再拾い上げ運用(goal-mqv6eie3)が提案中なのはこの緩和策。
- 反映済み: 旧実行件数パラメータの外部指定は runner/API/shell 経路から外し、スケジュール1起動あたりの実行件数を外部入力で制御しない。2026-07-19 の見直し（goal-mqrj2cbk）で `safetyRunLimit=3` 固定も撤廃し既定無制限（0）に変更。無限ループ防止は maxPerEpic + excludedEpics + stale検知が担い、保険として env FACTORY_SAFETY_RUN_LIMIT で上限を任意設定できる。
- 重複: needsApproval で除外したEpicはこの起動内では再選定されないが、次回起動では承認未処理のまま再度dispatch判定に入る（承認待ちが長期滞留すると毎回スキャンコストだけ発生）。
- rate limit時: Codex fallback可能なら継続、不可なら rate_limited_no_codex で停止し、Auto Resume(レビュー23)が回復時に再開する設計。

## 4. Factory実行ループについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】run_failedの全体停止によるヘッドブロッキング。失敗Epicの自動exclude/リトライ方針(goal-mqvknbs系提案)が無いため、1つの壊れたEpicがFactory全体を止め続ける。停止自体は安全側だが『次の安全な作業へ進む』というCLAUDE.mdの運用原則とはズレる。
- 【解消】旧実行件数パラメータの外部制御とゴール『最大件数の制御をなくす』の矛盾は、2026-07-19 に cap 自体を撤廃（既定無制限・env FACTORY_SAFETY_RUN_LIMIT で任意上限）して整理済み（goal-mqrj2cbk）。旧対応（3固定への名称変更のみ）は挙動が変わらず意図と不一致だったため修正。
- 【中】finalizeのself-heal(triggerProgressSelfHealIfNeeded)がfire-and-forgetで、成功・失敗がループのレポートに残らない。progress自己変更後の再起動失敗は次回起動の異常でしか気付けない。
- 反映済み: 同一Epicの深掘り上限はAutomation Configの`factoryMaxPerEpic`（1〜3、既定1）で調整可能。Runnerは実行時指定 > 保存設定 > 既定1の順で採用し、1を選ぶと1 Run後に当該Epicを今回の起動対象から外して次Epicへローテーションする。範囲外の値は1〜3に正規化される。
- 横断漏れ有無: Todo消化漏れ型として『ゴール(制御撤廃)がactiveなのに実装が未反映』という管理と実装のズレを記録。Run記録漏れは無し（needsApproval/failed/lintNGすべてrun記録が残る設計は良好）。
