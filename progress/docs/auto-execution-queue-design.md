# 自動実行キュー管理（Auto Execution Queue）設計書

> 状態: **設計フェーズ（実装しない）**。本書は Codex 実装用の仕様書。
> 原則: **Progress を唯一の管制塔**とする。**新しい正本を作らない**。自動実行キューは Epic / Goal / ExecutionRun という既存正本から**都度生成する派生ビュー**であり、ユーザーの手動操作だけを既存正本へ薄く書き戻す。
> 関連既存設計: `docs/factory-orchestration-design.md`（Factory 進行制御）／`lib/types/operations.ts`（Epic Contract）／`lib/queue-split.ts`（Human/AI Queue 分離）。

---

## 0. 用語

| 語 | 意味 |
|---|---|
| Work item | 自動実行の最小単位。実体は **Epic** または **Goal直下の GoalTodo（Epic未生成）**。 |
| 自動実行キュー | 実行可能 Work item を優先順位順に並べた**派生ビュー**（正本ではない）。 |
| Factory | キュー先頭の安全な Work item を無人で連続実行する上位ループ（既存設計）。 |
| executor | 実行者抽象。`codex` / `claude` / `fable` / `manual`。 |
| 判断待ち | 人間が動かないと進まない作業（`waiting_user`）。 |
| AI保留 | AI 側が自分で再開できる一時停止（`ai_hold`）。 |

---

## 1. 現状課題の整理

### 1.1 観測されている症状
- 司令塔トップの「次にやること」が、ユーザー意図と違う案件（例: 野鳥観察系）を先頭に出す。
- 「今日やること / あなたの番 / AI保留 / レビュー待ち / Inbox / Project進捗」が**別々の画面・別々のロジック**に散らばっている。
- 何が工場を止めているのか、なぜその順番なのかが画面から説明できない。

### 1.2 根本原因
1. **正本が二重化している。**
   - 旧: `data/real/work-queue.json`（`WorkQueueItem`）= **project-tasks 由来**。優先度は `high/medium/low`、並びは `autoOrder = priority score + status bonus`（`lib/session-writer.ts: regenerateAutoOrder`）。
   - 新: **Epic Contract**（`lib/types/operations.ts`）= `priority P0/P1/P2` / `factoryEligible` / `riskFlags` / `decisionPolicy` / `preferredExecutor`。Factory Dispatch はこちらを見る。
   - → 司令塔トップが旧 work-queue を見ているため、`factoryEligible=false` や Goal 優先度を**無視した**並びになり、未整理・低関連の案件が先頭に来る。
2. **未整理（Inbox）と実行可能（Epic）が同じ土俵に並ぶ。** triage 前のタスクが候補に混ざる。
3. **gating が「全体停止」型になりがち。** レビュー待ち・低優先確認が、無関係な実行可能タスクまで止めて見える。
4. **状態語彙が分散。** `TaskStatus`（9値）/ `Epic.status`（10値）/ `ReviewStatus` / Approval が別軸で、ユーザー向けの統一ステータスが無い。

### 1.3 設計のゴール（受け入れ条件）
ユーザーが毎日トップを見るだけで以下が分かる:
- 次に工場が何をやるか / なぜそれが次か / 自分が判断しないと止まるものは何か / 後回しでよいレビューは何か / どの Goal・Project が進んでいるか。
そして**低優先レビュー・AI保留で工場全体が止まらない**。

---

## 2. 推奨する全体設計

### 2.1 正本の確定（論点: 正本は Goal / Project / Todo / Epic のどれか）

| 層 | 役割 | 正本性 |
|---|---|---|
| **Goal** | 上位分類・優先度の親。配下に方針を持つ。 | **分類正本**（実行はしない） |
| **Project** | アプリ/案件のくくり。Goal をまたぐこともある表示軸。 | 表示軸（実行単位ではない） |
| **Epic** | **実行契約**。doneCriteria / priority / riskFlags / decisionPolicy / executor / factoryEligible を持つ。 | **実行正本（Work item の本体）** |
| **GoalTodo** | Goal 直下の細目。Epic 化前の Work item になり得る。 | 補助実行単位（Epic 未生成時のみキューに乗る） |
| **ExecutionRun** | 実行履歴。 | **履歴正本** |

**結論:**
- **実行の正本は Epic。** 「自動実行される単位」は Epic（または Epic 未生成の GoalTodo）。
- **Goal は上位分類かつ優先度の親**で、配下 Epic/GoalTodo に優先度を**伝播**する。
- **Project は表示・集計の軸**であり実行単位ではない。
- **自動実行キューは新しい正本を持たない。** Epic/GoalTodo から都度計算する派生ビュー。
- **ユーザーの手動操作だけ**を Epic/GoalTodo に薄いフィールド（`queueControl`）として書き戻す（§7.3）。

> Why: 既存原則「新しい正本を作らない」を守る。二重正本（work-queue.json）が現症状の原因なので、**work-queue.json を実行正本から降格**し、Epic ベースのキュー生成へ寄せる（§10.4 に移行手順）。

