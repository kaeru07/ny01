# 自動実行レビュー32: JSON書き込み整合性 棚卸し（Fableレビュー / claude）

## 1. JSON書き込み整合性の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 永続化の唯一の共通経路が lib/store.ts の readJson/writeJson/appendNdjson。data/real配下の全JSON(goals/epics/execution-runs/approvals/recommended-epics/monetization/skills/prompt-queue/urgent-issues等)と、goal-writer/execution-run-writerなど個別writerもこの薄いラッパーか同等のfs.writeFile直書きを使う。書き込みモジュールは20以上。
- 派生ビュー: 全機能がこのJSON群の読み書きに依存。
- 実行時に更新されるファイル: data/real配下全JSON。追記型はoperational-decisions.ndjson/usage-log.ndjson/automation logのみ(これらは追記で比較的安全)。

## 2. JSON書き込み整合性の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 全書き込みAPI。writeJsonは filePath へ JSON.stringify(data,null,2) を fs.writeFile で直接上書きする(1関数)。
- 画面: 該当なし(基盤層)。
- 自動起動経路: Factory実行・スケジュール前段・API操作・手動作業がそれぞれ独立にwriteJsonを呼ぶ。同期・排他の制御は無い。
- 出口の状態遷移: read(全件)→メモリ上でmodify→write(全件上書き)。この read-modify-write が排他無しで並行実行されると、後勝ちで片方の更新が消える(lost update)。

## 3. JSON書き込み整合性が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 破損: fs.writeFileは書き込み途中でプロセスが落ちると内容が中途半端なファイルを残す(tmp+renameのアトミック置換をしていない)。JSON構文が壊れるとreadJsonがcatchでfallback(空)を返し、次のwriteで全消失に至る破壊連鎖が成立する。
- lost update: ロックが無いため、例: 16:00スケジュール起動のFactoryがepics.jsonを書いている最中に、手動done化API(本レビュー作業自体がこれを実行)やキュー操作が同じepics.jsonをread-modify-writeすると、どちらかの変更が消える。本レビュー中も23:00起動と手動done化が並走した(実害は出なかったが窓は存在)。
- 全消失: readJson/readGoalsのcatch→空返却→write上書きは、破損だけでなく一時的なread失敗(I/O瞬断等)でも発火しうる。
- 影響範囲: この3欠陥は特定機能でなく永続化基盤の性質なので、レビュー01(goals全消失)、03(epics全消失)、05(queueControl競合)、09(スケジュールとの競合)、12(execution-runs全件書き換え)で個別に指摘した問題は、すべてこの1箇所の是正で根本的に軽減する。

## 4. JSON書き込み整合性についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】非アトミック書き込み。writeJsonをtmp書き込み+fs.renameに変えるだけ(数行)で、破損リスクが大幅に下がる。単一修正で全ストアに効くため費用対効果が本シリーズ最大級。
- 【高】排他制御の不在。read-modify-writeの並行実行はデータ規模と書き込み主体が増えるほど顕在化する。proper-lockfileかシリアルキューの導入を推奨。
- 【中】read失敗と空の非区別。writeガード(直前readが失敗/空なら書かない)で全消失連鎖を断てる。
- 【中】全件書き換え方式そのもの。execution-runsのような大きく育つファイルはappend型(ndjson)への移行も選択肢。
- 横断漏れ有無: 本項目は横断漏れの『供給源』。Todo消化漏れをはじめ本シリーズで繰り返し現れた『状態が実態を反映しない』事象の物理的下地がこの書き込み整合性の弱さにある。最終まとめで最優先の構造課題として扱う。

