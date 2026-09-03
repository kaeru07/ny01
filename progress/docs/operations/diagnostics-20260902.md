# progress 自動実行まわりの実態診断（2026-09-02）

読み取り専用で調査した結果。既存ファイルは変更していない。
値はすべて調査時点の実測。パスは progress リポジトリからの相対パス。

---

## 1. 環境

### PROGRESS_DATA_PATH

```
PROGRESS_DATA_PATH=/root/company/apps/ny01/progress/data/real
```

相対では `data/real`。

### data/real の内容（主要ファイル）

| ファイル | サイズ | 更新日時 |
|---|---:|---|
| `recommended-epics.json` | 9,176,091 | 08-30 16:02 |
| `execution-runs.json` | 2,724,571 | 09-02 00:34 |
| `knowledge-records.json` | 2,353,328 | 08-22 14:01 |
| `automation-log.ndjson` | 639,004 | 08-30 16:02 |
| `epics.json` | 502,612 | **08-21 11:03** |
| `app-factory-candidates.json` | 499,209 | 08-30 11:03 |
| `goals.json` | 333,090 | 08-30 16:02 |
| `approvals.json` | 149,351 | 08-24 11:05 |
| `prompt-queue.json` | 30,548 | 08-30 16:02 |
| `automation-config.json` | 171 | **06-27 10:42** |
| `codex-runs.json` | 1,354 | **05-15 21:44** |
| `app-market-research.json` | 59 | 08-23 18:34 |

ほか `archive/`・`_backups/` を含め35エントリ。

### Codex CLI

| 項目 | 値 |
|---|---|
| パス | `/root/.local/bin/codex` |
| バージョン | `codex-cli 0.152.1` |
| ログイン | `Logged in using ChatGPT` |

### pm2（progress）

| 項目 | 値 |
|---|---|
| status | online |
| restart 回数 | **540** |
| unstable restarts | 0 |
| uptime 起点 | 2026-08-24 21:36 |

### systemd（factory 関連）

`systemctl list-timers | grep -i factory` → **該当なし**。

| unit | Loaded | Active | Trigger |
|---|---|---|---|
| `factory-schedule.timer` | disabled | inactive (dead) | n/a |
| `factory-schedule.service` | static | inactive (dead) | — |
| `factory-schedule-boot.service` | disabled | inactive (dead) | — |
| `hermes-market-research.timer` | disabled | inactive (dead) | n/a |

**所見**
- 定時実行は4ユニットすべて停止しており、現在スケジュール起動は発生しない。
- `codex-runs.json` の更新が 05-15 で止まっている一方、CLI は最新（0.152.1）でログイン済み。CLI が使えないから記録が無いのではない。
- pm2 の restart 540 回は uptime 起点（08-24）以前の累計。unstable 0 なので即死ループではない。

---

## 2. execution-runs.json（data/real）

| 項目 | 値 |
|---|---|
| runs 総件数 | **554** |
| startedAt 最小 | 2026-06-06T14:27:17 |
| startedAt 最大 | 2026-09-01T15:29:49 |

※ 300件超で自動アーカイブされる運用のため、これは「アクティブ分」。`archive/` に別途保管がある。

### source 別

| source | 件数 |
|---|---:|
| schedule | 345 |
| （なし） | 97 |
| factory_runner | 60 |
| monetization_sync | 33 |
| claude_code | 6 |
| claude-code | 5 |
| prompt_queue | 3 |
| codex | 2 |
| boot | 2 |
| review_fix | 1 |

### runStatus 別

| runStatus | 件数 |
|---|---:|
| partial | 275 |
| completed | 268 |
| failed | 11 |

### reviewStatus 別

| reviewStatus | 件数 |
|---|---:|
| needs_followup | 323 |
| needs_human | 148 |
| not_reviewed | 83 |

### changedFiles が 0 件の run

**296件 / 554件（53.4%）**

### 直近60日の日別件数

合計 428件 / 実行があった日 60日 / 最多 72件（08-20）。

