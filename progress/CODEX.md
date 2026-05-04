# CODEX.md — ny01/progress

このファイルは Codex で `ny01/progress` の集中作業モードを行うときの補足ルールを定義する。

## 集中作業モード

- `PROGRESS_DATA_PATH` 配下の `work-queue.json` を正本とする
- 着手対象は `status: "queued"` または `status: "in_progress"` の work-queue アイテムだけとする
- `autoOrder` の昇順で、1回に1アイテムだけ処理する
- `project-tasks.json` から work-queue にないタスクへ自発的に着手しない

## 1タスク1レビュー・1実行履歴

Codex の集中作業モードでは **1 task = 1 review = 1 execution-run** を必須とする。

- work-queue の1アイテムを1 task として扱う
- work-queue の1アイテムごとに個別の完了報告を作成する
- work-queue の1アイテムごとに個別のレビュー対象を作成する
- work-queue の1アイテムごとに `/api/execution-runs` へ1件ずつPOSTする
- 複数の work-queue アイテムを1つのレビュー用コピーにまとめない
- 複数の work-queue アイテムを1つの execution-run や1回のPOSTにまとめない
- `autoOrder` が複数ある場合も、各 `autoOrder` ごとに完了報告・レビュー・execution-run を分ける
- セッションサマリーは補助情報であり、個別レビューや個別 execution-run の代替にしない

## 変更禁止

- progress 実データを taskPrompt の許可なく直接編集しない
- API実装・UI実装・ポート設定・他アプリを taskPrompt の範囲外で変更しない
- git commit / push / deploy はユーザー指示なしに行わない
