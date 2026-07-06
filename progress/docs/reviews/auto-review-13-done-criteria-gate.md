# 自動実行レビュー13: doneCriteria判定 棚卸し（Fableレビュー / claude）

## 1. doneCriteria判定の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 判定ロジックは lib/done-criteria.ts（evaluateDoneCriteria純関数+getDoneCriteriaForEpic）。入力の正本は epics.json の epic.doneCriteria[]（Epic Contract）と execution-runs.json の該当Epic Run群（checks/changedFiles/summary/rawReport上位数件）+承認待ち件数。判定結果自体は永続化されず毎回計算（新しい正本を作らない設計）。
- 派生ビュー: 自動実行キューの doneCriteriaDone/Total 表示、/epic 詳細のcriteria達成状況、Factory実行ループの epic done 判定。
- 実行時に更新されるファイル: 判定自体は無書き込み。結果としてFactoryが run.doneCriteriaStatus(done/continue) と stopReason を execution-runs.json にパッチし、done時は epics.json/goals.json 更新（レビュー15の範囲）。

## 2. doneCriteria判定の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: GET /api/operations/done-criteria?epicId=（副作用なし・確認用）。実運用の入口はFactory実行ループが各Run後に呼ぶ getDoneCriteriaForEpic。
- 画面: /epic 詳細・/queue のcriteria達成率。
- 自動起動経路: Factory実行ループのみ（判定done→Epic完了処理へ、continue→同一Epicで次Run）。
- 出口の状態遷移: verdict done（全criteria met）/ continue（1つでも未達）。判定レイヤーは L1=checksのbuild/typecheck/lint語判定 / meta=ExecutionRun記録・未承認ゼロ / L2=changedFilesパス一致率>=0.25 / L3=summary+rawReportとのbigram重なり(ファイル系文言はchangedFiles>0必須+一致率>=0.18、汎用は>=0.3)。

## 3. doneCriteria判定が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 判定不能: epic不在は404、doneCriteria空は hasContract:false で常にcontinue（完了しないEpicとして残り続ける。表示はcriteria 0/0）。
- 誤判定(本セッションで実測): (1)『〜ファイルを特定する』『〜画面を確認する』型の調査系criteriaは正規表現/変更|修正|追加|実装|作成|画面|ファイル|対応|削除/に該当しchangedFiles=0では永遠に未達→調査Epicがレポートをファイル化しない限り完了できない(レビュー01実行時に2/4で実証、レポートのdocs/reviews保存で回避)。(2)逆にrawReportへcriteria文言を引用するだけでbigram一致1.0となり、実作業ゼロでもL3が通る。(3)isOkの/(^|[^n])ok|pass|成功|✓|true/iは『not ok』『broken』等もOK判定する誤許容。
- 未反映: mergeChecksは『各キーを持つ最新run』採用のため、過去にlint OKがあれば以後のrunでchecks未記録でもOKが残存し、壊れた変更を見逃す。アーカイブローテーション後は過去runが判定対象から消えverdictがcontinueへ戻る可能性。
- 重複: 判定は冪等・毎回再計算で重複問題なし。

## 4. doneCriteria判定についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】調査系criteriaのchangedFiles必須問題。棚卸し・調査・判断系Epic（本レビューシリーズ含む）が構造的に完了不能で、『Epicが完了しても閉じない問題』(goal-mqrj2bqc)の一因である可能性が高い。criteria文言に依存した分岐条件がタスク種別と合っていない。
- 【高】自己引用によるL3すり抜け。AI実行者は報告にcriteria文言を自然に引用するため、実質的にL3は『報告を書いたか』の判定に近く、『作業が本当に完了したか』を保証しない。doneCriteria精度点検(goal-mqluko5j-fvl4v)の主対象とすべき。
- 【中】isOkの誤許容正規表現。checksに失敗文字列が入ってもOK扱いになり、lintゲート(レビュー14)の信頼性を下げる。1行修正で直る。
- 【中】mergeChecksの古いOK残存。checksは『最新runに無ければ古い値』でなく『最新runの値が無ければ未評価』とする方が安全。
- 横断漏れ有無: 『あり』— 判定エンジンがタスク種別(実装系/調査系)を区別しないことによる完了不能と過剰完了の両方向の漏れ。これはTodo消化漏れと同じ『状態が実態を反映しない』型の根本原因の一つ。