```
07-04:8  07-05:4  07-06:7  07-07:11 07-08:5  07-09:1
07-10:2  07-11:5  07-12:3  07-13:5  07-14:5  07-15:4
07-16:5  07-17:4  07-18:4  07-19:10 07-20:35 07-21:5
07-22:6  07-23:5  07-24:4  07-25:4  07-26:4  07-27:5
07-28:4  07-29:4  07-30:4  07-31:4  08-01:4  08-02:4
08-03:4  08-04:4  08-05:4  08-06:4  08-07:4  08-08:4
08-09:7  08-10:13 08-11:11 08-12:5  08-13:6  08-14:4
08-15:5  08-16:4  08-17:4  08-18:5  08-19:5  08-20:72
08-21:3  08-22:11 08-23:11 08-24:13 08-25:8  08-26:8
08-27:8  08-28:8  08-29:9  08-30:7  08-31:1  09-01:1
```

7月下旬〜8月中旬は **1日4件で横ばい**（＝定時4回がそのまま1件ずつ記録された形）。

### 直近10件

| startedAt | runStatus | source | changedFiles | targetTodoTitle（先頭40字） |
|---|---|---|---:|---|
| 09-01T15:29 | completed | （なし） | 0 | 【総括レビュー】自動実行で1本もアプリを完成・公開できな |
| 08-31T00:02 | completed | （なし） | 4 | salvageブランチの調査と、map のパケット分析機能をデ |
| 08-30T08:44 | completed | （なし） | 8 | /root 直下まで含めた git 棚卸し（管理外4本を登録 |
| 08-30T07:00 | completed | monetization_sync | 0 | 収益化候補 定期取り込み（Vault→Hub） 追加0/更新0 |
| 08-30T07:00 | partial | schedule | 0 | Factory schedule (schedule/systemd) |
| 08-30T05:00 | completed | monetization_sync | 0 | 収益化候補 定期取り込み（Vault→Hub） 追加0/更新0 |
| 08-30T05:00 | partial | schedule | 0 | Factory schedule (schedule/systemd) |
| 08-30T02:00 | completed | monetization_sync | 0 | 収益化候補 定期取り込み（Vault→Hub） 追加0/更新0 |
| 08-30T02:00 | partial | schedule | 0 | Factory schedule (schedule/systemd) |
| 08-29T14:00 | completed | monetization_sync | 0 | 収益化候補 定期取り込み（Vault→Hub） 追加0/更新0 |

**所見**
- 直近10件のうち **変更ファイルを伴うのは3件**で、いずれも source が「（なし）」＝**会話からの手動実行**。
- `schedule` 起点の直近3件はすべて `partial` かつ変更0件で、タイトルも「Factory schedule」の外殻ログのみ。定時実行が実作業に到達していない。
- 全体の 53.4% が変更0件。前述の空振りゲート（08-24 導入）以前の分を多く含む。

---

## 3. codex-runs.json

| 項目 | 値 |
|---|---|
| runs 総件数 | **1** |
| status 別 | completed: 1 |
| startedAt 最小/最大 | 2026-05-15T12:43:55（同一） |

### 直近5件（全件）

| runId | startedAt | status | sandbox | promptUsed（先頭60字） |
|---|---|---|---|---|
| `cx-20260515-124355-d496` | 05-15T12:43 | completed | read-only | `Reply with exactly one word: pong. Do not run any commands.` |

**所見**
- 記録は **疎通テスト1件のみ**。しかも `sandbox: read-only` で、ファイルを書けない設定。
- 2026-05-15 以降、この経路経由の Codex 実行は1件も記録されていない。

---

## 4. automation-log.ndjson

| 項目 | 値 |
|---|---|
| 総件数 | **2,598** |
| at 最小 | 2026-05-30T16:09:47 |
| at 最大 | 2026-08-30T07:02:14 |

### event 別

| event | 件数 |
|---|---:|
| factory_schedule | 816 |
| ai_review | 473 |
| factory_goal_step_epic_created | 250 |
| blocked_decisions_ensured | 242 |
| urgent_issues_recorded | 240 |
| skill_maintenance | 236 |
| factory_backpressure | 149 |
| app_proposal_generated | 62 |
| factory_goal_proposal_requested | 43 |
| approval_effect_applied | 28 |
| monetization_sync | 26 |
| **auto_fallback** | **23** |
| factory_dispatch | **6** |
| app_workspace_created | 2 |
| **factory_epic_completed** | **1** |

