# CLAUDE.local.md — ny01

company レベルの CLAUDE.md を継承しつつ、ny01 固有の運用ルールを定義する。

---

## 朝会モード — progress 正本運用

「朝会して」と言われた場合、company CLAUDE.md の手順に加えて **progress ファイルを優先情報源**として案件状況を把握する。

### 読む順番（ny01 では以下の順で読む）

1. `/root/company/apps/ny01/progress/.env.local` を確認し、`PROGRESS_DATA_PATH` を特定する
   - 設定あり → そのパス配下のファイルを読む
   - 未設定 → `/root/company/apps/ny01/progress/data/sample/` を読む
2. **`overall-progress.md`** — 全案件サマリー・Blockers・Next Action を把握する
3. **`app-progress.json`** — 案件ごとの currentTask / nextAction / status / progress / blockers を把握する
4. **`project-tasks.json`** — in_progress / todo タスクの優先度を確認する
5. **`work-log.ndjson`** の末尾 10 行 — 前回中断点・直近の完了を確認する
6. company 管理ファイル（today.md / priorities.md / active-projects.md）を補完参照する

> **競合時のルール**: progress ファイルと company 管理ファイルで状態が食い違う場合、**progress ファイルを優先**する。

---

### 朝会出力への progress データの対応

company CLAUDE.md の出力フォーマット（セクション 0〜8）を progress データで埋める。

| 出力セクション | progress からの情報源 |
|---|---|
| 0. 前回の危険作業・中断確認 | work-log.ndjson の末尾 / overall-progress.md の Blockers |
| 1. 今日の状況まとめ | overall-progress.md の Summary / In Progress |
| 2. 確認済みアプリ | app-progress.json の `status: in_progress` / `done` 案件 |
| 3. 未確認アプリ | app-progress.json の `status: active` 等・updatedAt が古い案件 |
| 4. 今日やるべき候補3件 | project-tasks.json の `in_progress` + `todo` を priority 順に3件 |
| 5. 最優先でやるべき1件 | blockers があれば blocker 解消を最優先。なければ進行中案件の nextAction |
| 6. その理由 | blockers の内容 / progress 値 / 直近 work-log のコンテキスト |
| 7. 実行できる作業プロンプト | 最優先案件の nextAction をそのまま起点にしたプロンプト |
| 8. 今日はやらない方がいいこと | blockers で止まっている案件 / status が active のまま長期停滞している案件 |

---

### 朝会モードの禁止事項（company CLAUDE.md に追加）

- progress ファイルを朝会中に書き換えない（読み取りのみ）
- currentTask / nextAction / work-log への追記は、集中作業モードに入ってから行う

---

## 集中作業モード — 正本情報源

「集中作業モード」と入力された場合、**会話ログではなく progress ファイルを正本**として作業を開始する。

### 正本ファイル群

| ファイル | 内容 |
|---|---|
| `overall-progress.md` | 全案件の人間向け要約・直近の完了・Blockers・Next Action |
| `app-progress.json` | 案件ごとの currentTask / nextAction / status / progress / blockers |
| `project-tasks.json` | 案件別タスク詳細（status: todo / in_progress / done） |
| `work-log.ndjson` | 作業ログ（1行1JSON、時系列） |

### データパスの決定手順

1. `/root/company/apps/ny01/progress/.env.local` を確認する
2. `PROGRESS_DATA_PATH` が設定されていれば、**そのパス配下のファイルを読む**
3. 未設定の場合は `/root/company/apps/ny01/progress/data/sample/` を読む

---

## 集中作業モード — 作業開始前の確認手順

progress ファイルを読み、以下を把握してから着手する。

1. **overall-progress.md** の「Claude が今すぐ着手できるタスク」セクションを確認する
   - 着手候補が明示されていればそこから選ぶ
   - セクションが古い場合は以下の手順で再導出する

2. **app-progress.json** を読む
   - 全案件の `currentTask` / `nextAction` / `blockers` を確認
   - `status: in_progress` の案件を列挙する
   - `status: user_action_pending` / `deploy_ready` の案件は Claude 不要と把握する
   - `blockers` に内容がある案件は「blocked」として把握する
   - `currentTask` / `nextAction` が **完了済みタスクを指していたら、先に更新する**（stale 検知）

3. **project-tasks.json** を読む
   - `status: in_progress` のタスクを確認する
   - `currentTask`（app-progress.json）と `in_progress` タスクが矛盾している場合は、**差分を意識して判断する**（タスク側を優先し、サマリーを更新候補とする）

4. **work-log.ndjson** の末尾 10 行程度を読む
   - 前回の中断点・チェックポイント・完了タスクを把握する

確認後、**着手前3問フィルタ**を通してから着手案件・タスクを1件選んで宣言する。

---

## 着手前3問フィルタ（タスク選定の必須チェック）

