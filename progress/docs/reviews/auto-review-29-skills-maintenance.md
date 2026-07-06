# 自動実行レビュー29: Skills maintenance 棚卸し（Fableレビュー / claude）

## 1. Skills maintenanceの正本データ、派生ビュー、実行時に更新されるファイルを特定する
- 正本データ: skills.json(Skill: id/version/promptTemplate/procedure/preferredExecutor/riskFlags)、skill versions(バージョン履歴・変更理由・sourceRunId)、skill improvement candidates(pending/適用済み)。ロジックはlib/skill-store.ts(読み書き・normalize)、skill-select.ts(Epicへのスキル選定+プロンプトブロック生成)、skill-maintenance.ts(改善候補の自動生成)、skill-apply.ts(適用+バージョンアップ)。
- 派生ビュー: /skills画面、Runのskillld/skillVersion表示(実行トレーサビリティ)。
- 実行時に更新されるファイル: skills.json、skill versions、improvement candidates、Epicへのskill付与はepics.json。

## 2. Skills maintenanceの入口API/画面/自動起動経路と、出口の状態遷移を明記する
- 入口API: /api/skills系(一覧・適用)。自動はスケジュール前段のrunSkillMaintenance(失敗はskill_maintenance_failedとしてautomation logに記録される・レビュー09の前段では珍しくログありの部類)。
- 画面: /skills(スキル一覧・改善候補・適用)。
- 自動起動経路: 1日4回のスケジュールで直近7日のskillId付きRunを集計し、(1)failed率>=30%(母数3以上、50%以上でP0) (2)needs_followup3連続 等のルールで改善候補を生成。pending3件で生成停止(溢れ防止)。
- 出口の状態遷移: 候補pending→人間/APIの適用(applySkillImprovement)→skill.version+1のバージョン追記+noteに改善行を追加→以降のRunに新skillVersionが刻印される。

## 3. Skills maintenanceが失敗・未反映・重複した場合にどこで止まり、どの表示で気付けるかを確認する
- 失敗時: メンテナンス失敗はautomation logに残る(良好)。候補生成はダデュープ(既存id・同一skillのpending)で重複起票を防ぐ(良好)。
- 形式化: applySkillImprovementはバージョン履歴に旧promptTemplate/procedureをそのまま保存し、skill本体にはnote1行を追記するだけで、手順やプロンプトの実質的な改善は行われない。suggestedChangeも『手順のどこが失敗源か点検し、事前確認と失敗時の切り分け条件を明確化する』のような定型文で、適用してもRun品質が変わる根拠が無い。『改善したことになっている』状態。
- 盲点: 検知母数はskillId付きRunのみ。手動POST(Claude Code直接作業)やskill未選定Epicの失敗はスキル品質に反映されない。
- 重複: バージョン追記・候補生成とも冪等性は確保されている。

## 4. Skills maintenanceについてFableレビューに渡す怪しい観点と、Todo消化漏れのような横断漏れ有無を記録する
- 【中】スキル改善の形式化。Skills日次アップデート機構の器は完成しているが、中身の改善が定型文追記で、Knowledgeの浅さ(レビュー20)と同じ『ループは回るが質が乗らない』問題。改善内容のAI生成(失敗ログ→具体的手順修正)が本丸。
- 【低】pending3件キャップは溢れ防止に有効だが、3件が放置されると新しい検知が全て捨てられる(pendingの鮮度管理が無い)。
- 【低】skillIdの結合はresolveSkillForRun頼みで、手動Runの盲点が残る。
- 横断漏れ有無: 『あり』— 『改善適用済みだが実質変化なし』はTodo消化漏れの変種(処理済みフラグと実態の乖離)。バージョン履歴・sourceRunId記録などトレーサビリティ設計自体は良好。

