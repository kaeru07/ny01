# 自動実行レビュー07: Factory選定 棚卸し（Fableレビュー / claude）

## 1. Factory選定の正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 選定自体の独立正本は無い。入力は自動実行キュー(buildAutoQueue().executable)+epics.json+scanFactoryDispatch()の候補集合。選定結果は execution-runs.json の run.selection（selectedGoalKey/selectedReason/priority/decisionPolicy/riskFlags/selectedAt）と goals.json の lastSelectedRunId/lastSelectedAt（updateGoalSelectionPointer）に記録される。
- 派生ビュー: /factory の次回実行予定、ホームの近々実行、automation log（factory_goal_step_epic_created / factory_backpressure イベント）。
- 実行時に更新されるファイル: execution-runs.json（selection付きrun）、goals.json（選定ポインタ）、epics.json（goal/goal_todo項目選定時のstep-epic生成）。

## 2. Factory選定の入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 直接の選定APIは無く、Factory実行（スケジュール起動・手動起動）内の pickNextEpic が唯一の入口。参考表示として GET /api/auto-queue の next/candidates が同一順序を共有。
- 画面: /factory（次に何をやるかの予告と実行結果）、/queue（順序の操作はレビュー05の範囲）。
- 自動起動経路: スケジュール起動(systemd)のFactory実行ループ冒頭で毎回呼ばれる。auto+confirmモードでは goal/goal_todo 項目に対して ensureNextGoalStepEpic でEpic化してから選定する。
- 出口の状態遷移: 選定されたEpicは buildDispatchPlan の安全判定へ進み、safetyStatus ok→実行 / blocked→スキップして次候補 / 候補ゼロ→finalize（goal未設定Epicのみなら blocked_by_goal_unset で停止しautomation logに記録）。

## 3. Factory選定が失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 候補ゼロ: blocked_by_goal_unset などの停止理由付きでfinalizeされ、automation log と factoryのrun記録で気付ける（停止理由の可視化は比較的良好）。
- 未反映: goal_todo項目の非生成パス（open epic既存）では expectedEpicId=epic-goalstep-<goalId> の固定名参照が行われるが、createEpicはID衝突時サフィックスを付けるため、2代目以降のstep-epicは固定名と一致しない。さらに固定名の旧Epicがdoneだと rescan.candidates に無く選定スキップ→キューに見えているのに選ばれない状態が発生しうる。
- 重複: reviewPending（レビュー未確認）のEpicも『自動実行は継続』でexecutableに残るため、同一Epicがレビュー消化前に繰り返し選定される。レビュー滞留(goal-mqueb7b0)を増幅する構造。
- 選定理由はrun.selectionに毎回記録され、selection未記録問題は改善済み（goal-mqluko5g-il7nzの対象領域）。

## 4. Factory選定についてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】expectedEpicId固定名参照の綻び。step-epicの世代交代（done→新規サフィックス付き）後、goal_todo項目からの選定が空振りする。Todo消化漏れと同型の『キューに見えるのに進まない』横断漏れとして記録。
- 【中】Codex適格性判定(classifyCodexEligibility)がキーワードリスト（CODEX_ALLOW_SIGNALS/DENY_SIGNALS）ベース。文言の言い換えでdenyを素通りする可能性があり、安全ゲートとしては脆い。危険操作検知ルールの定期点検ゴール(goal-mqluko5l-zr0zg)と直結。
- 【中】レビュー未確認Epicの再選定制限が無い。未レビューrunが溜まるほど同系作業が積まれ、後からの一括レビュー負荷が増える。
- 【低】pickNextEpicはbuildAutoQueue+getEpics+scanFactoryDispatchを毎回全再構築し、Epic生成後にも再スキャンする。正しさ優先の設計で妥当だが、キュー件数増加時の実行開始遅延要因になる。
- 横断漏れ有無: 『あり』— expectedEpicId固定名参照のスキップ経路と、reviewPending再選定の2点。選定理由・選定ポインタの記録自体は全経路で行われており記録漏れは確認されず。

