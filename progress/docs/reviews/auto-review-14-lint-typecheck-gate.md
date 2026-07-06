# 自動実行レビュー14: lint/typecheckゲート 棚卸し（Fableレビュー / claude）

## 1. lint/typecheckゲートの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: ゲートロジックは lib/checks-gate.ts（依存ゼロ純関数: NG_CHECK_PATTERN/failingChecks/gateRunStatusByChecks、node --testでテスト可能な分離設計）と lib/checks-runner.ts（実コマンド実行: tsc --noEmit 180s / npm run lint 180s / npm run build 420s）。結果の正本は execution-runs.json の run.checks（typescript/lint/build = OK/NG）。
- 派生ビュー: doneCriteria判定のL1機械判定、Inbox/AI一次レビューのNGチェック表示、runStatusのpartial格下げ。
- 実行時に更新されるファイル: execution-runs.json（checks・格下げ後runStatus・lint_gate_blockedのstopReason）。チェック自体は対象アプリrepoで実行されるが何も書き換えない。

## 2. lint/typecheckゲートの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: 専用API無し。Factory実行ループが各Run後に runChecks(epicCwd, {typecheck:true, lint:true}) を呼ぶのが唯一の自動入口。外部実行者(Claude Code手動)はPOST時に checks を自己申告する。
- 画面: /epic・Inboxのchecks表示、/factoryのlint_gate_blocked停止理由。
- 自動起動経路: Factory実行ループ内のみ。lint NG時は doneCriteriaStatus=continue + stopReason=lint_gate_blocked で同一Epic継続(staleなら次Epicへ)、Epicはdoneにならない(『lint NGのrunを完了扱いにしない』goal-mqrj2c77の実装)。
- 出口の状態遷移: checks全OK→doneCriteria判定へ進む / NGあり→completedをpartialへ格下げ+要修正扱い。scaffold前(package.json/tsconfig無し)は誤NG回避のため空checksを返しゲート通過。

## 3. lint/typecheckゲートが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: コマンド非0終了・timeoutはNGとして記録され、partial格下げとlint_gate_blockedで可視化される（気付ける設計は良好）。
- 素通り: (1)buildはFactoryループのopts対象外で実行されない。tsc/lintが通ってもビルドが壊れるケース（next buildのみで発現するエラー・チャンク欠落等）はゲートを通過する。過去の/queue白画面事故の教訓『curl 200だけで完了にしない・クリーン再ビルド確認』がFactory自動実行には適用されていない。(2)lintスクリプト未定義のアプリはlint checkがundefinedのまま=ゲート対象外で素通り。skippedの明示記録が無いため『チェック済みでOK』と『チェックしていない』が区別できない。
- 語彙不一致: checks-gateのNG判定は/\b(ng|fail|failed|error)\b|エラー|失敗|✗/i、done-criteriaのOK判定は/(^|[^n])ok|pass|成功|✓|true/i。外部POSTの自由記述checks（例『0 errors』『not ok』）で両者の解釈が割れる（『0 errors』はNG扱い、『not ok』はOK扱いという逆転が起きうる）。
- 重複: ゲートは毎Run独立で冪等。問題なし。

## 4. lint/typecheckゲートについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【高】buildゲート不在。原則3(検証を完了条件に含める・buildは省略不可)とFactory自動実行の実態が乖離しており、UI系変更の自動完了は白画面型の退行を検出できない。最低限、progress自身への変更Runにはbuild必須が妥当。
- 【中】チェック不能とチェックOKの区別が無い（undefined=素通り）。lint未定義アプリが増えるほどゲートの実効範囲が縮む。skipped明示とアプリ別チェックプロファイルの可視化が対策。
- 【中】判定語彙の二重定義(NG_CHECK_PATTERN vs isOk)。同じchecksを見るのに合格判定が2つあるのはVALID_STATUSES二重定義(レビュー01)と同型の構造問題。
- 【低】チェックのtimeout(180s/420s)は大規模repoで不足しうる。timeout=NGは安全側だが、慢性的timeoutはlint_gate_blockedループを生む。
- 横断漏れ有無: 『あり』— build素通りとlint未定義素通り。『検証したことになっているが実は検証していない』というTodo消化漏れと同型の反映漏れとして記録。

