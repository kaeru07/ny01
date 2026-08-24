---
updated: 2026-08-25
updateNote: バックアップの GitHub 冗長化を実施（kaeru07/company・kaeru07/vault-sync-backup を新設）。残る手動退避は586MBのzipのみ。
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
| `obsidian-sync-vault` | 608MB | **あり（2026-08-25〜）** | 中身23MB分を `kaeru07/vault-sync-backup`(private) へ。**586MBのzip 1個だけは対象外** |
| `/root/company` 直下（CLAUDE.md / pm / secretary / engineering / scripts） | 約1.3MB | **あり（2026-08-25〜）** | `kaeru07/company`(private) へ |
| `logs` | 2.4MB | なし | 移送は任意 |

> **2026-08-25 に解消**: private リポジトリ2本を新設して push した。更新は `scripts/backup-to-github.sh` で再実行できる。
> ただし **`00_inbox` の 586MB zip（ChatGPTエクスポート）だけは git に載せていない**。これは手で別媒体へ退避すること。
>
> 補足: GitHub ミラー `kaeru07/vault` には**2,171件の同期漏れ**があり、実バックアップにはなっていなかった（rsync ミラーの取りこぼし）。

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

## 9. 移行手順（実行順）

所要は WSL2 なら**半日**、ネイティブ Windows なら**数日**。
`【VPS】`＝今の環境で実行、`【Win】`＝移行先で実行、`【手】`＝人の操作（自動化しない）。

### フェーズ0: 退避（形態が決まる前に済ませる）

0. `【VPS】` **GitHub への冗長化（2026-08-25 実施済み）**
   ```bash
   bash /root/company/scripts/backup-to-github.sh   # 以後はこれ1本で更新できる
   ```
   - `kaeru07/company`(private): 管理ファイル74件
   - `kaeru07/vault-sync-backup`(private): Vault の中身2,937件（zip除く）

1. `【VPS】` git にバックアップが無いものを tar 退避（**2026-08-24 実施済み**）
   ```bash
   cd /root/company
   tar czf _backups/company-mgmt-$(date +%Y%m%d).tar.gz CLAUDE.md CLAUDE.local.md pm secretary engineering scripts
   tar czf _backups/sync-vault-$(date +%Y%m%d).tar.gz obsidian-sync-vault
   tar tzf _backups/sync-vault-$(date +%Y%m%d).tar.gz | wc -l   # 読めるか確認
   ```
2. `【手】` **残る586MBのzipを別媒体へコピー**（git に載らない唯一の大物）
   ```bash
   # 対象: obsidian-sync-vault/00_inbox/aaab0604...zip（ChatGPTエクスポート・585MB）
   scp /root/company/obsidian-sync-vault/00_inbox/*.zip <user>@<WindowsのIP>:/mnt/c/backup/
   # SSH が使えないなら progress 経由でダウンロードするか、rclone でクラウドへ
   ```
   ※ 移行後もこの zip が要るのか（＝ChatGPT の過去ログを Vault に置き続けるのか）は要判断。
   不要なら退避して Vault から外すとバックアップが 608MB → 23MB になる。

### フェーズ1: 移行先の土台づくり

4. `【手】` 形態を決める（**WSL2 を推奨**）
   - **WSL2**: `wsl --install -d Ubuntu` → Ubuntu を起動 → 以降は Linux と同じ手順。絶対パスの改修が不要
   - **ネイティブ Windows**: 8章の34箇所の改修が必要（後述の差分を参照）
5. `【Win】` ランタイムを入れる（バージョンは今と揃える）
   ```bash
   # WSL2(Ubuntu) 内
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs git curl python3
   sudo npm i -g pm2
   node -v   # v22 系であること
   ```
6. `【Win】` CLI を入れて**ログインまで済ませる**（executor の本体）
   ```bash
   npm i -g @anthropic-ai/claude-code   # claude
   # Codex CLI も同様に導入し、両方 `--version` が通ることとログイン済みを確認
   claude --version && codex --version
   ```
7. `【Win】` GitHub 認証
   ```bash
   ssh-keygen -t ed25519 -C "windows-migration"   # 新しい鍵を作り GitHub へ登録（VPS の鍵は移さない方が安全）
   gh auth login
   ```

### フェーズ2: 中身を移す

8. `【Win】` ディレクトリを**同じ形**で作る（WSL2 なら `/root/company` をそのまま再現できる）
   ```bash
   sudo mkdir -p /root/company/apps /root/company/logs /root/company/_backups
   ```
9. `【Win】` リポジトリを clone
   ```bash
   cd /root/company/apps
   git clone git@github.com:kaeru07/ny01.git
   git clone git@github.com:kaeru07/mahjong-analyzer.git
   git clone git@github.com:kaeru07/mahjong.git && (cd mahjong && git checkout ios-codemagic-test)
   git clone git@github.com:kaeru07/hima-tsubushi-app.git hima-app
   git clone git@github.com:kaeru07/kaeru07.github.io.git
   cd /root/company && git clone git@github.com:kaeru07/vault.git obsidian-vault
   ```
10. `【手】` **tar を展開**（git に無いもの）
    ```bash
    tar xzf /mnt/c/backup/sync-vault-YYYYMMDD.tar.gz -C /root/company
    tar xzf /mnt/c/backup/company-mgmt-YYYYMMDD.tar.gz -C /root/company
    ```
