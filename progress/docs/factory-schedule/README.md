# Factory スケジュール実行（P3）

Factory を **ユーザー操作なし**で起動するためのスケジューラ設定。

- ① VPS 起動時: Factory ON なら自動開始（`factory-schedule-boot.service`）
- ② 定時実行: 毎日指定時刻に自動開始（`factory-schedule.timer`）
- ③ Factory OFF: 何も起動しない（API 側 `skip=factory_off`）
- ④ 安全停止: blocked / approval_required / fail / max_runs / rate_limited 等は従来通り停止（`runFactory` に委譲）

> 旧ドラフト `factory-runner.sh` / `factory-runner.service` / `factory-runner.timer` /
> `factory-runner-boot.service` / `crontab.disabled` は本 `factory-schedule.*` 一式で**置き換え**。
> 新規導入では `factory-schedule.*` を使う。

---

## 構成

| ファイル | 役割 |
|---|---|
| `factory-schedule-trigger.sh` | スケジューラから叩く入口スクリプト。`/api/operations/factory-schedule` を POST するだけ |
| `factory-schedule.service` | 定時実行用 oneshot（`trigger=schedule systemd`） |
| `factory-schedule.timer` | 毎日 09:00 に上記 service を起動（時刻は編集可） |
| `factory-schedule-boot.service` | VPS 起動時 oneshot（`trigger=boot startup`） |
| `crontab.example` | systemd を使わない場合の cron 代替 |

実体ロジックはアプリ側に集約:
- API: `app/api/operations/factory-schedule/route.ts`
- ロジック: `lib/factory-schedule.ts`（`runScheduledFactory`）
- 委譲先: `lib/factory-runner.ts`（`runFactory` / 既存安全ゲート）

---

## 起動条件（API 側で判定）

`runScheduledFactory` が以下を順に判定し、満たさなければ起動せず envelope ExecutionRun を残す。

1. `factoryEnabled === true`（false → `skip=factory_off`）
2. `factoryRunState !== 'Blocked'`（Blocked → `skip=blocked`）
3. 二重起動防止: `data/real/factory-schedule.lock` が有効 → `skip=already_running`
   - lock は実行開始時に作成し、`finally` で削除。最大3 Run×25分と前後処理を考慮し、2時間で stale 奪取。

通過したら `runFactory({ mode:'auto', confirm:true })` を起動。Epic ループ・安全ゲート
（blocked / approval_required / riskFlags / decision 待ち / max_runs / rate_limited）は
**runFactory 既存実装のまま**。P3 では一切変更しない。

---

## ExecutionRun 記録

- スケジュール起動 1 回ごとに **envelope ExecutionRun** を必ず 1 件記録:
  - `source`: `schedule` | `boot`
  - `trigger`: `systemd` | `cron` | `startup`
  - `summary` / `stopReason` に結果（実行 Run 数・停止理由・skip 理由）
- `runFactory` が生成した各 Run には `source` / `trigger` を**後付け**して誰が起動したか残す。
- skip（factory_off / blocked / already_running）でも envelope を残すので、
  「OFF で起動しなかった」「二重起動を弾いた」も ExecutionRun から確認できる。

---

## スケジューラ選定: systemd timer（採用）

cron ではなく **systemd timer** を採用する。理由:

1. **boot 起動の制御性**: `WantedBy=multi-user.target` + `After/Wants=network-online.target`
   で「ネットワーク後に 1 回」を素直に表現できる。cron の `@reboot` はデーモン依存で
   起動順序・ネットワーク待ちを制御しづらい。
2. **状態・ログ**: `systemctl status` / `journalctl -u` で実行履歴・失敗理由を追える。
   cron はログが分散しメール依存になりがち。
3. **取りこぼし対応**: `Persistent=true` で VPS 停止中に跨いだ定時を起動後に 1 回補填。
4. **環境一貫性**: 本 VPS は systemd 255 稼働。pm2 も併用しており systemd 管理が自然。

cron 版（`crontab.example`）も同等機能を用意し、systemd 不可環境向けに残す。

---

## 確定設定（2026-06-01 / enable 前チェック済み）

