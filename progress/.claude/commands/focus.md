# /focus — 集中作業モード（progress 正本運用）

progress ファイルを正本として集中作業モードを開始する。
会話ログは補助扱い。以下の手順を順番に実行すること。

---

## Step 1: データパスの確認

`.env.local` を読み、`PROGRESS_DATA_PATH` を確認する。

- 設定あり → そのパス配下のファイルを正本として読む
- 未設定 → `data/sample/` を読む

以降の手順で「progress/」と書いた場合は、このパスを指す。

---

## Step 2: progress ファイルを読む（必須・この順番で）

1. `progress/overall-progress.md` — 全案件サマリー・Blockers・Next Action
2. `progress/app-progress.json` — 全案件の currentTask / nextAction / status / progress / blockers
3. `progress/project-tasks.json` — タスク一覧（status / priority ごとに把握）
4. `progress/work-log.ndjson` の末尾 10 行 — 前回中断点・直近の完了・直近ログ

---

## Step 3: 状況を把握して着手案件を宣言する

読み終えたら以下を確認する。

1. `overall-progress.md` の「Claude が今すぐ着手できるタスク」を確認する
2. `status: in_progress` の案件を列挙する（`user_action_pending` / `deploy_ready` は Claude 不要として除外）
3. `blockers` に内容がある案件を「blocked」として把握する
4. `app-progress.json` の nextAction が完了済みタスクを指していれば **先に nextAction を更新**してから着手する（stale 検知）

**着手前3問フィルタ（全 YES のタスクのみ着手候補）:**

| 問 | チェック | NO → |
|---|---|---|
| Q1 | status が `todo` / `in_progress` / `impl_done` / `local_done` か？ | スキップ |
| Q2 | project.blockers が空か？ | スキップ・理由を work-log に記録 |
| Q3 | assignee が `"claude"` または `"both"` か？ | 「ユーザー操作待ち」として work-log に記録してスキップ |

3問フィルタを通した候補から priority 順に1件選んで宣言する。

---

## Step 4: 作業ルール

- 1サイクル1タスクで進める
- 返答本文は最小限にする
- 判断の根拠は progress ファイルとする（会話ログは補助）
- company CLAUDE.md の危険作業ルール・停止条件はそのまま有効

### 確認最小化ルール

**確認してよいのは以下3ケースのみ:**

1. 破壊的変更（大量削除・DB破壊・本番データ上書き・外部公開条件の大幅変更）
2. 要件が真っ向から競合している（progress と現在指示が明確に矛盾しどちらも副作用大）
3. 継続不能（必須ファイル不在・仮説では進められないレベルで情報不足）

**以下は確認せず進める:**

- UI改善・ファイル整理・軽微なリファクタ
- progress の currentTask / nextAction に沿った実装
- task status 更新・blockers がない案件の継続作業
- build / lint / 起動確認・progress 更新
- 既存方針に沿った実装詳細の決定
- 不明点は仮説を1行記録して進める（質問で止まらない）

**出力形式（毎回この形で短く報告）:**

```
着手: <案件名> / <task名>
仮説: <あれば1行>
→ <完了したら結果1行>
progress: 更新済み
```

---

## Step 5: progress 更新タイミング

| タイミング | 更新するファイルと内容 |
|---|---|
| タスク着手時 | `project-tasks.json` の status → `in_progress` / `work-log.ndjson` に `task_started` 追記 |
| 実装完了・未検証 | `project-tasks.json` → `impl_done` / work-log 追記（nextAction 更新は不要） |
| ローカル確認済 | `project-tasks.json` → `local_done` / work-log 追記（nextAction 更新は不要） |
| タスク完了時（**重要**） | `project-tasks.json` → `done` と同時に、**同ステップで** `app-progress.json` の nextAction を更新する。nextAction 更新なし = 更新未完了 |
| チェックポイント | `work-log.ndjson` に `summary` 追記 / `app-progress.json` を最新化 |
| 中断前・上限前 | **progress 更新を最優先** / `overall-progress.md` 更新 / `work-log.ndjson` に中断ログ追記 |
| 終了時 | 全案件の `app-progress.json` を最終状態に更新 / `overall-progress.md` の「着手可能」「ユーザー待ち」セクションを再生成してから終了 |

**nextAction の決め方（done 時の原子更新）:**
1. 残り Claude タスク（assignee=claude/both の open タスク）があれば → そのタスク名（priority 高優先）
2. ない・user タスクのみ → `"ユーザー操作待ち: [タスク名]"`
3. 全タスク done → `"完了"`

work-log の追記フォーマット:
```json
{"time":"<ISO8601>","project":"<projectId>","type":"<type>","title":"<title>","detail":"<optional>"}
```

---

## Step 6: 継続ルールと停止条件

**原則として止まらず進める:**
- 1タスク終わったら次のタスクへ進む（件数で止まらない）
- progress の nextAction があれば続行する
- blockers がなければ続行する
- 優先度 high が終わっても medium / low があれば続行する
- 「区切りで報告」はしない。停止する時だけ報告する

**停止してよいのは以下の場合のみ:**
- 超危険作業しか残っていない（DB削除・本番破壊的変更など）
- build失敗の原因が不明で継続不能
- 既存機能に影響が出た
- progress と指示が重大に矛盾していて仮説では進められない
- 必須ファイル・前提が欠けていて継続不能
- Claude Codeの利用制限が近い（停止前に progress 更新を最優先する）
- ユーザーが明示的に停止を指示した