### auto_fallback 全23件

| at | fallbackTriggered | codexPromptGenerated | safetyGuard | blockedReason | epicId |
|---|---|---|---|---|---|
| 05-30T16:09 | true | **false** | true | disabled,requires_approval,destructive | epic-91 |
| 05-30T16:09 | true | **false** | true | requires_approval,destructive | epic-91 |
| 05-30T16:11 | true | **false** | true | no_codex_candidate | epic-tmp-test |
| 05-30T16:12 | true | **true** | true | — | epic-tmp2 |
| 05-31T13:05 | true | **false** | true | — | epic-p2-factory-multiple |
| 05-31T13:05 | true | **false** | true | — | epic-p2-factory-multiple |
| 05-31T15:51 | true | **false** | true | — | epic-p2-factory-multiple |
| 06-22T12:30 | true | **false** | true | — | epic-goalstep-goal-execu… |
| 06-22T14:00 | true | **false** | true | — | epic-goalstep-goal-execu… |
| 07-05T02:04 | false | false | true | codex_not_allowed_for_work | epic-goalstep-goal-mqq28 |
| 07-05T05:00 | true | **false** | true | — | epic-progress-root-revie… |
| 07-06T02:09 | true | **false** | true | — | epic-progress-auto-revie… |
| 07-07T02:09 | false | false | true | codex_not_allowed_for_work | epic-goalstep-goal-mqq28 |
| 07-07T05:04 | false | false | true | codex_not_allowed_for_work | epic-goalstep-goal-mqq28 |
| 07-07T07:05 | false | false | true | codex_not_allowed_for_work | epic-goalstep-goal-mqq28 |
| 07-07T14:05 | false | false | true | codex_not_allowed_for_work | epic-goalstep-goal-mqq28 |
| 07-08T02:08 | false | false | true | codex_not_allowed_for_work | epic-goalstep-goal-mqq28 |
| 07-11T05:02 | false | false | true | requires_claude | epic-goalstep-goal-mqncv |
| 07-19T02:14 | false | false | true | requires_claude | epic-goalstep-goal-mqncv |
| 07-19T14:09 | true | **false** | true | — | epic-goalstep-goal-mqrj2 |
| 07-20T02:34 | true | **false** | true | — | epic-goalstep-goal-mqluk |
| 07-20T02:42 | true | **false** | true | — | epic-goalstep-goal-mqrj2 |
| 07-20T05:49 | true | **false** | true | — | epic-goalstep-goal-mqqmh |

集計: `fallbackTriggered=true` **15件** / `codexPromptGenerated=true` **1件**（05-30 のテスト時のみ）。
`safetyGuard=true` は **23件すべて**。

### blockedReason の語 出現ランキング

| 語 | 回数 |
|---|---:|
| codex_not_allowed_for_work | 6 |
| requires_approval | 2 |
| destructive | 2 |
| requires_claude | 2 |
| disabled | 1 |
| no_codex_candidate | 1 |

**所見**
- fallback が起動した15件のうち、**Codex 用プロンプトが生成されたのは1件だけ**（それも05-30のテスト epic）。実運用の fallback は全て「起動したがプロンプト未生成」で終わっている。
- `blockedReason` が空欄のまま `codexPromptGenerated=false` の組み合わせが11件あり、**なぜ生成されなかったかがログから判別できない**。
- `factory_epic_completed` は 2,598件中 **1件**。`factory_dispatch` も6件。

---

## 5. 設定と対象母数

### automation-config.json（全キー）

| キー | 値 |
|---|---|
| `executorMode` | `both` |
| `autoResume` | `false` |
| `autoFallback` | `true` |
| `factoryEnabled` | `true` |
| `factoryMaxPerEpic` | `3` |
| `updatedAt` | `2026-06-27T01:42:04.512Z` |

### epics.json（294件）

| 区分 | 内訳 |
|---|---|
| status | done 286 / active 8 |
| decisionPolicy | autonomous 294（**全件**） |
| factoryEligible=true | **293**（99.7%） |
| riskFlags 上位 | `deploy` 5 のみ |