### 2.2 自動実行キューの粒度（論点: キューはどの粒度で持つべきか）
- **行 = 1 Work item = 1 Epic（基本）/ 1 GoalTodo（Epic未生成の例外）。**
- Goal は行にしない（親としてヘッダ/フィルタに出す）。Project も行にしない（フィルタ軸）。
- 1 Epic に複数 doneCriteria があっても**キュー上は 1 行**。実行は Factory が doneCriteria を 1 件ずつ消化する（既存挙動を踏襲）。

### 2.3 単一ビュー原則
「今日やること / あなたの番 / AI保留 / レビュー待ち / Inbox / Project進捗」を**1 本の派生計算**から出す。各画面はこの 1 つの `buildAutoQueue()` の結果を**フィルタ表示**するだけにする（別ロジックを増やさない）。

```
既存正本（Epic / Goal / ExecutionRun / Approval / RecommendedEpic / Inbox）
        │  buildAutoQueue()  ← 唯一の派生計算
        ▼
AutoQueueView {
  next,                // 次回自動実行予定（1件）
  candidates[3],       // 次回候補3件
  executable[],        // status=executable
  waitingUser[],       // 判断待ち（人間が動かないと進まない）
  aiHold[],            // AI保留
  reviewWaiting[],     // レビュー待ち
  blocked[],           // ブロック
  counts{...},         // 各件数
  goalProgress[],      // Goal別進捗
  reasonByItem{}       // なぜその順位か（説明文）
}
        ▼
司令塔トップ / キュー画面 / 判断待ち画面 / Goal別 / Project別  ← 全部これをフィルタ表示
```

---

## 3. 画面構成案

| 画面 | パス | 役割 | 表示元 |
|---|---|---|---|
| 司令塔トップ | `/` | 1 日 1 回これだけ見れば済む最小ダッシュボード | `AutoQueueView`（要約） |
| 自動実行キュー | `/queue` | 並び替え・pin・保留・除外の操作正面 | `AutoQueueView.executable + 全Work item` |
| 判断待ち | `/decisions`（既存 /approvals を拡張 or 統合） | 人間判断が必要なものだけ | `waitingUser` |
| Goal別ビュー | `/queue?group=goal` または `/goals` | Goal ごとにまとめたキュー + Goal優先度操作 | `AutoQueueView` を goalId で group |
| Project別ビュー | `/queue?group=project` | Project ごとの最新作業 + 進捗 | `AutoQueueView` を projectId で group |
| Inbox | `/inbox`（既存） | 未整理 → triage（Goal/Epic へ振分け）専用。**キューには出さない** | `InboxItem` |
| 運用ページ | `/operations`（既存拡張） | ルール説明（status / 優先度式 / gating / executor） | 静的 + `current-operating-model.md` |

> スマホ前提: トップは縦 1 カラム。操作はすべて**行スワイプ or 行内ボタン**で完結（ドラッグ並べ替えは補助、1つ上/1つ下ボタンを主操作にする）。

---

## 4. 司令塔トップの改善案（論点: トップで何を最小表示すべきか）

**最小表示（上から順、スマホ 1 画面で収まる量）:**

```
┌──────────────────────────────┐
│ ▶ 次回自動実行予定                          │  ← 1件だけ大きく
│   [Codex] mahjong: ロン判定の精度改善          │
│   なぜ次か: P0 ×Goal「麻雀収益化」最優先 / 実行可 │
│   Goal: 麻雀収益化   doneCriteria 2/5          │
│   [今すぐ実行待ち]                            │
├──────────────────────────────┤
│ 次回候補 3件                                  │
│  2. [Codex] news: research整形バグ  P1         │
│  3. [Claude] progress: queue UI    P1         │
├──────────────────────────────┤
│ 判断待ち 3 │ AI保留 2 │ レビュー 5 │ 実行可 8 │ Block 1 │ ← タップでフィルタ遷移
├──────────────────────────────┤
│ Goal別進捗                                    │
│  麻雀収益化      ███░░ 3/5  最終 6/12          │
│  ニュース自動化   ██░░░ 2/6  最終 6/13          │
└──────────────────────────────┘
```

**トップに出すもの（これだけ）:**
1. 次回自動実行予定（1件）= `executor` chip / Goal / `doneCriteria` 進捗 / **次回実行理由**。
2. 次回候補 3件（番号・executor・priority のみ）。
3. 5 カウンタ: **判断待ち / AI保留 / レビュー待ち / 実行可能 / blocked**（タップで該当フィルタへ）。
4. Goal別進捗ミニバー（最終作業日つき）。

**トップに出さないもの（タップで深掘り）:** rawReport、個別 ExecutionRun、blocker 詳細、Inbox 全文、Project 全一覧。

> Why 最小化: 「毎日少し判断するだけ」を実現するため、トップの認知負荷を `判断待ち件数` に集約する。判断待ちが 0 なら工場は勝手に正しく回っている、という状態を 1 秒で読めるようにする。

