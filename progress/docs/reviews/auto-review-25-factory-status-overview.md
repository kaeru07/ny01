# 自動実行レビュー25: Factory Status/Overview 棚卸し（Fableレビュー / claude）

## 1. Factory Status/Overviewの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 独立正本なし(全て派生)。入力はhealth summary/automation config/automation log/claude-limit検知/auto-resume評価/dispatch scan/execution-runs.json/自動実行キューの8系統。モジュールはlib/factory-status.ts(6状態+復旧アクション)、factory-overview.ts(表示用状態・最終Run・起動方法)、factory-dashboard.ts(ResumePacket/WIP警告/判断キュー)。
- 派生ビュー: /factory画面全体、ホームのFactory状態カード。
- 実行時に更新されるファイル: 無し(読み取り専用の表示系)。

## 2. Factory Status/Overviewの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: /api/operations/factory-status・factory-overview等のGET。画面は/factory。
- 自動起動経路: 表示要求のたびに再計算(キャッシュ無し)。
- 出口の状態遷移: 表示状態のみ。実行中(running Runあり)>承認待ち(候補ゼロかつpending)>停止中(Factory OFF)>再開待ち(上限検知+再開不可)>Codex準備完了>アイドル(候補あり)>停止中(候補なし・理由付き)の優先順位で決定。停止理由と復旧アクション(recoveryActions)を添えて人間語で返す設計は良好。

## 3. Factory Status/Overviewが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: 入力ソースの読込失敗は各libのフォールバック(空配列等)に吸収され、状態は『停止中/実行可能な作業がありません』側へ倒れる。破損と空の区別が付かない問題(レビュー04と同根)がここでも状態誤表示として現れる。
- 誤表示: health.running>0で無条件『実行中』となるため、クラッシュ等でrunStatus=runningのまま残ったRun(AI一次レビューはstale_runningとしてneeds_human化するが、判断されるまでの間)があると実際は止まっているのに実行中表示が続く。鮮度(開始からの経過時間)を見ていない。
- 脆さ: lastScheduleRunの特定が『source=schedule または targetTodoTitleにFactory scheduleを含む』で、タイトル文言変更で壊れる後方互換マッチが残る。
- 重複: factory-status/overview/dashboardがそれぞれ独自にrun集計・Epic開閉判定(isOpenEpic等)を持ち、定義ずれ(例: openの範囲)が起きても気付きにくい。
- 性能: computeFactoryStatusは1回の表示で全キュー再構築+上限検知(直近30run走査)+dispatch scanを直列に含み、run件数増で/factoryの表示が遅くなる構造。

## 4. Factory Status/OverviewについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】stale running Runによる『実行中』誤表示。自動実行が動いていると誤認しユーザーが介入を控える実害につながる。開始からN時間超のrunningは表示上『応答なし』に倒すべき。
- 【中】3モジュール並存による状態定義の分散。UI再配置(goal-opus-ui-reorg done)後も表示ロジックは統合されておらず、次のUI変更時の修正漏れ温床。
- 【低】タイトル文字列マッチの後方互換コード残存。
- 【低】表示のたびの重い再計算。page-data-cacheの適用対象候補。
- 横断漏れ有無: 『あり』— stale runningの誤表示は『状態が実態を反映しない』型。復旧アクション提示(recoveryActions)の設計自体は本システムで最も親切な部類で、他機能(レビュー04の空/破損区別等)にも展開する価値がある。