### goals.json（168件）

| status | 件数 |
|---|---:|
| proposed | 65 |
| paused | 45 |
| done | 45 |
| active | 9 |
| dropped | 4 |

**所見**
- `factoryEnabled=true` かつ `factoryEligible` が 293/294。**設定・母数の側に「実行できない理由」は無い**。
- riskFlags はほぼ空（`deploy` 5件のみ）で、危険判定による全体停止も起きにくい状態。
- 一方で goal は proposed 65 + paused 45 = **110件が未着手のまま滞留**しており、active は9件。

---

## 6. Codex 実行経路の二重化

### 参照関係

| 対象 | 参照元 |
|---|---|
| `lib/codex-runner.ts` | `app/api/codex/runs/route.ts` / `app/api/codex/status/route.ts` |
| `app/api/codex/runs` | `components/codex/CodexTrigger.tsx`（画面ボタン） |
| `lib/executors/codex.ts` | `lib/executors/index.ts`（adapter 登録） |
| `lib/codex-run-storage.ts`（`codex-runs.json` の読み書き） | `app/api/codex/runs/route.ts` / `app/api/codex/runs/[runId]/route.ts` |

### 経路ごとの整理

| 経路 | classifyCodexEligibility を通るか | 実行結果の記録先 |
|---|---|---|
| **経路A**: `lib/executors/codex.ts`（Factory の自動実行） | **通る**（adapter 内で判定） | `execution-runs.json`（factory-runner が `addExecutionRun`） |
| **経路B**: `lib/codex-runner.ts` → `app/api/codex/runs`（画面の CodexTrigger） | **通らない** | `codex-runs.json`（`codex-run-storage.ts` 経由） |

補足: `lib/factory-runner.ts` 自体は `classifyCodexEligibility` を直接呼ばず、adapter 側（経路A）に委ねている。

**所見**
- Codex の実行経路は**2本あり、記録先が別ファイルに分かれている**。片方だけ見ても全体像が掴めない。
- 経路B は eligibility ゲートを通らないが、記録は `codex-runs.json` に1件（テスト）しかなく、実質使われていない。
- 推測: `codex-runs.json` が5月から更新されていないのは、自動実行が経路A（`execution-runs.json` へ記録）を使っており、経路Bは画面から手動で押したときだけ動くため。

---

## 7. eligibility の実効性

### 現状のシグナル定義（`lib/codex-eligibility.ts`）

**CODEX_ALLOW_SIGNALS**
```
lint, typecheck, type check, build, test, テスト, document, docs, ドキュメント,
vault, integ, issue, ui, copy, 文言, リファクタ, 整理, スタイル, format
```

**CODEX_DENY_SIGNALS**
```
課金, billing, 本番db, production db, 本番, destructive, 削除, drop , truncate,
secret, token, 認証, credential, 外部公開, publish, deploy, デプロイ,
pm2, cron, systemd, migration, マイグレーション, スキーマ変更, .env
```

### epics.json 全294件に適用した結果

（`classifyCodexEligibility(title + goal + doneCriteria)` をスクリプトで実行）

| 判定 | 件数 | 比率 |
|---|---:|---:|
| **eligible = true** | **259** | **88.1%** |
| eligible = false | 35 | 11.9% |

deny の理由別内訳:

| 理由 | 件数 |
|---|---:|
| 安全シグナル未検出のため既定で Claude | 31 |
| 危険シグナル「課金」 | 1 |
| 危険シグナル「pm2」 | 1 |
| 危険シグナル「本番」 | 1 |
| 危険シグナル「認証」 | 1 |

**所見**
- **88.1% が eligible=true** で、eligibility ゲートは Codex 実行の妨げになっていない。
- deny 35件のうち31件は「危険」ではなく「安全シグナルが1つも見つからない」ための既定 Claude 行き。allow リストに載る語（lint/build/test 等）が Epic のタイトルに含まれないだけで落ちている。
- 推測: fallback で `codexPromptGenerated=false` が続いた原因は eligibility ではなく、その手前（候補選定・プロンプト組み立て）にある可能性が高い。

---

## 8. ドキュメントと実装の乖離

