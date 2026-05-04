# 実行履歴登録テンプレート

作業完了後に `POST /api/execution-runs` へ登録してください。
登録するとログ画面（/logs?mode=history）に実行履歴が表示され、ChatGPTレビューへ渡せます。

## エンドポイント

```
POST http://localhost:3010/api/execution-runs
Content-Type: application/json
```

## 必須フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `targetApp` | string | 対象アプリ名 (例: `ny01/progress`) |
| `targetTodoTitle` | string | 作業したToDoのタイトル |
| `runStatus` | string | `completed` / `failed` / `partial` |
| `summary` | string | 実施内容の概要（1〜3行） |
| `rawReport` | string | 完了報告の全文 |

## 任意フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `targetTodoId` | string | ToDoのID |
| `runId` | string | 実行ID（省略時は日時から自動生成） |
| `startedAt` / `finishedAt` | ISO8601 | 作業時刻（省略時は登録時刻） |
| `beforeStatus` / `afterStatus` | string | 作業前後のToDoステータス |
| `changedFiles` | ChangedFile[] | 変更ファイルと変更内容 |
| `checks` | object | 検証結果（build, typescript, lint, mainScreen, mobileLayout） |
| `warnings` | string[] | 未対応・注意点 |
| `nextActions` | string[] | 次にやるべきこと |
| `progressUpdated` | boolean | progress ファイル更新済みか |
| `reviewStatus` | string | `not_reviewed`（省略時のデフォルト） |

## JSONテンプレート

```json
{
  "targetApp": "ny01/progress",
  "targetTodoId": "",
  "targetTodoTitle": "",
  "runStatus": "completed",
  "reviewStatus": "not_reviewed",
  "summary": "",
  "changedFiles": [
    { "file": "", "change": "" }
  ],
  "checks": {
    "build": "OK",
    "typescript": "OK",
    "lint": "OK",
    "mainScreen": "OK",
    "mobileLayout": "OK"
  },
  "warnings": [],
  "nextActions": [],
  "rawReport": ""
}
```

## curlサンプル

```bash
curl -X POST http://localhost:3010/api/execution-runs \
  -H "Content-Type: application/json" \
  -d '{
  "targetApp": "ny01/progress",
  "targetTodoTitle": "着手判定UI改善",
  "runStatus": "completed",
  "summary": "FallbackTaskCardにおすすめ度バッジを追加。PendingFiltersにサマリーとキーワード検索を追加。",
  "changedFiles": [
    {"file": "components/pending/FallbackTaskCard.tsx", "change": "修正"},
    {"file": "components/pending/PendingFilters.tsx", "change": "修正"}
  ],
  "checks": {
    "build": "OK",
    "typescript": "OK",
    "lint": "OK",
    "mainScreen": "OK",
    "mobileLayout": "OK"
  },
  "warnings": [],
  "nextActions": ["iPhone実機確認"],
  "rawReport": "完了報告の全文をここに貼る"
}'
```

## runStatus の意味

| 値 | 意味 |
|---|---|
| `completed` | 作業完了・検証済み |
| `failed` | 作業失敗・エラーあり |
| `partial` | 一部完了・未完了タスクあり |

## 登録後の確認

1. ブラウザで http://localhost:3010/logs?mode=history を開く
2. 登録した実行履歴が表示されていることを確認
3. 「レビュー用コピー」でChatGPTに貼り付けてレビュー依頼
4. レビュー完了後「レビュー済みにする」を押す