---

## 5. 自動実行キュー画面（`/queue`）の設計

### 5.1 レイアウト（スマホ縦 1 カラム）
- 上部に**フィルタチップ**: `すべて / 実行可能 / 判断待ち / AI保留 / レビュー待ち / Block` ＋ `group: なし/Goal/Project`。
- 各行（Work item カード）:

```
┌─────────────────────────────┐
│ #1  P0  [Codex]  ● 実行可能                  │
│ mahjong: ロン判定の精度改善                    │
│ Goal 麻雀収益化 · Project mahjong             │
│ 次の理由: 明示pin＋P0＋Goal最優先              │
│ doneCriteria 2/5 · 最終 6/12                  │
│ [⤴最優先] [↑] [↓] [保留] [対象外] [詳細]       │
└─────────────────────────────┘
```

### 5.2 行に出す情報（要求「画面に欲しい情報」を全網羅）
`#queueOrder` / `priority(P0-P2)` / `status バッジ` / `preferredExecutor`（fallback も詳細で）/ タイトル / Goal / Project / **次回実行理由** / `doneCriteria 進捗` / **最終作業日** / `factoryEligible` アイコン / `decisionPolicy` / **ブロック理由**（blocked 時）。

### 5.3 行アクション（要求「ユーザーが操作したいこと」を全網羅）
| ボタン | 動作 | 書き戻し先（§7.3） |
|---|---|---|
| ⤴ 最優先 | この item を pin して最上位固定 | `queueControl.pinnedTop=true` / `pinnedAt` |
| ↑ / ↓ | 1つ上 / 1つ下へ | `queueControl.manualOrder` 入替 |
| 保留 | AI保留へ（人手不要で後でAI再開可） | `queueControl.hold=true` → status=`ai_hold` |
| 対象外 | 自動実行対象から外す | `factoryEligible=false` |
| 詳細 | Epic 詳細へ（doneCriteria / runs / executor） | 遷移のみ |

- **判断が必要なものだけ見る** = フィルタ `判断待ち`。
- **後回しレビューを分離** = `レビュー待ち` フィルタ。実行可能リストには出さない。
- **AIに任せてよいものだけ候補に** = `factoryEligible=true` のみ `executable` に入る（§8 ゲート）。

### 5.4 並べ替えの正本性
- 表示順は §8 の計算結果（`queueOrder`）。
- ユーザー操作は `queueControl`（pin / manualOrder / hold）に**だけ**書く。再計算は `queueControl` を最優先で尊重して並びを作る（手動操作が自動計算に上書きされない）。

---

## 6. Goal / Project / Todo / Epic の関係整理

```
Goal（分類・優先度の親）  priority: P0-P2, status
 ├─ phases[]
 ├─ GoalTodo[]   role(human/claude/codex), priority, doneCriteria, status
 │     └─（承認で Epic 化）──┐
 └─ Epic[]  ◄────────────────┘  Epic Contract（実行正本）
       ├─ doneCriteria[]  priority(P0-P2)  riskFlags[]  decisionPolicy
       ├─ preferredExecutor / fallbackExecutor  factoryEligible
       └─ ExecutionRun[]（履歴正本） → nextActions[] → 次 doneCriteria

Project: 表示・集計の横串（Epic.targetApp / Goal.projectId で逆引き）
```

- **Goal優先度 → 配下へ伝播**（§8.3）。
- **GoalTodo → Epic 化**は人間承認のみ（既存 RecommendedEpic フロー）。Epic 化前の GoalTodo は `role=codex/claude` かつ `factoryEligible` 相当なら**例外的にキューに乗せる**（小タスクを Epic 化せず流すため）。
- **Project は実行に関与しない**（並べ替え対象でもない）。Project 優先度操作は「その Project 配下の Epic 群へ boost」を意味する（§8.3）。

---

## 7. データ構造案

> 方針: 既存 `Epic` / `Goal` / `GoalTodo` を**拡張**する（新ファイルは `queueControl` 相当の最小限のみ）。自動実行キュー自体は永続化しない（派生）。

### 7.1 統一ステータス（ユーザー向け）— `WorkItemStatus`
既存の分散ステータスから**計算で導出**する 1 本の語彙（要求のステータス案を採用）。

```ts
type WorkItemStatus =
  | 'executable'     // AIが自動実行できる（factoryEligible かつ承認/依存OK）
  | 'waiting_user'   // 人間判断が必要（方針/承認）。工場の先頭にはしない
  | 'ai_hold'        // AI側で保留（依存待ち等）。AIが自分で再開できる
  | 'review_waiting' // レビュー待ち。重要度低なら工場を止めない
  | 'blocked'        // 依存/エラーでブロック。自動実行しない
  | 'manual'         // 手動対応のみ（decisionPolicy=manual）
  | 'done'           // 完了
```