### `docs/factory-orchestration-design.md` の冒頭「状態」行

```
> 状態: **設計フェーズ**。Factory 本体は実装しない。Auto Resume / Approval即処理 が安定してから着手する。
```

### 実装ファイルの実在と規模

| ファイル | 状態 | 行数 |
|---|---|---:|
| `lib/factory-runner.ts` | 存在する | **1,103** |
| `lib/factory-dispatch.ts` | 存在する | **370** |
| `lib/factory-schedule.ts` | 存在する | **439** |

### `docs/operations/current-operating-model.md`

```
updated: 2026-08-21
```

**所見**
- 設計書は「Factory 本体は実装しない」と書いたまま、実装は合計 **1,912行** 存在する。設計書が実装に **3か月以上追いついていない**。
- 運用モデル文書の `updated` は 08-21 で、その後の変更（審査提出準備の拡張・ヒットアプリ調査の追加・空振りゲート・自動実行停止）が反映されていない。

---

## この診断で分かったこと

1. **定時実行は停止済み**（factory 4ユニットすべて disabled/inactive）。直近の実作業を伴う run は、すべて会話からの手動実行だった。
2. **Codex は「使える状態」なのに使われていない**。CLI は 0.152.1 でログイン済みだが、`codex-runs.json` の記録は 2026-05-15 の疎通テスト1件のみ。
3. **fallback は起動しても Codex プロンプトを生成できていない**。auto_fallback 23件中 `codexPromptGenerated=true` は1件（テスト）のみで、うち11件は理由がログに残っていない。
4. **eligibility ゲートは詰まりの原因ではない**（Epic の 88.1% が eligible=true、`factoryEligible` も 293/294）。詰まりはその手前の候補選定・プロンプト生成側にある。
5. **実行の 53.4% が変更ファイル0件**で、`factory_epic_completed` は 2,598ログ中1件。設計書は「Factory 本体は実装しない」のまま実装1,912行が動いており、記録・設定・ドキュメントが実態と揃っていない。

---

# 深掘り解析: なぜアプリが完成しなかったのか（追補・2026-09-03）

上の診断で「eligibility は詰まりの原因ではない」と分かったため、
**アーカイブ分を含む全 run（1,480件）** を対象に、実行の中身まで踏み込んで調べた。

## A. 定時実行は「止まっていた」のではなく「回りきっていた」

`source=schedule` の run **539件**の停止理由。

| stopReason | 件数 |
|---|---:|
| `max_runs_reached` | 158 |
| **`epic_done`（doneCriteria 3/3）** | **112** |
| `all_epics_done` | 79 |
| `all_blocked` | 43 |
| `blocked_by_unscoped_danger_decision` | 33 |
| `blocked_by_danger_decision` | 26 |
| `blocked` | 24 |
| `no_candidate` | 18 |
| `run_failed` | 10 |
| `continue`（doneCriteria 1/3） | 10 |
| `rate_limited_no_codex` | 9 |
| `claude_rate_limited / Codex不可` | 9 |

**所見**
- 「実行できなかった」より **「実行して Epic を完了させていた」（112 + 79 = 191件）** の方が多い。
- ブロック系は 43+33+26+24 = 126件で全体の23%。止まっていたのは主因ではない。

## B. 「完了」した Epic 219件は、ほぼ1つのアプリに集中していた

`stopReason` が `epic_done` の run **219件**（アーカイブ込み）の対象アプリ。

| targetApp | 件数 |
|---|---:|
| **ny01-mahjong-analyzer** | **127** |
| company-mgmt | 75 |
| ny01-mahjong-trainer | 10 |
| progress | 4 |
| mahjong | 2 |
| ny01-news-app | 1 |

うち **214件は実際にファイルを変更している**（変更0件は5件のみ）。
タイトルは 219件すべてが `Factory(auto): … 次の一歩` の形式。

**所見**
- 空振りしていたのではない。**mahjong-analyzer に対して127回、実際に手を動かして「次の一歩」を完了していた**。
- それでもアプリは完成しなかった。つまり問題は「動かないこと」ではなく **「動いた先が完成に向いていないこと」**。

## C. 同じファイルを何十回も往復していた

