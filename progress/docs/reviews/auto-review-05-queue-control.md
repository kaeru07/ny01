# 自動実行レビュー05: キュー操作 棚卸し（Fableレビュー / claude）

## 1. キュー操作の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 操作結果は epics.json の epic.queueControl（pin/hold/exclude/manualOrder）と goals.json の goal.queueControl / todo.queueControl・todo.status に分散保存される。キュー操作専用の独立ファイルは無い。
- 派生ビュー: 自動実行キュー表示（レビュー04）が queueControl を読み、pinnedTop > priorityBoost > priority > 並び順のランキングに反映する。
- 実行時に更新されるファイル: epics.json / goals.json。moveUp/moveDown・reorder は executable 全件の manualOrder を再採番するため、1回の操作で epics.json の複数Epic + goals.json の複数Todo/Goalが同時更新される。

## 2. キュー操作の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: POST /api/auto-queue/control（workItemId=epic:*/todo:*/goal:* + action: pin/unpin/hold/unhold/exclude/include/prioritize/complete/moveUp/moveDown/setManualOrder）、POST /api/auto-queue/reorder（orderedWorkItemIds一括並び替え）。
- 画面: /queue のアイテム操作ボタン（ピン・保留・除外・完了・並び替え）、ホームのキュー操作導線。
- 自動起動経路: 無し（キュー操作はユーザー操作のみ。updatedBy:'user' が刻印される）。
- 出口の状態遷移: todo項目は complete→status done / include→pending / prioritize→priority high+pin。goal項目は pin/hold/exclude系のみ（complete は422）。epic項目は pin/unpin/hold/unhold/exclude/include/setManualOrder のみ実装。処理後は revalidatePath('/')('/queue') で画面再描画。

## 3. キュー操作が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 対象が見つからない場合: todo/goal は404、moveUp/moveDown で executable 外なら422で停止し、画面にエラーが返る。
- 【重要・未反映】epic項目への action='complete' と 'prioritize' は ACTIONS 配列に含まれ受理されるが、epic分岐の if/else に該当が無く patch={} のまま updateEpic が実行され success:true が返る。つまり『Epicを完了にする』『最優先にする』操作がサイレントに無効化され、ユーザーはどの表示でも気付けない（updatedAtだけ更新されキューに残り続ける）。goal項目のcompleteが明示422を返すのと非対称。
- 重複: 同じ操作の連打は queueControl の上書きで冪等。ただし reorder は getAutoQueueView の再構築中に別操作が入ると採番が古いスナップショット基準になる（順序の巻き戻り）。
- 書き込みは epics.json/goals.json の全体書き換えで、Factory実行中の status 更新と衝突すると lost update の可能性（レビュー01/03と同根）。

## 4. キュー操作についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】epic項目の complete/prioritize サイレント無効。『完了しても閉じない問題』(goal-mqrj2bqc)や『最優先ボタン追加』(goal-mqp5djzt)と直接関係する疑いがあり、Fableレビュー最優先で修正すべき。実装漏れがAPI成功応答で隠蔽される構造が根本問題。
- 【中】moveUp/moveDown が executable 全件を再採番するため、1操作の意図（2件入れ替え）に対し書き込み範囲が広く、並行するFactory書き込みとの競合面が最大化する。
- 【中】reorder が「見えているexecutableスナップショット」基準のため、キュー内容が変わった直後の並び替えは意図しない順序を保存しうる。
- 【低】操作はすべて updatedBy:'user' で記録されるが操作ログ（誰がいつ何を）が無く、意図しない状態になった時の遡及ができない。
- 横断漏れ有無: Todo消化漏れと同型の『操作したのに反映されない』が epic complete/prioritize に現存。これは表示上success扱いになるため発見が最も難しい型で、要修正として記録する。