**導出規則（優先順に最初に当たったものを採用）:**
1. Epic.status ∈ {done, merged} → `done`
2. decisionPolicy=`manual` または factoryEligible=false → `manual`（ただし factoryEligible=false は「対象外」表示）
3. blockers が非空 / status=`blocked` → `blocked`
4. Approval 待ち or 危険 riskFlags（billing/production_db/auth_secret/migration/destructive/external_publish）or decisionPolicy=`approval_required` → `waiting_user`
5. 紐づく最新 Run.reviewStatus=`needs_human` → `waiting_user`
6. 紐づく最新 Run.reviewStatus ∈ {not_reviewed, copied} かつ Run.runStatus≠failed → `review_waiting`
7. queueControl.hold=true または 依存 Epic 未完 → `ai_hold`
8. それ以外で factoryEligible=true → `executable`

### 7.2 Epic 拡張フィールド（既存 Epic に追加）
```ts
interface Epic {
  // ... 既存（doneCriteria, priority, riskFlags, decisionPolicy,
  //         preferredExecutor, fallbackExecutor, factoryEligible, blockers, latestRunId, goalId, targetApp）
  queueControl?: QueueControl   // ★追加: ユーザー手動操作の書き戻し先
}

interface QueueControl {
  pinnedTop?: boolean    // 最優先固定
  pinnedAt?: string      // pin 時刻（複数 pin の並びに使用）
  manualOrder?: number   // ユーザーが上下移動で確定した相対順位（小さいほど上）
  hold?: boolean         // ユーザーが「保留」した → ai_hold へ
  excludedByUser?: boolean // 「対象外」操作（= factoryEligible を false に倒した記録）
  updatedBy?: 'user' | 'system'
  updatedAt?: string
}
```

### 7.3 Goal / Project 優先度操作
```ts
interface Goal {
  // ... 既存（priority: P0-P2 相当 / status）
  priorityBoost?: 0 | 1 | 2  // ★追加: 配下へ効く加点（§8.3）
  pinnedTop?: boolean         // ★Goal丸ごと最優先
}
// Project の boost は永続化しない案も可。最小実装は Goal boost のみ。
// 必要なら projects.json に projectBoost を追加。
```

### 7.4 派生ビュー型（永続化しない）
```ts
interface AutoQueueItem {
  workItemId: string          // epic:<epicId> または todo:<goalTodoId>
  type: 'epic' | 'goal_todo'
  title: string
  goalId?: string; goalTitle?: string
  projectId?: string; projectName?: string
  status: WorkItemStatus
  priority: 'P0' | 'P1' | 'P2'
  factoryEligible: boolean
  decisionPolicy: DecisionPolicy
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  doneCriteriaTotal: number; doneCriteriaDone: number
  blockers: string[]
  lastRunAt?: string          // 最終作業日
  queueScore: number          // §8 の合成スコア
  queueOrder: number          // 1始まり表示順
  reason: string              // なぜこの順位か（人間可読1行）
  reasonFactors: string[]     // ['明示pin','P0','Goal最優先','factoryEligible']
}

interface AutoQueueView {
  next: AutoQueueItem | null
  candidates: AutoQueueItem[]      // 先頭3（executable のみ）
  executable: AutoQueueItem[]
  waitingUser: AutoQueueItem[]
  aiHold: AutoQueueItem[]
  reviewWaiting: AutoQueueItem[]
  blocked: AutoQueueItem[]
  manual: AutoQueueItem[]
  counts: Record<WorkItemStatus, number> & { inbox: number }
  goalProgress: GoalProgressRow[]
  generatedAt: string
}
```

---

## 8. 優先順位計算ルール

### 8.1 入力ゲート（候補から外す。論点: factoryEligible / blocked / waiting_user）
`executable` 集合に入れる条件（**全て満たす**）:
- `factoryEligible === true`（false は自動実行しない＝候補から除外）
- `status === 'executable'`（§7.1 の導出で blocked / waiting_user / ai_hold / review_waiting / manual / done は除外）
- 依存 Epic（dependsOn 相当）が未完でない

→ **waiting_user / blocked は executable に入らない**ので、定義上「自動実行候補の先頭」にならない。review_waiting / ai_hold も同様に candidates から外れる（= 低優先レビュー・AI保留が工場を止めない。§8.4）。

### 8.2 スコア計算（executable のみを並べる）
合成スコア（大きいほど上）:
```
queueScore =
    pinScore        // 明示pin: pinnedTop ? 100000 - pinRank : 0   （最強）
  + priorityScore   // P0=900, P1=600, P2=300
  + goalBoostScore  // Goal.priorityBoost(0/1/2) ×150 + (Goal.pinnedTop?400:0)
  + projectBoost    // Project boost(0/1/2) ×80（任意実装）
  + freshnessScore  // 直近 nextActions あり: +50 / 7日以上停滞: -40
  - agePenalty      // queueControl.manualOrder があればそれを最優先で尊重（下記）
```
**タイブレーク（同点時の最終並び）:**
1. `queueControl.manualOrder`（ユーザーが上下移動で確定した順、昇順）
2. `priority`（P0>P1>P2）
3. `lastRunAt` の新しい順（または `updatedAt`）
4. `epicId` 安定ソート

