# 自動実行レビュー24: Urgent Issues 棚卸し（Fableレビュー / claude）

## 1. Urgent Issuesの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 検知ロジックはlib/urgent-issues.ts detectUrgentIssues(毎回再計算・重み付きランク)。スナップショットはrecordUrgentIssuesがurgent-issues.jsonへ書き込み+automation log記録。入力はautomation config/自動実行キュー/goals.json/execution-runs.json/承認待ち。
- 派生ビュー: ホーム画面の緊急課題表示、/factoryの状態表示。
- 実行時に更新されるファイル: urgent-issues.json、automation log(recordUrgentIssues経由、factory-runnerから呼ばれる)。

## 2. Urgent Issuesの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 表示は検知関数の直呼び(ホームのサーバコンポーネント想定)。記録はFactory実行時のrecordUrgentIssues。
- 画面: /(ホーム)の緊急課題カード、各issueのactionHref(該当画面への導線付き・良好)。
- 自動起動経路: Factory実行のたびに記録。検知種別: (1)Factory OFF=high (2)実行可能0件=high (3)アプリ作成Goal停滞N日=high (4)失敗Run未対応=high (5)ブロック中=medium (6)今日の判断滞留=medium (7)ゴール1週間停滞=medium。
- 出口の状態遷移: issueに状態は無く毎回再計算(解消すれば自然に消える)。ack/スヌーズ/既読の概念なし。

## 3. Urgent Issuesが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: 検知自体の失敗はFactoryを止めない。検知漏れが最大のリスク。
- 死んだ検知: (4)失敗Run未対応は『failed かつ reviewStatus=not_reviewed/needs_followup』を数えるが、AI一次レビュー(Factory実行毎に自動実行)はfailedのRunを即『reviewed』へ遷移させる(VERDICT_TO_REVIEW_STATUS.failed='reviewed')。つまり検知が発火できるのはAIレビューbatch前の一瞬だけで、通常運用ではカウント0のまま。レビュー08のヘッドブロッキング+レビュー17の失敗行き場空白と合わせて、『失敗が誰にも見えない』三重の死角が完成してしまっている。
- 未反映: issueはスナップショット上書きのため、過去に何が警告されていたかの履歴はautomation logの断片のみ。
- 重複: ackが無いため解消されない限り毎回同じ警告が出続ける(慣れによる無視=アラート疲れのリスク)。

## 4. Urgent IssuesについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】失敗未対応検知の無効化。失敗系の安全網が(a)Factory停止のstopReason (b)AIレビューの分類 (c)Urgentアラートの3層とも機能不全(a=停止するだけ b=reviewed化で非表示 c=bに依存して発火せず)。失敗Runの取り扱い設計をレビュー17の次アクションと合わせて最優先で決めるべき。
- 【中】ack機構の不在。medium系(判断滞留・ゴール停滞)は慢性化しやすく、警告が常時表示されると重要なhighが埋もれる。
- 【低】検知の閾値(停滞日数等)がコード内固定でチューニング導線が無い。
- 【低】記録タイミングがFactory実行時のみで、Factory OFF時は(1)のOFF警告を記録する機会自体が減る(表示はされるが履歴に残りにくい)。
- 横断漏れ有無: 『あり』— 死んだ検知はTodo消化漏れの検知器自身が壊れているケースで、本レビューシリーズの目的(見落としが同種の状態反映漏れとして起きないか)に対する最重要の発見の一つ。

