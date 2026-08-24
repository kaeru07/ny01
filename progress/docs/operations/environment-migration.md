---
updated: 2026-08-24
updateNote: 別環境（Windows 想定）への移行に向けた棚卸し。実行形態は未決定、VPS は最終的に完全移行する方針。
---

# 環境移行の棚卸し（VPS → 別環境）

現在の稼働環境（Ubuntu VPS / root 運用）を丸ごと別環境へ移すための持ち物リストと注意点。
**方針**: 移行完了後は VPS の定時実行を停止し、書き込み元を新環境へ**一本化**する（両方で自動実行するとデータが競合する）。
**実行形態（WSL2 / ネイティブ Windows / 両対応）は未決定**。決定前でも移せるものと、決めてからでないと決まらないものを分けて書く。

調査日: 2026-08-24 / 調査元: 稼働中の VPS 実測

---

## 1. 何が動いているか（常駐）

pm2 で6プロセス。**自動実行に必須なのは `progress` だけ**で、他はアプリのプレビュー用。

| プロセス | 実体 | 作業ディレクトリ | ポート | 移行要否 |
|---|---|---|---|---|
| **progress** | `npm start`（Next.js） | `apps/ny01/progress` | 3010 | **必須** |
| netscope | `web/start.sh` | `/root/map/web` | 3000 | 任意 |
| hack-lab | `npm run preview` | `/root/hack/lab/frontend` | 3002 | 任意 |
| kusoge | `start.sh` | `apps/kusoge-close-button` | 3001 | 任意 |
| mahjong-preview | `npx serve -s out -l 3011` | `apps/mahjong` | 3011 | 任意 |
| mahjong-trainer-preview | `npx serve out -l 3012` | `apps/ny01/mahjong-trainer` | 3012 | 任意 |

pm2 自体は `pm2-root.service`（`pm2 resurrect`）で起動時復帰している。

> `netscope` と `hack-lab` は `/root/company` の外（`/root/map`, `/root/hack`）にある。移すなら別途コピーが要る。

## 2. 定時実行（ここが移行の本丸）

| ユニット | 起動 | 実行内容 |
|---|---|---|
| `factory-schedule.timer` → `.service` | **11:00 / 14:00 / 16:00 / 23:00 JST** | `docs/factory-schedule/factory-schedule-trigger.sh schedule systemd` |
| `factory-schedule-boot.service` | サーバー起動時 | 同スクリプト（`boot startup`） |
| `hermes-market-research.timer` | 毎日 07:00 JST | `/root/company/scripts/hermes/run-market-research.sh` |
| `codex-remote.service` | 常駐 | Codex Remote Control 登録 |

**トリガースクリプトの中身は「progress の API を叩くだけ」**（`POST /api/operations/factory-schedule`）。
実処理・二重起動防止・記録はすべて progress アプリ側にある。
つまり **新環境で必要なのは「決まった時刻に progress の API を叩く仕掛け」だけ**で、ロジックの移植は不要。

スクリプトがやっていること:
1. `/api/operations/factory-status` を叩いて progress の起動を最大60秒待つ
2. `.env.local` から Basic 認証を読んで `POST /api/operations/factory-schedule`
3. 終了後に `scripts/send-run-report-email.mjs` でレポートメールを送る
4. ログを `/root/company/logs/factory-schedule.log` へ追記

## 3. 秘密情報（値は書かない・手で移す）

| 置き場所 | 中身 | 用途 |
|---|---|---|
| `/root/.secrets/appstore/codemagic.env` | `CODEMAGIC_API_TOKEN` / `CODEMAGIC_APP_ID` | iOSビルド起動 |
| `/root/.secrets/appstore/mahjong_cert_private_key.pem` | 配布証明書の秘密鍵 | TestFlight 署名 |
| `apps/ny01/progress/.env.local` | `PROGRESS_DATA_PATH` / `VAULT_INBOX_TOKEN` / `SMTP_*` / `MAIL_*` / `BASIC_AUTH_*` | progress 本体・メール・認証 |
| `apps/map/web/.env` | DB接続 | map アプリ（任意） |
| `/root/.ssh/id_ed25519` | GitHub への push 鍵 | 全リポジトリ |
| `/root/.config/gh` | gh CLI 認証 | GitHub 操作 |
| `/root/.claude` / `/root/.codex` | Claude Code / Codex のログイン状態 | executor |

**未配置**: App Store Connect API キー（`asc.env` / `asc_key.p8`）。今も未配置のため TestFlight 処理状況は progress から見えない。

## 4. データ（消してはいけないもの）

| 対象 | 容量 | git | 備考 |
|---|---|---|---|
| `apps/ny01/progress/data` | **204MB** | あり（ny01・public） | 実行履歴・目標・承認・学びの正本 |
| `obsidian-vault` | 638MB | あり（vault.git） | GitHub ミラー。clone で復元可 |
| **`obsidian-sync-vault`** | **608MB** | **なし** | **稼働 Vault。git 管理外なので手で移す必要がある** |
| `/root/company` 直下（CLAUDE.md / pm / secretary / engineering / scripts） | 約1.3MB | **remote なし** | **ローカルのみ。GitHub にバックアップが無い** |
| `logs` | 2.4MB | なし | 移送は任意 |

> **リスク**: `obsidian-sync-vault` と `/root/company` の管理ファイル群は、GitHub にバックアップが無い。
> 移行前に必ず tar で退避するか、リモートを作って push しておく。

## 5. リポジトリ（clone で済むもの）

`kaeru07/` 配下の19リポジトリ。主要なものだけ:

| ローカル | remote |
|---|---|
| `apps/ny01`（progress / news-app / mahjong-trainer ほか） | `kaeru07/ny01` |
| `apps/mahjong-analyzer` | `kaeru07/mahjong-analyzer` |
| `apps/mahjong` / `apps/hima-app` | `kaeru07/mahjong` / `kaeru07/hima-tsubushi-app` |
| `apps/kaeru07.github.io` | `kaeru07/kaeru07.github.io` |
| `obsidian-vault` | `kaeru07/vault` |

`apps/mahjong` の作業ブランチは `ios-codemagic-test`（main ではない）点に注意。

## 6. ランタイムと CLI（新環境に入れるもの）

| 種別 | 現行バージョン | 備考 |
|---|---|---|
| Node.js | v22.22.2 | progress / 各アプリ |
| npm | 10.9.7 | |
| git | 2.43.0 | |
| gh | 2.65.0 | GitHub 操作 |
| pm2 | 6.0.14 | 常駐管理（Windows では代替検討） |
| **Claude Code** | 2.1.238 | **executor 本体** |
| **Codex CLI** | 0.149.1 | **fallback executor**（2026-08-27 まで使用上限） |
| Python | 3.12.3 | 補助スクリプト |
| Playwright ブラウザ | chromium 1217/1223 ほか **1.3GB** | スクショ撮影・UI検証。新環境で再取得すればよい |

executor の実体は `spawn('claude' / 'codex')`。**`CLAUDE_BIN` / `CODEX_BIN` の環境変数でパスを差し替えられる**ので、
コマンド名が違う環境でも設定で吸収できる。

## 7. 外部サービス（アカウント側の設定・移行不要だが依存している）

- **GitHub**（push / gh）
- **Codemagic**（iOSビルド。リポジトリ連携済み・トークンで起動）
- **App Store Connect**（TestFlight・審査提出）
- **SMTP（Gmail）**（自動実行レポートメール）
- **Obsidian Sync**（`ob sync`。サブスク期限切れで現在は停止中）

## 8. 環境依存で、実行形態を決めたら直す必要があるもの

現状 progress 内に **`/root/...` の絶対パス直書きが34箇所**ある。WSL2 なら同じパスを作れば無改修で動く。
ネイティブ Windows へ行くならここが改修対象になる。

| 箇所 | 内容 |
|---|---|
| `lib/ios-builds.ts` | `APPS_ROOT = '/root/company/apps'`（iOSアプリの発見） |
| `lib/app-paths.ts` | `GENERATED_APPS_ROOT = '/root/company/apps/generated'` |
| `lib/app-review-screenshots.ts` | アプリの `out/` を一時配信して撮影 |
| `lib/ios-builds.ts` | `/root/.secrets/appstore/codemagic.env` |
| Vault 連携 | `/root/company/obsidian-vault/00_inbox` ほか |
| `docs/factory-schedule/factory-schedule-trigger.sh` | bash・`/root/company/logs`・`.env.local` の grep |
| `scripts/*.mjs` | ログ・添付の絶対パス |
| mahjong-analyzer の `scripts/generate-store-screenshots.mjs` | progress の `node_modules/playwright-core` を絶対パス参照 |

そのほか形態によって決まるもの:

- **スケジューラ**: systemd タイマー → WSL2 なら systemd/cron、ネイティブなら**タスクスケジューラ**（`schtasks`）
- **常駐**: pm2 → ネイティブ Windows では `pm2-windows-startup` か NSSM、あるいはタスクスケジューラ常駐
- **シェル**: トリガースクリプトが bash。ネイティブなら PowerShell か Node スクリプトへ置換
- **改行コード**: Windows で clone すると CRLF になり得る。`.gitattributes` か `core.autocrlf=false` を決める

## 9. 移行手順（形態が決まる前でもできること）

1. **バックアップを取る**（最優先・git に無いものが対象）
   ```bash
   tar czf /root/company/_backups/sync-vault-$(date +%Y%m%d).tar.gz -C /root/company obsidian-sync-vault
   tar czf /root/company/_backups/company-mgmt-$(date +%Y%m%d).tar.gz -C /root/company CLAUDE.md CLAUDE.local.md pm secretary engineering scripts
   ```
2. **`/root/company` にリモートを作って push**（管理ファイル群のバックアップ。private リポジトリ推奨）
3. **秘密情報を安全な手段で新環境へ**（チャット・リポジトリには絶対に載せない）
4. 新環境に Node 22 / git / gh / Claude Code / Codex CLI を導入し、**CLI のログインを済ませる**
5. リポジトリを clone（`ny01` / `mahjong-analyzer` / `vault` ほか）
6. `progress` で `npm ci` → `npm run build` → 起動 → `/api/operations/factory-status` が応答するか確認
7. **定時実行の切り替え**（形態が決まってから）: 新環境で 11/14/16/23 時に progress の API を叩く仕掛けを作る
8. **VPS 側の定時実行を停止**して一本化する
   ```bash
   systemctl disable --now factory-schedule.timer factory-schedule-boot.service hermes-market-research.timer
   ```

## 10. 移行前に決めておくこと

- 実行形態（WSL2 / ネイティブ Windows / 両対応）
- Windows マシンの**電源が入っていない時間帯**の扱い（VPS は24時間動いていた。夜間バッチの23時実行が落ちる可能性）
- `progress` を外から見るか（現在は VPS のポート3010＋Basic認証。iPhone から見ているなら公開方法の再設計が要る）
- `obsidian-sync-vault` の同期をどうするか（`ob sync` は停止中。GitHub ミラーだけで回すのか）

## 変更履歴

- 2026-08-24: 初版。VPS 実測で常駐・定時実行・秘密情報・データ・リポジトリ・ランタイム・環境依存を棚卸し。
