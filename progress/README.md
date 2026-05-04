# Progress Dashboard

Claude Code の作業進捗を管理するローカル Web アプリ。

## 概要

- progress ファイル（JSON / MD / NDJSON）を正本として画面で確認できる
- 案件ごとにタスク一覧・進捗・ログを管理
- UI からタスクを追加してファイルに即時反映
- iPhone 対応レイアウト

## 起動

### 開発確認（ローカル一時起動）

```bash
npm install
npm run dev
# → http://localhost:3010  (0.0.0.0:3010 でリッスン)
```

Termius で Port Forward する場合: ローカル 3010 → サーバー 3010

### 本番運用（pm2 常駐）

```bash
# 初回セットアップ
npm install
npm run build
pm2 start npm --name progress --cwd /root/company/apps/ny01/progress -- start
pm2 save

# 想定 URL（VPS 直接アクセス）
# http://160.251.143.146:3010
```

### pm2 操作

```bash
pm2 status              # 状態確認
pm2 logs progress       # ログ確認
pm2 restart progress    # 再起動
pm2 stop progress       # 停止

# コード更新後の反映
npm run build && pm2 restart progress
```

### VPS 再起動後の自動起動

`pm2 startup` + `pm2 save` 済み（systemd に登録）。再起動後も自動で復帰する。

## 画面構成

| ルート | 説明 |
|---|---|
| `/` | ダッシュボード（統計・次の一手・案件カード・最近のログ） |
| `/projects` | 案件一覧 |
| `/projects/[id]` | 案件詳細 + サマリー編集 + タスク管理 + タスク追加 |
| `/tasks` | 全案件のアクティブタスク一覧・案件別サマリー |
| `/logs` | ワークログ（案件・タイプでフィルタ可） |

## データファイル

デフォルト読込先: `data/sample/`

| ファイル | 説明 |
|---|---|
| `app-progress.json` | 案件一覧サマリー |
| `project-tasks.json` | 案件別タスク詳細 |
| `work-log.ndjson` | 作業ログ（1行1JSON） |
| `overall-progress.md` | 人間向け要約 |

### データパス切替

`.env.local` に以下を追加（`.env.local.example` を参照）:

```bash
PROGRESS_DATA_PATH=/path/to/actual/progress
```

指定ディレクトリには以下のファイルを置く:

```
<PROGRESS_DATA_PATH>/
├── app-progress.json
├── project-tasks.json
├── work-log.ndjson
└── overall-progress.md
```

- 未設定時は `data/sample/` を読む
- ファイルが存在しない場合は空データで安全にフォールバック（アプリは壊れない）

## API

### POST /api/tasks

タスクを追加する。`project-tasks.json` と `work-log.ndjson` を更新する。

```json
{
  "projectId": "netscope",
  "title": "タスク名",
  "status": "todo",
  "priority": "high",
  "memo": "メモ"
}
```

### PATCH /api/tasks/[taskId]

タスクの status を更新する。`project-tasks.json` の updatedAt も更新し、`work-log.ndjson` に `task_status_updated` を追記する。

```json
{
  "projectId": "netscope",
  "status": "done"
}
```

### PATCH /api/projects/[projectId]

案件サマリーを更新する。`app-progress.json` を更新し、`work-log.ndjson` に `project_summary_updated` を追記する。すべてのフィールドは任意（変更したいものだけ送ればよい）。

```json
{
  "currentTask": "新しいタスク名",
  "nextAction": "次のアクション",
  "progress": 75,
  "status": "in_progress",
  "phase": "implementation",
  "url": "https://example.com"
}
```

`progress` は 0〜100 にクランプされる。`url` に空文字を送ると未設定扱いになる。

## Claude Code 連携

Claude Code の集中作業モードで `progress-writer.ts` に相当する書き込みロジックを使い、
以下のファイルを更新することで、チャット本文を見なくても進捗が把握できる運用になる。

- `app-progress.json` → 案件の現在ステータスを更新
- `project-tasks.json` → タスクの完了・追加を記録
- `work-log.ndjson` → 作業ログを追記

## ディレクトリ構成

```
progress/
├── app/                    # Next.js App Router
│   ├── page.tsx            # ダッシュボード
│   ├── projects/           # 案件ページ
│   ├── tasks/              # 全タスクページ
│   ├── logs/               # ログページ
│   ├── api/tasks/          # タスク追加 (POST) / status更新 (PATCH [taskId])
│   └── api/projects/       # サマリー更新 (PATCH [projectId])
├── components/             # UI コンポーネント
├── lib/                    # データ読込・書込・変換
├── types/                  # 型定義
└── data/sample/            # サンプルデータ
```