> 実装メモ: pin と manualOrder の関係 = **pin はグループ最上段に集める**、その中の細かい上下は manualOrder。pin が無いものは score 降順 → 同点は manualOrder → updatedAt。

### 8.3 Goal優先度 vs item優先度の矛盾解決（論点）
**ルール: Goal優先度は配下アイテムに「下限ブースト（floor boost）」として効く。アイテムが自前で更に高ければアイテムが勝つ。ユーザーの明示 pin は全てに勝つ。**

優先順位の強さ:
```
1. アイテムの明示 pin（queueControl.pinnedTop）           ← 最強
2. Goal の pinnedTop（その Goal 配下を一段持ち上げる）
3. priority(P0-P2) ＋ Goal.priorityBoost の合算
4. アイテム自前 priority
5. manualOrder / lastRunAt
```
- 例: Goal「麻雀収益化」が `pinnedTop`、配下 Epic が P1 でも、別 Goal の P0 単発より上に来る（Goal pin が勝つ）。
- 例外: ユーザーが別 Goal の Epic を明示 pin したら、それが最上段（個別 pin が Goal pin に勝つ）。
- **矛盾は「上書き」ではなく「加点」で表現**するので、説明（reason）に両方の根拠を併記できる（§8.5）。

### 8.4 「全体が止まる」を防ぐ設計（論点）
- **gating は item 単位。** 1 つの review_waiting / ai_hold / blocked は、その item だけを `executable` から外す。**他の executable はそのまま回る。**
- review_waiting は **importance 判定**を持つ: 危険 riskFlags 無し & priority=P2 & Run.runStatus≠failed → `low importance` とし、**判断待ちに昇格させない**（工場継続、レビューは後追い）。重要（P0/P1 or 危険）レビューのみ `waiting_user` 相当として目立たせる。
- → 「低優先レビューまでやらないと進まない」を構造的に排除。

### 8.5 説明可能性（論点: なぜその順番か）
各 item に `reason`（1行）＋ `reasonFactors`（チップ配列）を必ず付ける。
- 例: `reason = "明示pin＋P0＋Goal『麻雀収益化』最優先のため最上位"`
- `reasonFactors = ['pin', 'P0', 'goal:麻雀収益化(boost+2)', 'factoryEligible', '実行可能']`
- トップ・キュー画面の「次の理由」はこれを表示。**スコアの内訳を機械生成**し、ハードコードの文言にしない。

### 8.6 waiting_user / ai_hold の違い（論点）
| | waiting_user | ai_hold |
|---|---|---|
| 意味 | 人間が判断/承認しないと**永遠に進まない** | AI 都合の一時停止。**AI が自分で再開できる** |
| 例 | 公開可否 / 課金 / 認証 / Goal判断 / needs_human Run | 依存 Epic 待ち / 情報不足で後回し / ユーザーが「保留」操作 |
| 表示 | トップに**件数を目立たせる**（判断待ち） | 件数のみ。詳細はキューのフィルタ内 |
| 工場 | 先頭にしない・自動実行しない | 自動実行しない。条件が解けたら AI が自動で executable へ戻す |
| 解除 | 人間の操作（承認/方針決定） | AI（依存完了検知）/ ユーザーの「保留解除」 |

---

## 9. ユーザー操作フロー（スマホ）

1. **朝、トップを開く。** 判断待ち件数を見る。0 なら「OK、工場は正しく回ってる」で離脱可。
2. 判断待ち > 0 → カウンタをタップ → `/decisions`。**判断が必要なものだけ**が並ぶ。
3. 各カードで「承認 / 却下 / 方針コメント」。承認した瞬間その item は `executable` に落ち、次サイクルでキューに入る。
4. 次回予定が意図と違う → トップの次回予定を**長押し or [詳細]** → キュー画面。
   - 「⤴最優先」で pin / 「保留」で外す / 「対象外」で factory から外す / 「↑↓」で微調整。
5. Goal 単位で上げたい → Goal別ビューで Goal の `pinnedTop` or boost を上げる → 配下が一括で上がる。
6. 並べ替えても**自動計算に上書きされない**（queueControl が尊重される）。

> 1 操作 = 1 タップで完結。確認ダイアログは「対象外（factory から外す）」のみ（取り消し可能なトースト付き）。

---

## 10. AI工場（Factory）自動実行との接続

### 10.1 接続点
- Factory（`docs/factory-orchestration-design.md`）は **`buildAutoQueue().next`（先頭の executable）を pick** する。
- Factory 専用の優先度判定を持たない。**本書 §8 の queueScore を唯一の進行順**とする。
- 実行後は ExecutionRun を登録（既存）。`buildAutoQueue` は次サイクルで再計算され、done が落ち次が繰り上がる。