| 項目 | 値 | 備考 |
|---|---|---|
| 定時 | 毎日 **11:00 / 14:00 / 16:00 / 23:00 JST** | `factory-schedule.timer` OnCalendar（複数行＝いずれか一致で発火）。TZ=Asia/Tokyo 確認済み |
| 取りこぼし | `Persistent=true` | 停止中に跨いだら起動後 1 回補填 |
| 初回 maxRuns | **1** | 両 service に `Environment=FACTORY_MAX_RUNS=1`。安定後に引き上げ or 削除 |
| WorkingDirectory | `/root/company/apps/ny01/progress` | 両 service |
| 実行ユーザー | `root` | progress(pm2) と同一 |
| boot 前提 | `pm2-root.service`=enabled + `dump.pm2` に progress 含む → 再起動後 3010 自動復帰 | trigger 側 `wait_for_health` 最大 60 秒で待つ |
| Factory ON/OFF | **OFF のまま** | enable しても OFF なら `skip=factory_off` で何もしない |

> ⚠ enable はホストの boot 挙動を変える危険作業。**ユーザー承認後**に実行し、dangerous-work ログを残す。
> Claude/Codex は enable を自動実行しない。

## 推奨 enable 順序（段階的）

1. **準備**（下記 setup）— unit 設置 + daemon-reload のみ。まだ自動起動しない
2. **手動テスト** — `systemctl start factory-schedule.service`（OFF なので skip=factory_off を確認）
3. **timer だけ enable** — 1〜2 日 11:00 の挙動を観察（boot はまだ）
4. 問題なければ **boot service を enable**
5. 安定したら `Environment=FACTORY_MAX_RUNS=1` を緩める（or 行削除で API 既定=最大3）

### setup（設置のみ・自動起動しない / 要承認）

```bash
DIR=/root/company/apps/ny01/progress/docs/factory-schedule
chmod +x "$DIR/factory-schedule-trigger.sh"
cp "$DIR/factory-schedule.service"      /etc/systemd/system/
cp "$DIR/factory-schedule.timer"        /etc/systemd/system/
cp "$DIR/factory-schedule-boot.service" /etc/systemd/system/
systemctl daemon-reload
```

### 手動テスト（reboot/enable せず経路を確認）

```bash
systemctl start factory-schedule.service             # schedule/systemd 経路（OFFなら skip=factory_off）
systemctl start factory-schedule-boot.service        # boot/startup 経路
journalctl -u factory-schedule.service --no-pager -n 20
```

### enable（timer 先行 → boot は後で）

```bash
systemctl enable --now factory-schedule.timer        # 毎日 11:00 を有効化
# 数日観察して問題なければ:
systemctl enable factory-schedule-boot.service       # 次回 boot から起動時実行
```

### 確認

```bash
systemctl list-timers | grep factory-schedule        # 次回発火時刻（Tue 11:00 等）
systemctl status factory-schedule.timer
journalctl -u factory-schedule.service --no-pager     # 定時実行ログ
journalctl -u factory-schedule-boot.service --no-pager
tail -f /root/company/logs/factory-schedule.log       # スクリプト側ログ
```

### 解除 / rollback（完全に元へ戻す）

```bash
# 1) 停止 + enable 解除（now で即時停止も行う）
systemctl disable --now factory-schedule.timer
systemctl disable --now factory-schedule-boot.service

# 2) unit 削除
rm -f /etc/systemd/system/factory-schedule.service \
      /etc/systemd/system/factory-schedule.timer \
      /etc/systemd/system/factory-schedule-boot.service

# 3) systemd 再読込（残骸掃除）
systemctl daemon-reload
systemctl reset-failed 2>/dev/null || true

# 4) 確認（何も残っていないこと）
systemctl list-timers --all | grep factory-schedule || echo "timer なし（rollback OK）"
systemctl is-enabled factory-schedule.timer 2>&1 || true   # not-found が正
```

ロールバック後はアプリ側コード（`factory-schedule.ts` / `factory-overview.ts` 等）は無傷で残る。
Automation 画面は `timerEnabled=false / bootEnabled=false / nextRunAt=未設定` に戻る。
trigger スクリプトの手動実行（systemd 不要）はそのまま使える。

---

## スクリプト単体での動作確認（systemd 不要）

```bash
# Factory OFF の状態で叩く → skip=factory_off が返る（何も起動しない）
/root/company/apps/ny01/progress/docs/factory-schedule/factory-schedule-trigger.sh schedule systemd

# 直接 API を叩く場合
curl -s -X POST http://localhost:3010/api/operations/factory-schedule \
  -H 'Content-Type: application/json' \
  -d '{"source":"schedule","trigger":"systemd"}'
```
