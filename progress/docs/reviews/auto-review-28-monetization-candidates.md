# 自動実行レビュー28: Monetization candidates 棚卸し（Fableレビュー / claude）

## 1. Monetization candidatesの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: 収益化候補ストア(lib/monetization-store.ts: MonetizationCandidate、status遷移・researchLogs[]追記・isValidatedProjectCandidate判定)。取り込み元はobsidian-sync-vault配下のMarkdown(MONETIZATION_VAULT_PATH、読み取り専用・Vault側は書き換えない設計コメント明記)。ロジックはlib/monetization-vault-sync.ts。
- 派生ビュー: /monetization画面、Goal metric(validated_project_count→goal-value-validation-pipelineのcurrent)、キューへの収益化系Epic。
- 実行時に更新されるファイル: 候補ストアJSON、昇格時にepics.json(promoteToEpic)、Goal metric経由でgoals.json。

## 2. Monetization candidatesの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: /api/monetization(CRUD)、/api/monetization/sync(手動取り込み)。自動はスケジュール起動前段0)のsyncCandidatesFromVault(Factory ON/OFF・Blockedに関わらず毎回実行、追加のみで安全とコメント明記)。
- 画面: /monetization(候補一覧・調査ログ・Epic昇格)。
- 自動起動経路: スケジュール毎(1日4回)のVault走査。既存候補に同名が再登場した場合はresearchLogへ追記のみ(重複作成しない)。
- 出口の状態遷移: 候補作成→調査ログ蓄積→validated判定→promoteToEpicでEpic化(以降はEpic管理)→Goal metricのvalidated_project_countに反映。収益化候補とゴールの紐付け強化はgoal-mqluko5l-baa86で提案中。

## 3. Monetization candidatesが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: syncCandidatesFromVaultの失敗はrunScheduledFactory側の空catchで完全に握られ、成功時(added/updated>0)しかautomation logに残らない。Vaultパス変更・権限問題等で取り込みが止まっても気付けない(レビュー09で指摘した不可視失敗の代表例)。
- 重複: checkDuplicateとslugify+英語フレーズ抽出による名寄せは、候補名の表記ゆれ(かな/カナ・スペース有無)に弱く、同一アイデアが別候補として並びうる。逆に汎用的な英語フレーズが一致すると別アイデアが同一視されるリスクもある。
- 鮮度: Vault走査はVaultにMarkdownが増えることが前提だが、ob sync停止中(2026-06-13〜)はiPhone側からの調査メモ流入が無く、VPS上でVaultに書く主体(調査系の自動実行・手動作業)だけが供給源。供給が細っても取り込み0件は正常系と区別されない。
- 安全性: Vault読み取り専用・追加のみ・Factory状態に依存しない設計は堅牢(良好)。

## 4. Monetization candidatesについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】取り込み失敗の不可視(空catch)。収益化は最重要テーマ(monetizationImpact)であり、供給パイプの停止に気付けないのは機会損失が大きい。ログ1行の追加で解消。
- 【中】名寄せの弱さによる候補重複/誤同一視。候補が増えるほど顕在化するため、件数が少ない今のうちに判定ロジックの実測点検が安い。
- 【低】Vaultパスが環境変数フォールバック付きハードコード。Vault構成変更(フォルダリネーム判断待ち)と連動が必要。
- 【低】validated判定基準(isValidatedProjectCandidate)がGoal metricに直結するため、基準変更はmetricの連続性を壊す(変更時はdecision log必須)。
- 横断漏れ有無: 『あり』— 取り込み0件と取り込み失敗の区別不能は『動いていないのに正常に見える』型でTodo消化漏れと同型。Vault側を書き換えない相互上書き禁止設計は他機能への良い手本。