### 10.2 executor の決定と表示（論点: Codex/Claude/Fable のどれを使うか）
- 各 Work item の `preferredExecutor` / `fallbackExecutor` を**そのまま表示**（chip）。
- 実行者選択は既存 `pickExecutor(config, limitedSet)` に委譲: preferred が rate-limited なら fallback。
- トップ/行の chip 仕様: `[Codex]`（preferred）。fallback がある場合 詳細に `claude上限時→codex` と注記。
- `manual` executor の item は `executable` に入れない（status=`manual`）。

### 10.3 停止しない保証
- Factory は executable が 1 件でもあれば回り続ける（§8.4）。
- executable が 0 かつ waiting_user>0 → 「人待ち」で idle（停止理由を表示）。
- これにより「レビュー待ち/AI保留が残っていても executable があれば回る」を満たす。

### 10.4 旧 work-queue.json からの移行（重要）
- **司令塔トップの表示元を work-queue.json → `buildAutoQueue()` に差し替える**（これが野鳥問題の直接修正）。
- work-queue.json は当面**読み取り後方互換のみ**残し、新規の自動実行判断には使わない。
- `regenerateAutoOrder`（priority high/med/low）は **Epic ベースの queueScore に置換**。project-tasks 由来の low-relevance タスクは Inbox/triage 経由でしか Epic 化されないため、未整理が候補先頭に出なくなる。

### 10.5 Inbox の扱い（論点: Inbox を queue に入れるか）
- **入れない。** Inbox = 未整理。triage（Goal/Epic へ割当 or 破棄）して初めて Work item になる。
- トップには `Inbox N件` を**カウンタ表示のみ**（実行候補には混ぜない）。
- → 野鳥観察のような未整理メモが自動実行候補に出る経路を断つ。

---

## 11. MVP として最初に作る範囲

> 目的: 「野鳥問題を消す」＋「毎日トップだけで判断」を最短で満たす。

1. **`buildAutoQueue()` の実装**（§2.3 / §7.4 / §8）。新正本を作らず Epic/Goal/Run から派生。
2. **司令塔トップの表示元差し替え**（§4 / §10.4）。次回予定1件＋候補3＋5カウンタ＋Goal進捗。
3. **WorkItemStatus 導出**（§7.1）と executable ゲート（§8.1）。
4. **キュー画面 `/queue`** に最低 4 操作: ⤴最優先(pin) / ↑↓ / 保留 / 対象外（§5.3 / §7.2 QueueControl）。
5. **reason 生成**（§8.5）: 次回予定と各行に「なぜ次か」を機械生成で表示。
6. **判断待ちフィルタ**（既存 /approvals を流用してよい）。
7. **Inbox を候補から除外**（§10.5）。

MVP 完了条件: トップで「次回予定／なぜ／判断待ち件数／Goal進捗」が出る ＆ 並べ替え・pin・保留・対象外が効く ＆ 野鳥系（未整理/低関連）が候補先頭に出ない。

---

## 12. 後回しでよい範囲

- Project 単位 boost（Goal boost で代替可。`projectBoost` は後追い）。
- ドラッグ並べ替え（↑↓ボタンで足りる。スマホは後回し）。
- review_waiting の importance 自動判定の精緻化（初期は「危険 or P0/P1 のみ昇格」の単純ルールで可）。
- Factory 本体の無人連続ループ（既存方針どおり Auto Resume 安定後）。
- ai_hold の依存自動解除（初期は手動「保留解除」で可）。
- Goal/Project 横断のスコア可視化（内訳グラフ）。
- executor 追加（Fable 以外）の設定 UI。

---

## 13. 危険な設計・避けるべき設計

1. **新しいキュー正本を永続化する** → 二重正本に逆戻り（現症状の再発）。キューは必ず派生。
2. **全体停止型 gating**（1 つの review_waiting でキュー全体を止める）→ 工場が進まなくなる。**item 単位 gating** を厳守。
3. **Inbox を直接キューに入れる** → 未整理ノイズが自動実行される（野鳥問題の再来）。
4. **Goal優先度で item を「上書き」する** → 説明不能・ユーザー pin が消える。**加点（boost）方式**にする。
5. **factoryEligible=false を実行候補に残す** → 勝手に変な案件が走る。ゲートで完全除外。
6. **手動操作を自動再計算で上書き** → ユーザーが並べ替えても戻る不信感。queueControl を最優先で尊重。
7. **waiting_user と ai_hold を同一視** → 「人が動くべきもの」が AI保留に埋もれて永久停止。明確に分離（§8.6）。
8. **reason をハードコード文言にする** → 実態とズレる。スコア内訳から機械生成。
9. **トップに情報を盛る** → 毎日の判断負荷が上がる。判断待ち件数中心の最小表示を死守。
10. **危険操作（実行・承認・本番反映）を自動化** → 承認必須6点（本番データ削除/DBスキーマ破壊/外部課金/認証権限/不可逆/高セキュリティ）は人間ゲート維持。

---

## 14. Codex 実装用 仕様書