todo を抽出したら、着手前に必ずこの3問を確認する。**3問すべて YES のタスクだけを着手候補にする。**

| 問 | チェック内容 | NO の場合 |
|---|---|---|
| Q1 | task.status が `todo` / `in_progress` / `impl_done` / `local_done` か？ | スキップ |
| Q2 | project.blockers が空（[]）か？ | スキップして理由を記録 |
| Q3 | task.assignee が `"claude"` または `"both"` か？ | 「ユーザー操作待ち」として記録してスキップ |

**補足:**
- `assignee` フィールドがないタスクはデフォルト `"claude"` として扱う（後方互換）
- `impl_done` / `local_done` は「実装済みだが検証未完了」を示す。Claude が引き続き作業できる
- `user_action_pending` / `deploy_ready` の案件は Q3 で除外される

---

## 集中作業モード — work-queue スコープ制約（常時適用）

集中作業モードでは **常に `work-queue.json` を作業スコープとする**。トリガーワードに関わらず以下のルールを適用する。

### 着手対象の決定順序

1. **`work-queue.json`** を読む（パスは `PROGRESS_DATA_PATH` 配下 / 未設定なら `data/sample/`）
2. `status: "queued"` または `status: "in_progress"` のアイテムのみを作業対象とする
3. `autoOrder` の昇順（小さい数字から）に処理する
4. **work-queue が空になったら停止して報告する**

### 禁止事項

- `project-tasks.json` からのタスクへの**自発的な着手**（work-queue にないタスク）
- stale 解消・バックログ処理・UI微修正など、work-queue に入っていない作業
- work-queue アイテムの `taskPrompt` 以外の作業を同一サイクルで追加実施すること

### work-queue アイテムの完了処理

1. タスク処理後、該当 `work-queue.json` アイテムの `status` を `"done"` に更新する
2. `completedAt` に完了日時（ISO 8601）を記録する
3. `ExecutionRun` を POST する（`/api/execution-runs`）
4. 次の `status: "queued"` アイテムへ進む

### 1タスク1レビュー・1実行履歴の原則

集中作業モードでは **1 task = 1 review = 1 execution-run** を必須とする。

- work-queue の **1アイテムごと**に個別の完了報告・レビュー対象・`/api/execution-runs` POST を作成する
- `autoOrder` が複数ある場合でも、各 `autoOrder` を1件ずつ完了させ、1件ずつレビュー待ちに登録する
- 複数の work-queue アイテムを1つのレビュー用コピーにまとめてはいけない
- 複数の work-queue アイテムを1つの `ExecutionRun` や1回の `/api/execution-runs` POST にまとめてはいけない
- セッション全体のサマリーは補助情報であり、個別レビューや個別 `ExecutionRun` の代替にしてはいけない
- 1件目の `ExecutionRun` 登録と報告が完了してから、次の `queued` / `in_progress` アイテムへ進む

### 補足: work-queue が空の場合

- `project-tasks.json` から自発的にタスクを探さない
- 停止してユーザーに報告: 「work-queue が空です。/queue または /tasks から今日の作業を追加してください」

---

## 集中作業モード — progress 更新ルール

以下のタイミングで progress ファイルを更新する。チャット本文の報告は最小限にする。

| タイミング | 更新対象 |
|---|---|
| タスク着手時 | `project-tasks.json` の status を `in_progress` に変更 / `work-log.ndjson` に `task_started` を追記 |
| タスク完了時（**原則**） | task.status を `done` に変更すると同時に、同ステップで `app-progress.json` の `nextAction` を必ず更新する。「nextAction 更新なし = 更新未完了」として扱う |
| 実装完了・未検証時 | task.status を `impl_done` に変更。nextAction は更新しない（タスクはまだ作業中） |
| ローカル確認済み | task.status を `local_done` に変更。nextAction は更新しない（本番確認未完了） |
| チェックポイント時 | `work-log.ndjson` に `summary` を追記 / `app-progress.json` の状態を最新化 |
| 中断前・上限前 | **progress 更新を最優先**。`overall-progress.md` を更新し、`work-log.ndjson` に中断ログを追記する |
| セッション終了時 | 全案件の `app-progress.json` を最終状態に更新 / `overall-progress.md` の「着手可能タスク」「ユーザー待ち」セクションを再生成して更新する |

### nextAction の原子更新ルール

task.status を `done` にする更新と、`app-progress.json` の nextAction 更新は**必ず同一更新ステップで実行**する。

nextAction の決め方:
1. 残りタスクに `assignee=claude` の open タスクがある → そのタスク名を nextAction にする（priority 高優先）
2. ない、但し `assignee=user` の open タスクがある → `"ユーザー操作待ち: [タスク名]"`
3. 全タスク done → `"完了"`

### stale status の検知ルール

以下の条件に当てはまる案件は、実作業より先に stale を解消してから次へ進む:

- `app-progress.json` の nextAction が `project-tasks.json` で `done` のタスク名を指している
- `status: in_progress` かつ `project-tasks.json` の全タスクが `done`
- `progress: 100` かつ `status: in_progress`（→ `user_action_pending` または `deploy_ready` に変更する）

---

## progress ファイルの直接編集ルール

### JSON・NDJSON 更新（ファイル直接編集）

API が使えない場合（progress アプリが未起動など）は、ファイルを直接編集する。

- `app-progress.json`: `updatedAt` を更新する（ISO 8601 形式）
- `project-tasks.json`: `updatedAt` を更新する
- `work-log.ndjson`: 末尾に 1 行 JSON を追記する（改行のみ。既存行は変更しない）

work-log の追記フォーマット:
```json
{"time":"<ISO8601>","project":"<projectId>","type":"<type>","title":"<title>","detail":"<optional>"}
```

type の種類: `task_started` / `task_completed` / `task_status_updated` / `project_summary_updated` / `blocker_resolved` / `summary`

task.status の段階:
- `todo` → `in_progress` → `impl_done`（build 完了・未検証）→ `local_done`（ローカル確認済）→ `done`
- `done` への遷移時のみ nextAction の原子更新が必要

### API 経由で更新する場合（progress アプリ起動中）

| 操作 | エンドポイント |
|---|---|
| タスク追加 | `POST /api/tasks` |
| タスク status 更新 | `PATCH /api/tasks/[taskId]` |
| 案件サマリー更新 | `PATCH /api/projects/[projectId]` |

---

## 会話ログの位置付け

- progress ファイルがある案件では、**会話ログより progress を優先**する
- 会話ログは補助情報として参照してよいが、状態の正本は progress ファイル
- 進捗管理アプリの画面（ダッシュボード・案件詳細・タスク一覧・ログ画面）に表示される情報と整合するように運用する

---

## 集中作業モード — 確認最小化ルール

集中作業モード・/focus では、以下のルールで確認を最小化する。

### 確認してよいのは3ケースのみ

1. **破壊的変更**: 大量削除・DB破壊・本番データ上書き・外部公開条件の大幅変更
2. **要件競合**: progress と現在指示が明確に矛盾し、どちらを優先しても重要な副作用がある
3. **継続不能**: 必須ファイル不在・仮説では進められないレベルで情報不足

### 確認せず進めるもの（原則）

- UI改善・ファイル整理・軽微なリファクタ
- progress の `currentTask` / `nextAction` に沿った実装
- task status 更新・blockers がない案件の継続作業
- build / lint / 起動確認・progress 更新
- 既存方針に沿った実装詳細の決定
- 不明点は仮説を1行 work-log に記録して進める（質問で止まらない）

### 判断優先順位

1. progress ファイル（app-progress.json / project-tasks.json / overall-progress.md）
2. 既存コードと現在の実装状態
3. CLAUDE.local.md / company CLAUDE.md の運用ルール
4. 会話の直近指示
5. 妥当な仮説（上記で不足する場合）

### 出力形式

毎サイクルこの形式で短く報告する:

```
着手: <案件名> / <task名>
仮説: <あれば1行>
→ <完了したら結果1行>
progress: 更新済み
```

---

## company CLAUDE.md との関係

- company CLAUDE.md の role 分担・危険作業ルール・朝会ルールは引き続き有効
- 集中作業モードの「focus-work レポート」と progress ファイルは**併用**する
  - focus-work レポート: company 管理ファイルとしての作業ログ
  - progress ファイル: 進捗管理アプリの正本データ
- どちらかを省略する場合は、**progress ファイルを優先**して残す
- 確認最小化ルールは company CLAUDE.md の危険作業禁止ルールに優先しない

---

## progress 運用ドキュメント セット更新ルール（2026-06-11 追加）

progress アプリは「人間用の司令塔」であり、自分の使い方を 📖 運用ページ（`/guide`）で説明する。
**progress に対して機能追加・UI変更・運用変更を行った場合、必ず以下4点をセットで更新する**（1つでも欠けたら作業未完了扱い）:

1. 運用ページ `progress/app/guide/page.tsx` の該当セクション
2. 用語 `progress/lib/command-center.ts` の `TERMS`（新しい内部語を画面に出すなら人間語を必ず登録）
3. 図（運用ページの「今日の流れ」「AI工場の流れ」フロー図が実態とずれていないか確認・修正）
4. `progress/docs/operations/current-operating-model.md` の本文 + frontmatter（`updated` / `updateNote`）+ 変更履歴

- frontmatter の `updated` / `updateNote` は運用ページ最下部「最終更新」に動的表示される（画面側ハードコード禁止）
- 内部構造の複雑さをユーザーに見せない。新画面・新概念は必ず人間語に翻訳してから出す