mahjong-analyzer 向けの全実行 **155件**（2026-07-20 〜 08-22）が触ったファイル。

| 回数 | ファイル |
|---:|---|
| 32 | `mahjong-analyzer/components/HandInput.tsx` |
| 29 | `mahjong-analyzer/app/page.tsx` |
| 26 | `expo/App.tsx` |
| 25 | `components/HandInput.tsx` |
| 22 | `App.tsx` |
| 21 | `lib/mahjong/analyzer.test.ts` |
| 19 | `app/page.tsx` / `lib/mahjong/analyzer.ts` |
| 17 | `lib/mahjong/analyzer.ts`（別パス表記） |

触ったファイルは121種あるが、**上位はすべて同じ数ファイル**。
しかも同じファイルが `components/HandInput.tsx` と `mahjong-analyzer/components/HandInput.tsx` の
**異なるパス表記で二重計上**されている＝作業ディレクトリが実行ごとにブレていた。

**所見**
- 155件の summary は**すべて異なる**（重複0）。毎回「違うことをやっている」つもりだった。
- しかし触っているファイルは同じ。**新しい作業に見えて、同じ場所を作り直していた**。

## D. 決定的: フェーズが前進せず往復していた

各 run の rawReport から「現在フェーズ」を抽出（145件に記載あり）。フェーズが変わった瞬間だけ抜粋。

```
07-20 02:46  ① 基盤
07-20 02:58  ③ 品質仕上げ
07-20 03:00  ② 機能完成      ← 戻る
07-20 03:03  ③ 品質仕上げ
07-20 03:06  ② 機能完成      ← 戻る
07-20 03:09  ③ 品質仕上げ
07-20 03:12  ② 機能完成      ← 戻る
   （以下 ②↔③ を往復）
07-20 03:46  ④ 公開準備（フェーズ③のクラッシュ復旧…）
07-20 05:00  ③ 品質仕上げ    ← ④から戻る
07-20 07:03  ④ 公開準備（未完了）
─────────────── 1か月の空白 ───────────────
08-20 12:26  ③ 品質仕上げ    ← ④から③へ後退
08-20 17:26  ① 基盤（Expo移行準備）  ← ③から①へ後退
08-20 17:40  ④公開準備の棚卸し。ただし最終技術スタ…
08-20 17:45  ③ 品質仕上げ
08-20 18:13  ① 基盤
08-20 18:19  ①基盤
08-20 18:31  ① 基盤
08-20 18:42  ② 機能完成
08-20 18:56  ①基盤            ← また①へ
08-20 19:16  ① 基盤
08-20 20:05  ③ 品質仕上げ
```

**7/20 に一度「④公開準備」へ到達したが、8/20 には「①基盤」まで戻っている。**

さらにフェーズ表記そのものが `③ 品質仕上げ` / `③品質仕上げ` / `**③ 品質仕上げ**` と
**揺れており、機械的に前進を判定できない状態**だった。

**所見**
- フェーズは単調増加せず、**①〜④を往復**していた。完成に近づく設計になっていない。
- 8/20 に「Expo移行準備」で①へ戻っているのは、**技術スタックの選び直しが自動実行の中で起きた**ため
  （後に人間が「Capacitor 継続・Expo 不採用」と決定）。方針が固まっていない状態で実装を回していた。

## E. 8/20 に何が起きたか — 1日120回の暴走

| 項目 | 値 |
|---|---|
| 8/20 の実行回数（mahjong-analyzer のみ） | **120回** |
| 時間帯 | 12:26 〜 20:17（約8時間） |
| 実行間隔の中央値 | **3.8分** |
| この日に作られた Epic | **109種** |
| mahjong-analyzer 向け Epic 総数 | **129個**（実行155回 = 1 Epic あたり 1.2回） |

**所見**
- 定時4回のはずが、8時間で120回・平均3.8分間隔で回っていた。
  `epic_done` → 次 Epic 生成 → 実行 → `epic_done` … が連鎖したと考えられる。
- **1 Epic あたり平均1.2回**。つまり「1回実行しては新しい Epic を作る」を繰り返していた。
  Epic が作業単位として機能せず、**使い捨ての1回分タスク**になっていた。