### 14.1 スコープ
本書 §11（MVP）のみ実装する。§12 は対象外。**実装は Progress アプリ（`apps/ny01/progress`, Next.js, ポート3010）内**で完結させる。新しい外部サービス・新 DB を作らない。

### 14.2 追加・変更ファイル（提案）
| 種別 | パス | 内容 |
|---|---|---|
| 新規 | `lib/auto-queue.ts` | `buildAutoQueue(): Promise<AutoQueueView>`。Epic/Goal/Run を読み、§7.1 status 導出 + §8 スコア + reason 生成。 |
| 新規 | `lib/auto-queue-score.ts` | `computeQueueScore(item, goal, project)` と `deriveWorkItemStatus(epic, runs, approvals)`。純関数・単体テスト可能に。 |
| 新規 | `types/auto-queue.ts` | `WorkItemStatus` / `AutoQueueItem` / `AutoQueueView` / `QueueControl`。 |
| 変更 | `lib/types/operations.ts` | `Epic` に `queueControl?: QueueControl`。 |
| 変更 | `types/goal.ts` | `Goal` に `priorityBoost?` / `pinnedTop?`。 |
| 新規 | `app/api/auto-queue/route.ts` | `GET` → `buildAutoQueue()` を返す。 |
| 新規 | `app/api/auto-queue/control/route.ts` | `POST` → pin / hold / exclude / moveUp / moveDown / setManualOrder を Epic.queueControl へ書く。 |
| 新規 | `app/api/goals/[goalId]/priority/route.ts` | `POST` → Goal.priorityBoost / pinnedTop 更新。 |
| 変更 | 司令塔トップ component | 表示元を work-queue から `/api/auto-queue` へ差し替え（§4 レイアウト）。 |
| 新規 | `app/queue/page.tsx`（or 既存拡張） | §5 キュー画面。フィルタ + 行カード + 4操作。 |

### 14.3 API 契約
**`GET /api/auto-queue`** → `200 { ...AutoQueueView }`（§7.4）。クエリ `?group=goal|project` で grouped 配列を併せて返してよい。

**`POST /api/auto-queue/control`**
```jsonc
// req
{ "workItemId": "epic:ep_123", "action": "pin|unpin|hold|unhold|exclude|moveUp|moveDown|setManualOrder", "value": 3 }
// res
{ "success": true, "queue": { /* 再計算した AutoQueueView */ } }
```
- `pin` → `queueControl.pinnedTop=true, pinnedAt=now`
- `hold` → `queueControl.hold=true`（status は導出で `ai_hold`）
- `exclude` → 対象 Epic の `factoryEligible=false` ＋ `queueControl.excludedByUser=true`
- `moveUp/moveDown` → 現在順の隣と `manualOrder` を入替（無ければ採番）
- すべて `queueControl.updatedBy='user', updatedAt=now` を記録

**`POST /api/goals/[goalId]/priority`**
```jsonc
{ "priorityBoost": 2, "pinnedTop": true }  // res: { success, queue }
```

### 14.4 アルゴリズム（擬似コード）
```
buildAutoQueue():
  epics   = getEpics()
  goals   = getGoals()
  runs    = readExecutionRuns()
  approvals = getPendingApprovals()
  inbox   = getInbox()

  items = []
  for e in epics where e.status not in {done,merged,dropped,split}:
     status = deriveWorkItemStatus(e, runs, approvals)
     g = goals.find(e.goalId)
     score, factors = computeQueueScore(e, g)
     items.push(toAutoQueueItem(e, g, status, score, factors))
  // Epic未生成の GoalTodo (role in {claude,codex}, factoryEligible相当) も同様に追加（例外パス）

  executable = items.filter(status==executable).sort(byScoreThenTiebreak)
  reindex queueOrder on executable (1..n)
  next = executable[0] ?? null
  candidates = executable.slice(0,3)
  group others by status
  counts = countByStatus(items) + {inbox: inbox.length}
  goalProgress = computeGoalProgress(goals, items)
  return AutoQueueView{...}

deriveWorkItemStatus(e, runs, approvals):  // §7.1 の順で最初に当たった値
computeQueueScore(e, g):                   // §8.2 の式。factors を併せて返す
```

### 14.5 受け入れテスト（Codex が満たすべき検証）
1. `factoryEligible=false` の Epic は `executable`/`candidates`/`next` に**絶対出ない**。
2. `riskFlags` に危険(billing 等)を持つ Epic は `waiting_user`、`candidates` に出ない。
3. ユーザー pin した Epic は他の P0 より上（`next` になる）。
4. Goal を `pinnedTop` にすると配下 Epic 群が一段上がる。ただし他 Goal の個別 pin には負ける。
5. review_waiting(P2・危険なし) を 1 件作っても `executable` の他 item は `next` になり続ける（全体が止まらない）。
6. Inbox の未整理項目は `candidates` に出ず、`counts.inbox` にだけ計上。
7. 各 `next`/行に `reason` と `reasonFactors` が非空で付く。
8. `POST control(moveUp)` 後、再 `GET` で順序が反映され、`POST` を跨いでも自動再計算に**戻らない**。
9. `npm run build` / `tsc --noEmit` / lint が通る。スマホ幅(375px)でトップが 1 カラム崩れなし。

