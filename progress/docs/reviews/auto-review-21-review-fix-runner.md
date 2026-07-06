# 自動実行レビュー21: Review Fix Runner 棚卸し（Fableレビュー / claude）

## 1. Review Fix Runnerの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 入力はexecution-runs.jsonのneeds_followup+fixPrompt付きRun(レビュー19)。実行ロジックはlib/review-fix-runner.ts。出力はfollowup Run(source=review_fix/followupOfRunId/dispatchMode)と元RunのreviewStatus更新。設定はautomation config(factoryEnabled)。
- 派生ビュー: スケジュールenvelope Runの[review-fix]集計行、/factoryのReview Fix実行数、キューのfixRequestedフラグ解除。
- 実行時に更新されるファイル: execution-runs.json(followup Run追加+元Runのパッチ)、修正作業自体による対象ファイル変更。

## 2. Review Fix Runnerの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: スケジュール起動(runScheduledFactory)がFactory本体より先に必ず呼ぶ(mode auto/confirm/maxItems=1)。手動・dry_runモードあり(dry_runはreservedとして記録のみ)。
- 画面: /factory(実行結果)、Inbox(元Runのメモ更新)。
- 自動起動経路: 1日4回のスケジュールで最古の修正依頼から処理。maxItemsは上限2にクランプ。
- 出口の状態遷移: 対象Run→(危険語判定blocked: メモ追記+needs_followup維持)/(dry_run: reserved)/(実行: completed・partial→元Runをreviewed化+メモに followupRunId 記録、failed→skippedで次回再試行)。

## 3. Review Fix Runnerが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: アダプタ例外・failedはskippedとして次回スケジュールで再試行される(fixPromptが残るため復元可能・良好)。blockedは理由がreviewMemoに追記され人手対応を促す(良好)。
- 誤cwd疑い: getAdapter('claude').run({cwd: opts.cwd})でスケジュール経路はcwd未指定のためprocess.cwd()(progressアプリ)で実行される。targetAppが他アプリのRunへの修正依頼でも、claude CLIはprogressディレクトリで起動されプロンプト内のtargetApp記載だけが頼り。factory-runnerがresolveAppCwd(targetApp)で作業ディレクトリを解決しているのと非対称で、他アプリ修正の実効性が疑わしい。
- 未反映: partial(未完了)でも元Runがreviewed化され、修正依頼の残件が消える(レビュー19で記録したfixPrompt喪失の実装箇所)。
- 上限時: claude専用でfallback無し。Claude上限中はすべてskippedになり、修正依頼だけが処理されない時間帯が生じる(Auto Resumeの対象はEpicでありfix依頼は含まれない点も確認)。

## 4. Review Fix RunnerについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】cwd未解決の疑い。progress以外のアプリに対する修正依頼が機能していない可能性があり、実データでの検証(過去のreview_fix Runのchangedfiles確認)を最優先で行うべき。
- 【中】partial→reviewed化によるfixPrompt喪失(レビュー19と同一問題の実装箇所特定)。
- 【中】Claude上限時に修正依頼が全skippedとなる空白。修正はコンテキストが小さくCodex適格な場合が多いはずで、fallback適用の費用対効果は高い。
- 【低】dry_runのreserved followup Runが実行記録に混ざる。集計(実行統計)でreservedを除外しているかは要確認。
- 横断漏れ有無: 『あり』— 誤cwdが事実なら『修正を依頼したのに別の場所で作業していた』というTodo消化漏れの最悪型。検証を次アクション最優先に指定する。

