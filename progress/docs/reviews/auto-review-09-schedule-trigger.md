# 自動実行レビュー09: スケジュール起動 棚卸し（Fableレビュー / claude）

## 1. スケジュール起動の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: スケジュール定義の正本は systemd unit（docs/factory-schedule/factory-schedule.timer: OnCalendar 11:00/14:00/16:00/23:00 JST・Persistent=true取りこぼし1回実行、boot用serviceも別掲）。実行時状態は factory-schedule.lock（二重起動防止・stale奪取つき）。結果の正本は execution-runs.json のenvelope Run（source=schedule/boot, trigger=systemd/cron/startup）。
- 派生ビュー: /factory のスケジュール状況（factory-schedule-status）、automation log の factory_schedule イベント。
- 実行時に更新されるファイル: execution-runs.json（envelope+各Run+source/trigger後付けタグ）、前段処理経由で monetization候補・app-proposals・skills・recommended-epics・goals.json(metric sync)・アーカイブファイルまで広範囲。

## 2. スケジュール起動の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: runScheduledFactory（systemd service → shellスクリプト経由）。手動起動やboot起動も同一入口でsource/triggerだけ変わる。
- 画面: /factory（起動履歴と停止理由）、/logs（automation log）。
- 自動起動経路: systemd timer が1日4回発火。処理順は 0)収益化Vault取込→アプリ案1日1件補充→Skill整備→AI候補棚卸し(修正依頼backfill/期限切れ/Knowledgeループ補完)→Goal metric同期→run履歴アーカイブ → 1)Factory ON/OFF判定 → 2)lock取得 → 3)ReviewFix(max1)→runFactory(auto+confirm)→PromptQueue(max1) → 各RunへのsourceタグとEnvelope記録。
- 出口の状態遷移: factory_off / already_running はskipとしてenvelope Runに記録。正常時はrunsExecuted>0でcompleted、全て0ならpartialのenvelope Run。lockはfinallyで解放（stale奪取タイムアウトあり）。

## 3. スケジュール起動が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 二重起動: lock有効なら already_running でskipし、envelope Runと automation log 両方に残る（気付ける）。プロセス死亡でlockが残ってもstale奪取で自己回復する設計は良好。
- 失敗時: 前段処理は best-effort で、収益化sync・候補棚卸し・アーカイブ整理の失敗は完全な空catch（ログ無し）。アプリ案補充とSkill整備の失敗だけはautomation logに残る。つまり前段の一部は『失敗しても何の表示にも出ない』。
- 未反映: envelope Runの後付けsourceタグ(updateExecutionRunFields)はrunFactory完了後の一括処理のため、途中クラッシュするとsourceタグ無しRunが残る（どの起動由来か追跡不能になる）。
- 重複: Persistent=trueにより停止復帰後に取りこぼし1回だけ実行される仕様は明示されており重複起動はlockで防がれる。ただしlockは『スケジュール同士』の直列化であり、Claude Code/Codexの手動作業やAPI操作との書き込み競合は防がない（本レビュー実施中も16:00起動と手動done化が並走した）。

## 4. スケジュール起動についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】前段処理の空catch。収益化取込やKnowledgeループ補完が静かに失敗し続けても気付く手段が無い。Todo消化漏れと同型の『やったつもりで反映されていない』が最も起きやすい箇所。
- 【中】lockのスコープがスケジュール起動間のみ。epics.json/goals.jsonの書き込み主体は他にもあり（API・手動運用・Codex）、ファイルロックが無いためlost updateの可能性は残存（レビュー01/03/05と同根の横断課題）。
- 【低】1日4回の定時起動は『調査を常時(高頻度)実行する仕組みにする』(goal-mqnyuqu7-7mpo3 active)と乖離。頻度を上げる場合はmaxRuns=3キャップ(レビュー08)とlock stale時間の再調整が前提になる。
- 【低】前段処理が本体起動前に直列実行されるため、外部依存（Vault読込等）が遅いと定時起動全体が遅延する。
- 横断漏れ有無: 『あり』— 空catch箇所の失敗不可視と、途中クラッシュ時のsourceタグ欠落。envelope Runによる起動全件記録の設計自体は堅牢で、起動レベルの記録漏れは無し。