### 14.6 やってはいけない（Codex 制約）
- 新しいキュー正本ファイル（`auto-queue.json` 等）を**永続化しない**（派生のみ）。
- 既存 `work-queue.json` / `epics.json` / `goals.json` の**スキーマ破壊変更をしない**（追加フィールドのみ）。
- 承認・本番反映・課金・認証・破壊的操作を自動化しない。
- executor 実行（実際の CLI 起動）は本 MVP では実装しない（表示と pick ロジックのみ）。

---

## 15. Codex 実装用プロンプト案

```
あなたは Progress アプリ（apps/ny01/progress, Next.js App Router, TypeScript, ポート3010）の実装担当です。
docs/auto-execution-queue-design.md（本設計書）の §11 MVP のみを実装してください。§12 以降は実装しない。

## ゴール
司令塔トップの「次にやること」を、未整理/低関連の案件（例: 野鳥観察系）ではなく、
Epic ベースの優先順位で正しく出す。ユーザーがスマホで pin/保留/対象外/上下移動でき、
低優先レビューやAI保留で工場全体が止まらないようにする。

## 正本ルール（厳守）
- 実行の正本は Epic（lib/types/operations.ts）。Goal は上位分類で優先度を配下へ伝播。
- 自動実行キューは新しい正本を作らず buildAutoQueue() で都度生成する派生ビュー。
- ユーザー手動操作だけ Epic.queueControl / Goal.priorityBoost に書き戻す。
- work-queue.json を実行判断の正本にしない（後方互換読み取りのみ）。

## 実装対象（§14.2 のファイル）
1. types/auto-queue.ts … WorkItemStatus / AutoQueueItem / AutoQueueView / QueueControl
2. lib/auto-queue-score.ts … deriveWorkItemStatus(§7.1) と computeQueueScore(§8.2) を純関数で
3. lib/auto-queue.ts … buildAutoQueue(): AutoQueueView（§14.4 擬似コード）
4. app/api/auto-queue/route.ts (GET) / app/api/auto-queue/control/route.ts (POST)
5. app/api/goals/[goalId]/priority/route.ts (POST)
6. 司令塔トップ component の表示元を /api/auto-queue に差し替え（§4 レイアウト）
7. app/queue/page.tsx … §5 のフィルタ＋行カード＋4操作（最優先/↑↓/保留/対象外）

## 優先順位（§8）
- ゲート: factoryEligible=true かつ status=executable のみ候補。waiting_user/ai_hold/review_waiting/blocked/manual は候補に出さない。
- スコア: pin > Goal pin > priority(P0=900/P1=600/P2=300)+GoalBoost(×150) > freshness。タイブレークは manualOrder→priority→lastRunAt。
- 各 item に reason（1行）と reasonFactors（チップ）を機械生成で付与。
- review_waiting は P2・危険flagなしなら工場を止めない（importance低）。

## UI（スマホ前提・375px 1カラム）
- トップ: 次回予定1件（executor chip / Goal / doneCriteria進捗 / なぜ次か）＋ 候補3件 ＋ 5カウンタ（判断待ち/AI保留/レビュー待ち/実行可能/blocked）＋ Goal別進捗バー。
- /queue: フィルタチップ＋行カード。操作は行内ボタン（ドラッグ不要）。

## 禁止
- 新キュー正本の永続化。既存スキーマ破壊変更。承認/本番反映/課金/認証/破壊的操作の自動化。実 executor CLI 起動。

## 完了条件
§14.5 の受け入れテスト 1〜9 を満たすこと（特に: 野鳥系=未整理/factoryEligible=false が next に出ない、pin が最優先、全体が止まらない、build/tsc/lint OK、スマホ1カラム）。
最後に変更ファイル一覧・検証結果（build/tsc/lint/手動確認）・残課題を報告すること。
```

---

## 付録: 既存資産の再利用マップ

| 本設計の要素 | 再利用する既存資産 |
|---|---|
| executable ゲート / 危険判定 | `classifyCodexEligibility` / `FactoryEligibility`（`lib/types/operations.ts`） |
| 判断待ち（人間） | `lib/queue-split.ts` の Human Queue / `getPendingApprovals` / `needs_human` Run |
| executor 選択 | `pickExecutor(config, limitedSet)`（Factory 設計） |
| 履歴・最終作業日 | `readExecutionRuns` / `latestRunId` |
| Goal 進捗 | `GoalProgress`（`types/goal.ts`） |
| 候補→Epic 化（人間承認） | `RecommendedEpic` フロー（`types/recommended-epic.ts`） |
| 運用ページ最終更新 | `current-operating-model.md`（`lib/operating-model.ts`） |