- 推測: `maxPerEpic=3` は「同一 Epic の深掘り上限」であって「1起動の総実行数」ではないため、
  Epic を次々に作れば無制限に回り続ける構造だった。

## F. 根本原因（構造の問題）

ここまでの事実から、以下の連鎖が起きていたと整理できる。

```
Goal「アプリを作る」に配下作業が無い
        ↓
「次の一歩」Epic を自動生成（ensureNextGoalStepEpic）
        ↓
1回実行して doneCriteria 3/3 を満たす → epic_done
        ↓
Goal は未達成のまま → また「次の一歩」Epic を生成
        ↓
（129 Epic / 155実行 が3.8分間隔で連鎖）
```

**問題は4点。**

1. **完了の単位が小さすぎた** — doneCriteria が「その1回の作業が終わったか」で判定され、
   Epic が使い捨てになった。1 Epic = 1.2実行。
2. **前進の判定が無かった** — フェーズは記録されていたが**表記が揺れ、機械判定に使われていなかった**。
   ①へ戻っても誰も止めない。
3. **完成の定義が実行側に無かった** — 「App Store 提出可能」がゴールなのに、
   各 Epic は「HandInput.tsx を直す」レベル。**ゴールと Epic の粒度が2〜3段違う**。
4. **方針未確定のまま実装を回した** — Capacitor か Expo かが決まっていない状態で、
   両方の実装を交互に進めていた（`expo/App.tsx` 26回・`App.tsx` 22回）。

## G. 数字で見た結論

| 指標 | 値 | 意味 |
|---|---|---|
| 全 run | 1,480 | よく回った |
| うち Epic を完了させた run | 219 | 動いていた |
| うち mahjong-analyzer 向け | 127 | 1アプリに集中投下した |
| 変更を伴った run（全体） | 733（49%） | 半分は空振り |
| mahjong-analyzer の Epic 数 | 129 | **使い捨てだった** |
| 1 Epic あたりの実行 | 1.2回 | **深掘りされていない** |
| フェーズの到達点 | ④→①へ後退 | **前進していない** |
| 完成したアプリ | **0本** | — |

**所見**
- 「サボっていた」のでも「壊れていた」のでもない。**127回きちんと働いて、完成に向かわなかった**。
- 推測: 同じ工数を「1つの Epic を10回深掘りする」に使えば、結果は変わった可能性がある。
  実際には「129個の Epic を1.2回ずつ」使い、毎回入口に戻っていた。

## H. 次に変えるなら（提案）

1. **Epic を使い捨てにしない** — `epic_done` の直後に同じ Goal へ新しい Epic を生成しない。
   1つの Epic を最低 N 回は深掘りする、または生成間隔に下限を置く。
2. **フェーズを機械可読にして単調増加を強制** — 表記揺れを排し（enum 化）、
   前フェーズへ戻る遷移は「後退」として記録・警告する。
3. **1起動の総実行数に上限を置く** — `maxPerEpic` は同一 Epic 用で、Epic を増やせば無制限。
   1起動あたりの総 run 数にも cap が要る（8/20 の120回を防ぐ）。
4. **方針未確定の Goal は実装フェーズに入れない** — 技術スタック等の分岐が未決なら、
   実装ではなく「今日の判断」へ上げる。
5. **完成の定義を Epic 側に持たせる** — 「App Store 提出可能」を分解した
   チェックリスト（アイコン/スクショ/メタデータ/ビルド/審査項目）を Goal に固定し、
   各 Epic がそのどれを埋めたかを記録する。

## この深掘りで分かったこと

1. 自動実行は**止まっていなかった**。むしろ 219 回 Epic を完了させ、214回は実際にファイルを変更していた。
2. mahjong-analyzer には **127回・8時間で120回**という集中投下が起きていたが、
   触っていたのは同じ数ファイルの往復だった。
3. **フェーズが ④→③→① と後退**しており、完成へ単調に近づく構造になっていなかった。
4. Epic が **1.2回で使い捨て**になり、129個作られた。深掘りではなく作り直しを繰り返していた。
5. 根本原因は「実行できないこと」ではなく **「完了の単位・前進の判定・完成の定義」が実行側に無かったこと**。