11. `【手】` **秘密情報を手で置く**（チャット・リポジトリには絶対に載せない）
    - `/root/.secrets/appstore/codemagic.env` と `mahjong_cert_private_key.pem`（`chmod 600`）
    - `apps/ny01/progress/.env.local`（`.env.local.example` を雛形に、3章のキーを埋める）
    - `PROGRESS_DATA_PATH` は新環境の実パスに直す

### フェーズ3: 起動確認（自動実行はまだ止めたまま）

12. `【Win】` progress を建てる
    ```bash
    cd /root/company/apps/ny01/progress
    npm ci && npm run build && pm2 start npm --name progress -- start
    curl -u "$BASIC_AUTH_USER:$BASIC_AUTH_PASSWORD" http://localhost:3010/api/operations/factory-status
    ```
13. `【Win】` 画面が出るか確認（`/` `/decide` `/queue` `/app-market-research`）
14. `【Win】` **Factory を1回だけ手で回して通しで確認**（VPS 側はまだ動いているので、この時点では**データを書かせない**よう `factoryEnabled=false` で dry に確認するのが安全）
15. `【Win】` Playwright を入れる（スクショ撮影・UI検証を使うなら）
    ```bash
    npx playwright install chromium
    ```

### フェーズ4: 切り替え（ここで初めて一本化）

16. `【VPS】` **定時実行を止める**（両方で動かすとデータが競合する。ここが一番大事）
    ```bash
    systemctl disable --now factory-schedule.timer factory-schedule-boot.service hermes-market-research.timer
    systemctl list-timers | grep -E "factory|hermes"   # 消えたことを確認
    ```
17. `【VPS】` **最後のデータを push**（progress のデータは git 管理なので、これで新環境へ渡す）
    ```bash
    cd /root/company/apps/ny01 && git add progress/data && git commit -m "移行前の最終データ" && git push
    ```
18. `【Win】` `git pull` で最新データを取り込む
19. `【Win】` **定時実行を作る**
    - WSL2 + systemd（`/etc/wsl.conf` に `[boot] systemd=true`）→ VPS のユニットをそのままコピー
      ```bash
      sudo cp /path/to/factory-schedule.{service,timer} /etc/systemd/system/
      sudo systemctl daemon-reload && sudo systemctl enable --now factory-schedule.timer
      ```
    - systemd を使わない場合 → **Windows のタスクスケジューラ**から WSL を叩く
      ```
      プログラム: wsl.exe
      引数: -d Ubuntu -- /root/company/apps/ny01/progress/docs/factory-schedule/factory-schedule-trigger.sh schedule cron
      トリガー: 毎日 11:00 / 14:00 / 16:00 / 23:00
      ```
20. `【Win】` pm2 を起動時復帰させる
    ```bash
    pm2 save && pm2 startup   # 表示されたコマンドを実行
    ```
21. `【Win】` **次の定時実行を1回見届ける**（`logs/factory-schedule.log` と progress の実行履歴に1件増えるか）

### フェーズ5: 後片付け

22. `【VPS】` 1〜2週間は**消さずに残す**（切り戻し用）。pm2 の progress も止めてよいが、ディスクは温存
23. `【手】` 問題が無ければ VPS を解約 or 別用途へ

---

## 9-2. ネイティブ Windows を選ぶ場合の差分

WSL2 を使わない場合、上の手順に加えて以下が必要になる。

| 対象 | やること |
|---|---|
| 絶対パス34箇所 | `COMPANY_ROOT` / `APPS_ROOT` / `SECRETS_DIR` などの環境変数へ置き換え（`lib/ios-builds.ts` の `APPS_ROOT`、`lib/app-paths.ts` の `GENERATED_APPS_ROOT` ほか） |
| トリガースクリプト | `factory-schedule-trigger.sh`（bash）を PowerShell か Node スクリプトへ移植。やることは「API を叩く＋メール送信＋ログ追記」だけ |
| 定時実行 | タスクスケジューラ（`schtasks /create /sc daily /st 11:00 ...`）を4本 |
| 常駐 | `pm2-windows-startup` か NSSM でサービス化。あるいはタスクスケジューラの「ログオン時」で起動 |
| executor | `CLAUDE_BIN` / `CODEX_BIN` に `.cmd` のフルパスを指定（`spawn` は Windows で `.cmd` の解決に注意が要る） |
| 改行コード | `git config --global core.autocrlf false`（シェルスクリプトが CRLF になると壊れる） |
| Playwright | `npx playwright install chromium`（キャッシュは `%USERPROFILE%\AppData\Local\ms-playwright`） |

## 9-3. 移行の判断チェックリスト（切り替え前に全部 ✓ になっていること）

- [ ] tar を**別媒体**へコピーした
- [ ] `claude` / `codex` が新環境で動き、**ログイン済み**
- [ ] progress が起動し、`/api/operations/factory-status` が応答する
- [ ] 秘密情報を新環境に置き、`.env.local` の `PROGRESS_DATA_PATH` を直した
- [ ] VPS の最終データを push し、新環境で pull した
- [ ] **VPS の定時実行を止めた**（両方稼働＝データ競合）
- [ ] 新環境で定時実行が1回成功した
- [ ] Windows のスリープ設定を確認した（23時の実行が落ちないか）

## 変更履歴

- 2026-08-25: 移行手順をフェーズ0〜5のコピペ実行できる手順書へ拡張。ネイティブ Windows を選ぶ場合の差分表と、切り替え前チェックリストを追加。
- 2026-08-24: 初版。VPS 実測で常駐・定時実行・秘密情報・データ・リポジトリ・ランタイム・環境依存を棚卸し。
