# check-env — Codex SDK 実験 環境確認

実施日: 2026-05-16
対象 VPS: company / ny01/progress

## バージョン

| 項目 | 値 | 確認コマンド |
|---|---|---|
| Node.js | v22.22.2 | `node --version` |
| npm | 10.9.7 | `npm --version` |
| Python | 3.12.3 (`/usr/bin/python3`) | `python3 --version` |
| Codex CLI | codex-cli 0.128.0 (`/usr/bin/codex`) | `codex --version` |

## Codex CLI 利用可否

- **利用可**。`/usr/bin/codex` に存在、`codex-cli 0.128.0`
- `codex login status` → `Logged in using ChatGPT`（**ログイン済み**。API キー不要）
- → `codex login` のユーザー操作は**不要**（実験続行可能）

## Codex SDK 提供形態

| SDK | 提供 | 確認コマンド | 備考 |
|---|---|---|---|
| `@openai/codex-sdk` (TypeScript) | npm v0.130.0 | `npm view @openai/codex-sdk version` | 公式 TS SDK は存在 |
| `@openai/codex` (CLI) | npm v0.130.0 | `npm view @openai/codex version` | ローカルは 0.128.0（動作問題なし） |
| Python 公式 Codex SDK | **なし** | `pip3 show codex-sdk` → not found | 公式 Python SDK は未提供 |
| `openai` (pip) | 未インストール | `python3 -c "import openai"` → ImportError | API キー前提のため本実験では**不使用** |

## 結論

- **Codex CLI: 利用可**（ChatGPT ログイン済み・API キー不要）
- **Codex SDK: 公式は TypeScript (`@openai/codex-sdk`) のみ。Python 公式 SDK は無し**
- 本実験は API キー前提を避ける方針のため、**Python から `codex exec` を subprocess 経由で呼ぶ**方式を採用
  - `--sandbox read-only` で読み取り専用を強制
  - progress 本体コード・データは一切変更しない（読み取りのみ）
- npm / pip への追加インストールは**不要**（CLI 導入済み・openai pip は不使用）

## progress リポとの関係（注意）

- `progress` は `git@github.com:kaeru07/ny01.git` 配下
- `experiments/` は progress の `.gitignore` に未指定 → **未追跡ファイルとして残る**
- 本実験では commit / push を**しない**（指示の禁止事項に従う）
- 将来 progress 本体を commit する際に `experiments/` を巻き込まないよう、本フォルダ内に `.gitignore` を同梱（`__pycache__` 等）。ny01 リポへの混入可否はユーザー判断

## 実行した検証コマンド

```
node --version
npm --version
python3 --version
which codex && codex --version
codex login status
npm view @openai/codex-sdk version
npm view @openai/codex version
pip3 show codex-sdk
python3 -c "import openai"
codex exec --help
```
