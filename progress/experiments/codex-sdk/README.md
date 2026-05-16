# Codex SDK 最小実験（読み取り専用）

progress の作業履歴（`execution-runs.json`）を Codex に読ませて、
レビュー要約と改善 ToDo 候補を出す**読み取り専用**の実験フォルダ。

progress 本体のコード・データには一切影響を与えない。

## 結論（利用可否）

- **Codex CLI: 利用可**（`/usr/bin/codex` 0.128.0 / ChatGPT ログイン済み / API キー不要）
- **Codex SDK: 公式は TypeScript (`@openai/codex-sdk`) のみ。Python 公式 SDK は無し**
- 本実験は API キー前提を避けるため **Python → `codex exec` を subprocess で呼ぶ**方式
- 詳細は [check-env.md](./check-env.md)

## 安全設計

- `codex exec --sandbox read-only` でモデルのファイル変更を不可にする
- `execution-runs.json` / `.env` は**読み取りのみ**。スクリプトは一切書き込まない
- progress 本体コード非変更 / project-tasks.json 非変更 / git push しない / cron 登録しない
- 既定で対象一覧を表示。`--dry-run` で codex 呼び出しを完全スキップ

## 使い方

```bash
cd /root/company/apps/ny01/progress/experiments/codex-sdk

# 1) 抽出のみ（codex を呼ばない・最も安全）
python3 review_execution_runs.py --dry-run

# 2) 先頭 2 件だけ codex に渡す（実通信・read-only）
python3 review_execution_runs.py --limit 2

# 3) 別の runs ファイルを指定
python3 review_execution_runs.py --runs-file /path/to/execution-runs.json --dry-run
```

### オプション

| オプション | 既定 | 説明 |
|---|---|---|
| `--runs-file` | `$PROGRESS_DATA_PATH/execution-runs.json` | 対象 JSON |
| `--limit` | 8 | codex に渡す最大件数 |
| `--dry-run` | off | 抽出のみ。codex を呼ばない |

### 抽出条件（レビュー対象）

- `reviewStatus` が `not_reviewed` または `needs_followup`
- もしくは `runStatus` が `failed` または `partial`

### 出力

標準出力に「対象一覧 → codex によるレビュー要約・リスク・改善 ToDo 候補・全体優先 ToDo」。
ファイルは生成しない（結果を残したい場合は手動でリダイレクト）。

## 検証済み

- `--dry-run`: 47 件中 19 件抽出を確認
- 実 codex（`--limit 2`）: read-only で実行、レビュー要約+ToDo を日本語出力、exit 0
- 実行後 `execution-runs.json` のサイズ・mtime 不変（読み取り専用成立）

## 既知の制約・次の一手

- 公式 Python SDK が無いため subprocess 方式（SDK の型安全な API は使っていない）
- TypeScript の `@openai/codex-sdk` を使う場合は別フォルダで隔離検証が必要
- 結果の構造化（JSON 出力）・needs_followup への自動振り分けは未実装（書き込みを避けるため意図的に保留）
- progress への反映は人間が結果を見て手動で行う前提
