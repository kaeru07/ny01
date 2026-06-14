---
updated: 2026-06-14
updateNote: Goal Planner(目標タブ)と自動実行キューを同一データ源(buildAutoQueue.goalProgress)に統合。目標カードに次回候補/実行可能/判断待ち/レビュー待ち/候補外/最新作業/次アクション＋/queue?goalId導線。role選択UI撤去
---

# Progress 現行運用モデル（current-operating-model）

> このファイルが Progress の運用モデルの正本ドキュメント。
> frontmatter の `updated` / `updateNote` は運用ページ（/guide）最下部の「最終更新」に動的表示される。
> **機能追加・UI変更・運用変更を行ったら、必ずこのファイルと運用ページをセットで更新すること**（下記「更新ルール」参照）。

## このアプリの位置付け

Progress は **AI工場の管理画面ではなく、人間用の司令塔**。

- 人間は毎日 5〜15 分だけ判断する
- AI が「調査 → 実装 → レビュー候補生成」まで進める
- 内部構造の複雑さはユーザーに見せない（用語は人間語へ翻訳する）

## 画面構成（モバイル下タブ＝横スクロール全画面・2026-06-14）

**モバイル BottomNav（`components/navigation/BottomNav.tsx`）は横スクロール**。先頭5つがアイコン付き主要タブ ホーム(`/`) / ToDo(`/decide`) / Project(`/portfolio`) / 目標(`/goal-planner`) / **自動実行(`/queue`)**。続けて `moreItems` として **リンクで飛べる主要画面を全て**テキストタブで列挙（作業予約 `/prompt-queue` / Revenue `/revenue` / 運用 `/guide` / 実行履歴 `/logs` / ToDo管理 `/tasks` / JSON取込 `/tasks/import` / 動作確認 `/verify-todos` / おすすめEpic / 収益化 / 承認 / 自動化 / 工場Epic / Codex / 朝会 / 日別 / AI自走 / レーダー / 案件 / 旧Inbox / 決定事項 / 工場候補 / URL / 旧キュー / 旧ダッシュ / 画面一覧(`/legacy`)）。**「下タブにない主要画面」は無い**（ユーザー指示 2026-06-14）。`/legacy` は全画面のカテゴリ別一覧として残す。

下表は各画面の役割:


| タブ | ルート | 役割 |
|---|---|---|
| 司令塔 | `/` | 毎日最初に開く画面。今日やること・AI工場の状態・収益マイルストーン・直近の成果 |
| Inbox | `/decide` | 4タブ構成（タブ切り替え）。「今日の判断」=工場停止要因のみ（危険判断/方針選択/人間作業・最大3件・約3分）/「レビュー」=検収（放置しても工場は止まらない・**隠さず全件表示**）/「Epic候補」=実行許可（放置可能）/「AI保留」=件数のみ。社長は「今日の判断」タブだけ処理すれば工場は止まらない。`?tab=today|review|candidates|aiHold`、`?reviewFilter=unconfirmed|followup|snoozed|reviewed`、`?focusRunId=<runId>`、`?goalId=<id|unassigned>`で直接表示できる。内部分類・内部IDは「詳細を見る」内のみ |
| Inbox レビュータブ | `/decide` | **レビュー待ちは未消込リストとして全件表示**（「ほか◯件」「処理すると次が出ます」の隠れ表示は廃止）。上部に件数サマリー（未確認/要修正/あとで/レビュー済み）。各カードに「完了: YYYY/MM/DD HH:mm」を表示し、**completedAt（finishedAt→startedAt）降順**で最新が上。50件ずつの明示ページング（全◯件中◯〜◯件）。状態遷移=問題なし→`reviewed`（一覧から消し込み・「レビュー済み」タブに残置＝物理削除しない）/あとで→`snoozed`（後回しで残置）/修正する→**修正指示プロンプト(textarea)を入力して保存**→`needs_followup`（要修正で残置・`fixPrompt`/`fixRequestedAt`/`fixRequestedBy='human'` を ExecutionRun に保存）。修正指示は要修正カードに表示され、`followupOfRunId` 付きおすすめ次作業の reason/doneCriteria/notes に反映されて次回自動実行の作業指示になる。空欄保存は警告して送信しない。「未確認レビューをAIで一括整理」は未確認**全件**対象（サーバ安全上限200件）で、危険・要判断は必ず残し最終判断は人間 |
| 自動実行キュー | `/queue` | **AI工場が次に何をやるか**の単一ビュー（派生・新正本を作らない）。`buildAutoQueue()` が Epic / Goal / ExecutionRun / Approval / Inbox から都度生成。`factoryEligible=true && status=executable` のみ自動実行候補。各itemに「なぜこの順位か」の理由を機械生成。スマホで最優先(pin)/保留(hold)/対象外(exclude)/上下移動(manualOrder)。旧 work-queue 並べ替え画面は `/legacy/queue` に退避 |
| Projects | `/portfolio` | 進行中プロジェクトの一覧と次の作業 |
| Revenue | `/revenue` | 収益化マイルストーンの現在地 |
| 📖 運用 | `/guide` | このアプリの使い方を自分で説明するページ（本ドキュメントと連動） |
| Legacy | `/legacy` | 旧画面群（URL / 案件 / ログ / 旧ホーム / 旧Factory / 旧Goal）への入口。無削除退避 |

## 日次運用フロー

- 朝: 司令塔 → Inbox → 判断 → 終了
- 夜: 司令塔 → Inbox → おすすめ次作業（推薦Epic）確認 → 終了
- 必要なとき: 司令塔 → レビュー用コピー → ChatGPT/Fableへ貼る → 指摘を人間がInboxへ手動起票

## AI工場のパイプライン

目標 → 大きな作業 → AI作業 → レビュー → 学習 → 次の作業

レビューで「修正する」を選んだ `needs_followup` の作業履歴は、`followupOfRunId` 付きのおすすめ次作業へ自動変換する。同じ作業履歴から候補を重複生成しない。スケジュール起動時にも未処理の修正依頼をbackfillする。

**修正依頼の最優先自動実行（2026-06-14・承認不要）**: 「修正する」で `fixPrompt` を付けた `needs_followup` 作業履歴は、定時起動 `runScheduledFactory` の **最初**（Epic factory・Prompt Queue より前）に `runReviewFixDispatch` が処理する＝**次回自動実行で最優先**。安全ゲート（`classifyCodexEligibility` ＋ hard-deny: 課金/billing/deploy/本番/production/secret/.env/認証/migration/削除/destructive/force）を通過した分のみ auto+confirm で実 executor 起動。危険シグナル該当は実行せず `needs_followup` のまま reviewMemo に理由を残す（人手対応）。実行は `source='review_fix'`・`followupOfRunId=<元runId>` の ExecutionRun として記録し、成功時のみ元 run を `reviewed` に更新して消化（再ディスパッチ防止）。1起動 cap=1〜2。dry_run は記録のみ（実起動・消化なし）。

**人間の修正指示（fixPrompt）の dispatch 反映**: 「修正する」で保存した `fixPrompt` は、その Epic の Factory Dispatch プロンプトに `[3-1] 人間の修正指示（最優先で対応すること）`（Codex 引き継ぎは `[4-1]`）として最優先で載る（`buildDispatchPlan().humanFixInstructions`＝当該 Epic の needs_followup Run の fixPrompt ＋ 承認済みで remainingWork に入った修正指示）。これで次回自動実行時に executor が人間の修正指示そのものを受け取り、その内容で再修正できる。※Epic に有効な doneCriteria / priority が無いと dispatch 自体が blocked になる点は従来どおり（修正指示は dispatch 可能になった時点で必ずプロンプトに乗る）。

AI工場の「今」は、Factory runner が開始時に `running` の作業履歴を記録し、完了時に同じ作業履歴を完了/一部完了/失敗へ更新して表示する。異常終了で `running` が残った場合は、開始から30分超で待機中扱いにする。

画面レンダリング中の純読み取り（作業履歴・大きな作業・目標・候補など）は、ページ専用ラッパーで同一リクエスト内だけメモ化する。API route や writer は raw reader を使い、write→read の即時反映を妨げない。

司令塔の「レビュー用コピー」は、Progressに蓄積済みの現在状態を外部レビューへ出す出口。既存ビルダーの読み取り結果と直近作業履歴だけからMarkdownを生成し、Inboxカード・作業履歴・データファイルは作らない。Legacy/旧画面の取り込み系は「Progressへ入れる入口」、レビュー用コピーは「Progressから出す出口」として共存する。

ログ画面のキュー外レビューコピーは、Progressにまだ無い任意アウトプットをレビュー依頼文に整える別用途として残す。

**工場停止条件（2026-06-11 運用方針変更）**:

レビュー件数では停止しない（レビュー100件でも稼働可能）。停止要因は「人間しか判断できないもの」のみ:

| 停止要因 | 挙動 |
|---|---|
| 危険判断待ち（本番DB・migration・課金・認証・deploy・external_publish・destructive 系の承認が pending） | Factory自動実行を全体停止 |
| Goal未設定の Epic | 該当Epicのみ対象外（スキップ）。全対象EpicがGoal未設定なら実質停止 |
| 人間作業（ストア公開・課金設定・契約など） | AIはそもそも触らない（他のEpicは稼働継続） |
| 優先順位決定待ち（方針選択系の承認） | 該当作業のみ待ち |

**停止対象外（放置しても工場は止めない）**: レビュー / 公開確認 / Vercel確認 / 実装確認 / AIレビュー / ExecutionRunレビュー / Knowledgeレビュー / 次Epic候補 / 改善候補 / 収益化候補

- レビュー解消手段（任意・任意のタイミングで）: Inbox の「AIにまとめて確認させる」（AI一次レビュー一括実行）
- AI が判断できないものだけ needs_human として Inbox のレビューセクションに上がる

## InboxのGoal紐づけと直接遷移

Inboxカード（今日の判断 / レビュー / Epic候補 / AI保留集計）は、表示用の変換レイヤーで `goalId` / `goalTitle` を付与する。正本データは増やさない。推定順は `item.goalId` → `ExecutionRun.epicId` 経由の `Epic.goalId` → `targetApp` と `Goal.projectId` の一致 → 不明なら `unassigned`。`unassigned` は削除せず「未紐づけ」として表示・絞り込み可能。

`/decide` は URL クエリを初期状態に使う:

- `?tab=today|review|candidates|aiHold`: 初期タブ。未指定は従来どおり今日の判断。
- `?reviewFilter=unconfirmed|followup|snoozed|reviewed`: レビュー内フィルタ。互換で `?filter=needs_followup` は `followup` に読み替える。
- `?focusRunId=<runId>`: 対象レビューカードへスクロールし、ハイライトして「次回実行予定から移動しました」を表示。カードの状態が現フィルタと違う場合は、`needs_followup`→要修正、`snoozed`→あとで、`reviewed`→レビュー済み、それ以外→未確認へ自動切替。
- `?goalId=<goalId|unassigned>`: すべてのタブをそのGoalの項目だけに絞る。0件のタブを開いても同Goalの他タブに件数があれば案内ボタンを出す。

司令塔トップの「Inboxでレビューする」は `/decide?tab=review&goalId=...&focusRunId=...` を使う。レビュー件数があるのに `/decide` の今日の判断0件へ飛んで詰まる導線は禁止。

## 自動実行キューの使い方

自動実行キューは **Epic / Goal / ExecutionRun / Approval / Inbox から都度生成する派生ビュー**。新しいキュー正本は作らない。司令塔トップの「次回自動実行予定」と `/queue` は同じ `buildAutoQueue()`（別名 `getAutoQueueView()`）の結果を見る。旧 `work-queue.json` は後方互換表示として `/legacy/queue` に残すが、自動実行判断の正本にはしない。

**ステータスの意味**:

| status | 意味 | 自動実行候補 |
|---|---|---|
| `executable` | AIが自動実行できる。`factoryEligible=true` かつ安全条件OK | 入る |
| `waiting_user` | 人間判断・承認・危険flag・重要レビュー待ち | 入らない |
| `review_waiting` | レビュー待ち。低優先レビューは工場全体を止めない | 入らない |
| `ai_hold` | AI保留。ユーザーの保留操作や一時停止 | 入らない |
| `blocked` | blocker / failed などで詰まり | 入らない |
| `manual` | 手動対応または対象外 | 入らない |
| `done` | 完了済み | 入らない |

**操作ボタンの意味**:

| 操作 | 書き戻し先 | 意味 |
|---|---|---|
| 自動実行を最優先 / 復帰時に最優先 | `Epic.queueControl.pinnedTop` | 実行可能なら次回候補の最上位。候補外なら条件が解けた時に上がる |
| ↑ / ↓ | `Epic.queueControl.manualOrder` | 現在の実行可能キュー内の相対順を保存 |
| 保留 / 保留解除 | `Epic.queueControl.hold` | 保留中は `ai_hold` として候補外。解除後、安全条件を満たせば候補復帰 |
| 対象外 | `Epic.factoryEligible=false` + `queueControl.excludedByUser` | 自動実行対象から外す |
| 対象に戻す | `Epic.factoryEligible=true` + `queueControl.excludedByUser=false` | 対象外にした作業を自動実行候補に戻す |
| 詳細 | なし | Epic詳細へ移動 |

**重要注意**:

- 最優先指定は安全gatingを上書きしない。`waiting_user` / `review_waiting` / `blocked` / `manual` の作業は、pinしても自動実行されない。
- pin済みだが候補外の作業は、司令塔トップと `/queue` に「最優先指定中だが候補外」と理由を表示する。
- **候補外の作業には「こうすれば動きます」の解消手順とボタンを表示する**（`AutoQueueItem.resolution`）。`review_waiting`/`waiting_user`→Inboxでレビュー/承認（`/decide?tab=review|today&goalId=...`、可能なら `focusRunId` 付き）、`needs_followup`→要修正フィルタ、`ai_hold`→AI保留タブ、`blocked`→Epic詳細でブロック解消、`manual`(対象外)→「対象に戻す」。これで「最優先にしたのに動かない」ときに次に何をすればよいかが分かる。
- 低優先レビューで工場全体は止めない。実行可能な別Epicがあれば、それが次回予定になる。
- 次回予定は最新Run、承認、保留、対象外、Goal boost、pinの状態で変わる。操作後はトップと `/queue` を同じ派生結果で再表示する。

## 用語の対応表（内部語 → 人間語）

正本は `lib/command-center.ts` の `TERMS`。運用ページのセクション5はこれを動的表示する。

| 内部語 | 人間語 |
|---|---|
| Goal | 目標 |
| Epic | 大きな作業 |
| Execution Run | 作業履歴 |
| Knowledge | 学習結果 |
| Factory | AI工場 |
| Suggested Epic | おすすめ次作業 |
| Closed Loop Rate | 自動化率 |
| not_reviewed | 未確認の作業履歴 |
| needs_human | あなたの判断待ち |
| Inbox | 今日の判断 |
| AI保留 | 今日の3件以外をAIが預かっている状態 |
| Fix Request | 修正依頼 |
| Expired Candidate | 期限切れ候補 |
| Revenue Config | 収益設定 |
| Data Health | データ整合 |
| Request Cache | 画面内キャッシュ |
| Run Archive | 作業履歴アーカイブ |
| Review Copy | レビュー用コピー |

**Inbox 6分類**（「何の種類のタスクか」ではなく「人間が何を判断するか」で分類）:

| 分類 | 人間の判断 | 内部の対応 | ボタン |
|---|---|---|---|
| 危険判断 | 実行すると危険。許可するか | 本番DB・migration・課金・認証・deploy・external_publish・destructive 系の承認 | 許可する / 許可しない |
| 検収 | AIの作業が終わった。結果だけ確認 | needs_human の作業履歴 / レビュー系承認（公開・デプロイ・実装完了・本番反映確認） | 問題なし / 修正する / あとで |
| 方針選択 | AIでは決められない方向性を選ぶ | goalId 未設定 Epic（Goalをボタンで選択）/ 進め方・優先順位系の承認 | 目標名ボタン / 不要 |
| 実行許可 | AIが作業したい。やって良いか。必要なら同時に目標も選ぶ | suggested 候補（不具合修正・更新停止・自動化改善・次Epic提案） | 目標名（任意） / 進める / あとで / やめる |
| 人間作業 | AIでは実行できない。人間がやる | ストア公開申請・AdMob・課金/サブスク・アカウント登録系の候補は**現在カードに出さない**（どのアプリでも未実施＝時期尚早のためAI保留へ預ける。2026-06-12〜）。必要になったらRevenueの収益化ロードマップで案内 | （現在は非表示） |
| AI保留 | 人間に見せない（件数のみ表示） | Factory schedule・routine・health check・metrics・内容不足・重複候補・同テーマ大量候補・今日の3件に入らなかったもの | カードを出さない |

**カードの表示ルール**:

- タイトルは「何をやるか（タスク名）」ではなく「何が起きているか（状況文）」を出す（例: 「市場調査ビューの自動更新が止まっています」）
- カード本文はラベル付き説明行で構成（検収=AIがやったこと/人間がやること、実行許可=放置すると/AIがやること/人間がやること、方針選択=選ばないと、危険判断=影響、人間作業=内容/注意）
- ① 今日の判断に出すのは工場停止要因のみ（優先順: 危険判断→方針選択→人間作業）の最大3件。検収は②レビュー、実行許可は③Epic候補セクションに分離（放置しても工場は止まらない）。AI保留は件数のみ
- 元タイトル・内部ID・runId・source・AI判断理由・変換理由は「詳細を見る」内のみ
- おすすめ次作業が suggested のまま30日を超えた場合、P0を除き `expired` へ移す。物理削除はしない。期限切れ件数はAI保留内訳に表示し、必要なら suggested へ戻せる。

## 収益化ロードマップ

MVP完成 → ストア公開 → 広告導入 → DL100 → はじめての収益 1円

- 現在の対象: `data/real/revenue-config.json` の `focusApp`（初期値は BirdLog）
- 現在収益: `data/real/revenue-config.json` の `currentRevenueJpy`
- マイルストーン: `data/real/revenue-config.json` の `milestones`

## 司令塔の停止バンド

危険判断待ち、または全対象EpicがGoal未設定でAI工場が停止している場合、司令塔の上部に停止継続日数・理由・Inboxへの導線を表示する。停止していないときは表示しない。

## レビュー用コピー

司令塔の日付行付近に「レビュー用コピー」ボタンを置く。ボタンを押すとモーダル内で `/api/operations/review-copy` を読み取り、生成時刻・文字数・折りたたみプレビューを表示する。コピーはモーダル内の「全体をコピー」を押したときだけ実行する。iOS Safariの制約を避けるため、fetch直後に自動コピーしない。

コピー本文は最大12,000字。先頭に生成時刻とデータ整合警告を置き、AI工場の状態、今日の判断、Inbox内訳、Now/Next/Later、Project/Goal/Revenue、最近7日の作業、未実装・保留、危険・注意、次回自動実行の優先作業、相談欄をこの順で出す。rawReport全文・work-log生ログ・プロンプト全文・Legacy内部詳細は含めない。最終パスでOpenAI/GitHub/Bearer/秘密鍵らしき文字列を伏字にする。

レビュー結果をProgressへ戻す経路は今回作らない。採用する指摘は人間がInboxへ手動起票する。

## Goal進捗

司令塔のGoalカードは、進捗率の根拠を1行表示する。

- GoalにTodoがある場合: Todo完了率
- Todoがなく紐付くEpicがある場合: 紐付くEpic進捗の平均
- どちらもない場合: Goalの数値指標（current / target）

## データ整合ヘルスチェック

司令塔は以下を点検し、異常があるときだけ1行警告を表示する。正常時はUI不変。

- 存在しないEpicを参照する作業履歴
- 存在しないGoalを参照するEpic
- 14日超の修正依頼
- 30分超の実行中作業履歴

## 作業履歴アーカイブ

`execution-runs.json` が300件を超えた場合、スケジュール起動時に確認済みの古い作業履歴だけを `data/real/archive/execution-runs-YYYYMM.json` へ移す。移動前に `data/real/_backups/execution-runs-<timestamp>.json` を必ず作成する。

アーカイブ対象外: `not_reviewed` / `needs_followup` / `needs_human` / `running`。通常readerはアクティブファイルだけを読む。Legacyログ画面には、アーカイブファイルが存在する場合のみ月別件数の導線を表示する。

## 動作確認Todo（/verify-todos）

Claude Code / Codex の作業完了時・Epic 完了後に「人間が確認すべき画面・URL・手順」を一元管理するページ（上部メニュー「動作確認」）。app-urls（URL台帳）とは別物で、こちらは確認手順と期待結果を持つチェックリスト。

- 登録項目: アプリ名 / Epic名 / 確認URL / 確認手順 / 期待結果 / 状態 / メモ
- 状態: `unconfirmed`（未確認）/ `confirmed`（確認済）/ `ng`（NG）/ `pending`（保留）
- 絞り込み: アプリ・Epic・状態で個別フィルタ
- 確認URL（iPhoneから押せる公開URL推奨）はカードのボタンで対象画面を直接開ける
- 正本データ: `data/real/verify-todos.json`（`{ updatedAt, operationMemo, todos[] }`）
- ストア: `lib/verify-todos.ts` / API: `GET,POST /api/verify-todos` ・ `PATCH,DELETE /api/verify-todos/[id]`

**運用メモ（AI側の必須動作）**: Claude Code / Codex は作業完了時に、人間が確認すべき項目があれば 1 件ずつこのページへ追加する（アプリ名・Epic名・確認URL・確認手順・期待結果を埋める）。人間は確認URLを開き、手順どおり操作して、期待結果と一致すれば確認済、ずれていればNG、後回しは保留に更新する。

## 更新ルール（必須・セット更新）

今後、以下のいずれかを行った場合:

- 機能追加
- UI変更
- 運用変更

**必ず次の4点をセットで更新する**（どれか1つでも欠けたら作業未完了扱い）:

1. 運用ページ（`app/guide/page.tsx`）の該当セクション
2. 用語（`lib/command-center.ts` の `TERMS`。新しい内部語を画面に出すなら必ず人間語を登録）
3. 図（運用ページの「今日の流れ」「AI工場の流れ」フロー図が実態とずれていないか確認・修正）
4. 本ドキュメント（`docs/operations/current-operating-model.md`）の本文 + frontmatter の `updated` / `updateNote` + 変更履歴

## 変更履歴

- 2026-06-14: **Goal Planner（目標タブ）と自動実行キューをデータ統合**。両者を同一の集計源 `buildAutoQueue().goalProgress` に揃え、Goal Planner＝same-source の要約ビュー / `/queue?goalId=`＝詳細ビューに役割分担。`GoalProgressRow` に `nextCandidateCount`/`manual`/`latestWorkTitle`/`nextActionTitle` を追加し、各 Goal カードに 次回候補/実行可能/判断待ち/レビュー待ち/候補外/最新作業/次にやること を表示＋「自動実行キューを見る(/queue?goalId)」「ToDoを見る(/decide?goalId)」「作業予約」導線を追加。Goal Planner の件数と /queue?goalId の件数は同一ソースで整合。`/queue` は goalId 指定時にカウンタ/フィルタ/一覧を当該 Goal に絞る（「全体に戻る」付き）。`GoalPlannerForm` の role選択UI を撤去（保存は内部既定 `addToQueueRoles:['claude']` で後方互換）。GoalとGoal進捗は分けない方針を維持。旧 phases/todos 表示は互換のため残置。

- 2026-06-14: **レビュー「修正する」の fixPrompt を定時自動実行の最優先で実行する運用に**（承認不要・ユーザー指示）。新規 `lib/review-fix-runner.ts` の `runReviewFixDispatch` を `runScheduledFactory` の**先頭**（Epic factory・Prompt Queue より前）に接続。対象=`needs_followup`＋`fixPrompt` 非空（未消化）。安全ゲート通過分のみ auto+confirm で実起動、危険シグナル（課金/deploy/本番/secret/migration/**削除**/destructive/force 等）該当は実行せず needs_followup のまま reviewMemo に理由。`source='review_fix'`・`followupOfRunId` で記録、成功時のみ元 run を `reviewed` に消化。cap=1〜2、dry_run は記録のみ。※「削除」等の語を含む修正指示は安全側で自動実行されない（人手対応）。

- 2026-06-14: **モバイル下タブを横スクロールの全画面タブ化**（ユーザー指示「下タブにない主要画面はなくして／リンクで飛べるものは全て下タブに」）。先頭5つ＝アイコン付き主要タブ（ホーム/ToDo/Project/目標/自動実行）＋ `moreItems` で残りの主要画面（作業予約/Revenue/運用/実行履歴/ToDo管理/JSON取込/動作確認/おすすめEpic/収益化/承認/自動化/工場Epic/Codex/朝会/日別/AI自走/レーダー/案件/旧Inbox/決定事項/工場候補/URL/旧キュー/旧ダッシュ/画面一覧）を全てテキストタブで列挙。`/legacy` は「画面一覧」タブ（カテゴリ別ディレクトリ）として残し「下タブにない主要画面」グループ表記を撤廃。これで iPhone から全主要画面へ下タブ直接到達。

- 2026-06-14: （前段）モバイル下タブ再編。`components/navigation/BottomNav.tsx` を ホーム/ToDo/Project/目標/**自動実行**/その他 の6タブへ変更。**自動実行キュー(`/queue`)を主要タブに昇格**（従来はモバイル下タブに無く iPhone から辿れなかった＝ルート棚卸しレビュー runId 20260614-101321 の最重要指摘の解消）。Revenue/運用(`/guide`)/作業予約(`/prompt-queue`)/動作確認 は「その他」=`/legacy` ハブへ集約（`/legacy` ページに「よく使う（下タブにない主要画面）」グループを新設し orphan を回避）。`/queue` ページに 作業予約・実行履歴(`/logs`) へのハブ導線を追加。`/legacy/queue`(旧WorkQueue) は「旧キュー・非正本（正本は /queue）」と明記。


- 2026-06-14: **Prompt Queue を実 Factory 自動実行に接続**。`runPromptQueueDispatch()`（`lib/prompt-queue-runner.ts`）を新設し、定時起動 `runScheduledFactory`（11/14/16/23 JST）の lock 内で Epic Factory 実行**後**に別ステップとして呼ぶ（`maxItems:1`・Epic dispatch ロジックは不変更）。対象は「次回やる候補」。**安全ゲート（必須）**: 各 item の `title+prompt` を `classifyCodexEligibility` ＋ hard-deny 正規表現（課金/billing/deploy/本番/production/secret/.env/認証/migration/削除/destructive/force）に通し、**危険シグナル該当は実行せず `needs_user_prompt_fix` へ隔離**（errorMessage に理由）。安全分は status を `running`→（**dry_run=既定は実起動せず `reserved`**／**`auto`+`confirm`=定時起動のみ既存 executor adapter で実起動**）。結果で `completed`/`failed`/`needs_retry`。ExecutionRun は `source='prompt_queue'`・`factoryRun=true`・`dispatchMode`・`promptUsed` で記録し `item.executionRunId` に戻す。`factoryEnabled=false`/`Blocked` では何もしない。dry_run テストで 安全→reserved＋runId・危険「本番DBを削除 force」→needs_user_prompt_fix（未実行）を検証。


- 2026-06-14: **Prompt Queue（作業プロンプト貯蔵庫 `/prompt-queue`）** を新設（正本 `data/real/prompt-queue.json`・物理削除せず DELETE は `archived`）。フォーム入力は **タスク名 / プロンプト / Project / Goal進捗** の4項目のみ（任意: メモ / 関連URL / 関連レビューID / 関連Inbox ID）。**実行対象AI（codex/claude/fable_review/auto）と優先度（P0/P1/P2）は UI に出さない**（内部既定 auto / 未指定のみ）。Goal と Goal進捗は分けず単一 `goalProgress`（既存 Goal を参照）。JSON一括取り込みは `{promptQueue:[...]}` と旧互換 `{todos:[...]}` に対応し、`goal`→`goalProgress` 正規化・status未指定→`queued`・`priority`/`assignee`/`preferredExecutor` は無視（警告）・title/prompt 無しはエラー・project 不一致は未紐付け警告。未完了（queued/reserved/not_started/failed/needs_retry/needs_user_prompt_fix）は「**次回やる候補**」に Project/Goal進捗 の状態順で並び「なぜ候補か」付きで表示、completed/canceled/archived/snoozed は除外。ナビは Legacy 内「作業予約」。自動実行スケジューラ本体へはまだ未接続（貯蔵庫＋候補表示まで）。

- 2026-06-14: レビュー「修正する」で保存した `fixPrompt` を **Factory Dispatch プロンプトへ反映**。`buildDispatchPlan` に `humanFixInstructions`（当該 Epic の needs_followup Run の fixPrompt ＋ 承認済みで remainingWork に入った修正指示）を追加し、Claude プロンプト `[3-1]`・Codex 引き継ぎ `[4-1]` に「人間の修正指示（最優先で対応）」として出力。**テストで反映前=プロンプトに無し→反映後=有り**を検証（epic-91 の実 fixPrompt「inboxページでフィルターがゴール進捗とproject単位…」で確認、テスト後 epic は原状復帰）。これで次回自動実行が人間の修正指示そのもので再修正する。

- 2026-06-14: 司令塔トップの候補外解消ボタン（「Inboxでレビューする」）を `/decide?tab=review&goalId=...&focusRunId=...` に修正。従来の `/decide` 直リンクで「今日の判断」0件タブへ飛び、レビューがあるのに何も出ない詰まりを解消。InboxTabs は URL クエリ（tab / reviewFilter / filter=needs_followup / goalId / focusRunId）に対応し、focusRunId のカードをハイライト、状態に応じて未確認/要修正/あとで/レビュー済みフィルタへ自動切替。Inboxカードは変換レイヤーで goalId/goalTitle を付与し、未紐づけは `unassigned` として表示・絞り込み可能。Goal付き0件タブでは同Goalの他タブ件数があれば案内ボタンを表示。司令塔トップの「最優先指定中だが候補外」枠にGoal名、該当レビュー、Goalレビュー一覧、キュー調整導線を追加。

- 2026-06-13: Inboxレビューの「修正する」を**修正依頼ボックス化**。押下時にカード内 textarea を展開し、人間が修正指示を入力→「修正依頼として保存」で `reviewStatus=needs_followup` ＋ ExecutionRun に `fixPrompt`/`fixRequestedAt`/`fixRequestedBy='human'` を保存（空欄は警告して保存不可・物理削除なし・問題なし/あとで/レビュー済みは不変）。修正指示は要修正カードに表示し、`followupOfRunId` 付きおすすめ次作業の reason 冒頭「人間の修正指示: …」・doneCriteria 先頭「人間の修正指示を満たす: …」・notes に反映 → 承認後の Epic/Factory 実行時に人間の指示が作業指示として渡る。

- 2026-06-13: 動作確認Todo（`/verify-todos`）を新設。Claude Code / Codex の作業完了時・Epic完了後に「人間が確認すべき画面・URL・手順・期待結果」を一元管理する。アプリ名/Epic名/確認URL/確認手順/期待結果/状態/メモを登録でき、`unconfirmed`/`confirmed`/`ng`/`pending` で状態管理、アプリ・Epic・状態で絞り込み、確認URLボタンで対象画面を直接起動。正本=`data/real/verify-todos.json`、ストア=`lib/verify-todos.ts`、API=`/api/verify-todos`(GET/POST)・`/api/verify-todos/[id]`(PATCH/DELETE)。TopNav(Legacy)に「動作確認」リンク、guideに「9. 動作確認Todo」、TERMSに`verifyTodo`を追加。app-urls（URL台帳）とは責務分離（こちらは確認手順＋期待結果を持つチェックリスト）。

- 2026-06-13: 収益化候補の定期取り込み（`syncCandidatesFromVault`）の走査対象を拡張。従来の `06_research` 直下 + `20_reviews` + 候補テーブルに加え、`06_research/daily-market-research` / `daily-ai-news` / `daily-ai-tools`（日次調査サブフォルダ）も走査するようにし、これらを `daily` 種別の調査元として分類（スキャン上限 300→400）。既存のデータ構造（sourceRefs / researchLogs / evidenceLinks / history）・重複判定・候補詳細/一覧の調査元表示・ExecutionRun記録は既存実装を流用（新規追加なし）。手動同期2回でadded/updatedの冪等性（再投入で二重追加なし）を確認。

- 2026-06-13: 自動実行キューの候補外アイテムに **「👉 こうすれば動きます」解消手順＋ボタン**（`AutoQueueItem.resolution`）を追加。status別に次アクションを案内（`review_waiting`/`waiting_user`→Inboxでレビュー/承認(/decide)、`blocked`→Epic詳細、`ai_hold`→保留解除、`manual`(対象外)→対象に戻す）。control API に `include`（対象に戻す）アクションを追加。司令塔トップ「最優先指定中だが候補外」枠と `/queue` カードの両方に表示。「最優先にしたのに動かない・どうすれば解消するか分からない」を解消。

- 2026-06-13: 自動実行キューのpin説明を修正。`POST /api/auto-queue/control` 後に `/` と `/queue` を revalidate。司令塔トップと `/queue` は同じ `getAutoQueueView()` を使用。pin済みでも `waiting_user` / `review_waiting` / `blocked` / `manual` / `ai_hold` は安全gatingにより候補外のままとし、司令塔トップに「最優先指定中だが候補外」枠、`/queue`カードに候補外理由・候補入り可否・queueScoreを表示。保留操作は明示的に `ai_hold` を優先導出。

- 2026-06-13: Factory 定時自動実行に **16:00 JST** を追加（従来 11:00 / 14:00 / 23:00 → 11:00 / 14:00 / 16:00 / 23:00）。`/etc/systemd/system/factory-schedule.timer` の OnCalendar に 1 行追加し `daemon-reload` + timer 再起動。repo 側 `docs/factory-schedule/factory-schedule.timer`（UI の「定時」表示が読む正本）も同期。各定時で `runScheduledFactory` が安全ゲート（factoryEnabled / Blocked / 二重起動lock）を通った場合のみ起動。

- 2026-06-13: 自動実行キュー（`/queue`）を新設。Epicを実行正本・Goalを優先度の親・キューを派生ビューとし、`buildAutoQueue()`（Epic/Goal/ExecutionRun/Approval/Inbox入力・新正本なし）を唯一の進行順とした。司令塔トップの「次回自動実行予定」表示元を旧`work-queue.json`から`buildAutoQueue`へ差し替え（司令塔が未整理/低関連案件＝野鳥観察系を先頭に出す二重正本問題を解消）。`factoryEligible=true && status=executable`のみ候補化し、`waiting_user`/`ai_hold`/`review_waiting`/`blocked`/`manual`はitem単位で候補外（全体は止めない）。スコア=pin>Goal pin>P0/P1/P2+Goal boost>freshness、各itemにreason機械生成。スマホで最優先(pin)/保留/対象外/上下移動を`Epic.queueControl`・`Goal.priorityBoost/pinnedTop`へ書き戻し（手動操作は自動再計算で上書きしない）。旧work-queue並べ替えUIは`/legacy/queue`へ無削除退避。設計書: `docs/auto-execution-queue-design.md`。

- 2026-06-13: Inboxレビュータブを「未消込リスト」運用へ刷新。レビュー待ちを隠さず全件表示（「ほか◯件」「処理すると次が出ます」廃止）、各カードに完了日時（YYYY/MM/DD HH:mm）を表示しcompletedAt降順（finishedAt→startedAtフォールバック）で並べ、未確認/要修正/あとで/レビュー済みの件数サマリー＋フィルタ＋50件ページングを追加。状態遷移を整理（問題なし→reviewed消込＋レビュー済みタブに残置／あとで→新ReviewStatus `snoozed`で後回し残置／修正する→needs_followupで要修正残置）。レビュー済みは物理削除しない。「AIにまとめて確認させる（10件固定）」を「未確認レビューをAIで一括整理（未確認全件・サーバ安全上限200件）」へ変更。

- 2026-06-13: 司令塔にレビュー用コピーを追加。既存ビルダーの読み取り結果から最大12,000字のMarkdownを生成し、ChatGPT/Fableへ貼れるようにした。コピー機能は読み取り専用で、Inboxカードやデータファイルは作らない。

- 2026-06-12: 画面表示専用のrequest cacheラッパーを追加。`readExecutionRuns` / `getEpics` / `readGoals` 等のraw readerはAPI routeではそのまま使い、write→read経路にキャッシュを入れない運用にした。

- 2026-06-12: Goal進捗カードに算出根拠（Todo完了率 / 紐付く作業平均 / 数値指標）を1行表示。

- 2026-06-12: データ整合ヘルスチェックを追加。孤児参照、存在しないGoal参照、14日超の修正依頼、30分超のrunningを検出し、異常時のみ司令塔に警告。

- 2026-06-12: ExecutionRunアーカイブローテーションのロジックを追加。300件未満ではno-op、移動時はバックアップ作成後に確認済みrunだけ月別アーカイブへ移す。Legacyログにアーカイブ導線を追加。

- 2026-06-12: 修正依頼（needs_followup）から `followupOfRunId` 付きのおすすめ次作業を自動生成し、PATCH時とスケジュール起動時backfillで閉ループ化。同一Runからの重複生成を防止。修正ステージ表示はリンク優先、既存データは従来推測へフォールバック。

- 2026-06-12: Factory runner が作業開始時に `running` の作業履歴を記録し、完了時に同じ作業履歴を更新する方式へ変更。30分超の残留runningは待機中扱い。

- 2026-06-12: おすすめ次作業に `expired` 状態を追加。suggestedのまま30日超過したP1/P2候補はスケジュール起動時に期限切れへ移し、AI保留内訳に表示。

- 2026-06-12: 収益化ロードマップを `data/real/revenue-config.json` 駆動に変更。初期対象はBirdLog、現在収益は0円。

- 2026-06-12: Epic候補の承認時にGoalを任意で同時指定できるように変更。未指定時は従来どおり。

- 2026-06-12: AI工場停止中のみ、司令塔上部に停止継続日数・理由・Inbox導線を表示。

- 2026-06-12: アカウント登録・ストア公開申請・課金/サブスク・AdMob系の候補を「今日の判断」から除外しAI保留へ（どのアプリでも未実施の手続きで時期尚早のため。ユーザー指示）。実際に必要になるタイミングはRevenueの収益化ロードマップで案内

- 2026-06-12: Inboxの4区分（今日の判断/レビュー/Epic候補/AI保留）を縦積みセクションからタブ切り替えへ変更。タブバーに件数バッジ（今日の判断のみ赤字強調）

- 2026-06-11: 工場停止条件を変更。レビュー件数によるバックプレッシャー（10件減速/20件停止）を撤廃し、停止要因を「危険判断待ち（全体停止）/ Goal未設定（該当Epicスキップ）/ 人間作業（AI対象外）」のみに。Inboxを4セクション構成（①今日の判断=停止要因のみ最大3件 ②レビュー ③Epic候補 ④AI保留件数のみ）へ変更。ホームは「今日の判断 残りN件」を主表示にし、レビュー件数は参考情報化

- 2026-06-11: Inboxを「人間が何を判断するか」の6分類（検収/実行許可/方針選択/人間作業/危険判断/AI保留）へ再設計。優先順=危険判断→検収→方針選択→実行許可→人間作業で最大3件表示。定期実行・重複・内容不足・同テーマ大量候補はAI保留でカード非表示。Goal紐付けは目標名ボタン選択へ。ホームの①②③にも分類ラベル表示

- 2026-06-11: 今日の判断を「社長向け意思決定アプリ」へ強化。タイトルを状況文化（何が起きているか）、影響1行必須、分類を🚨問題/📈改善/✅確認へ変更、表示3件制限+AI保留導入、ホームに①②③リスト+約N分表示

- 2026-06-11: Inboxを「今日の判断」（社長向け承認アプリ）に全面リデザイン。カードを3分類（作業結果の確認/次の作業/Goal紐付け）に統一、内部概念（ExecutionRun/runId/reviewed/suggested等）はカード本文表示禁止・「詳細を見る」内のみ。ホームは件数+入口カードに変更
- 2026-06-11: 運用ガイドページ（📖運用タブ・/guide）新設。運用ドキュメント自動管理開始。BottomNav 6タブ化
- 2026-06-11: 新UX（人間用司令塔）導入。ホーム=司令塔 / Inbox(/decide) / Projects(/portfolio) / Revenue(/revenue) / Legacy退避。Goal Mapping移行（4 Goal投入・North Star=goal-ai-factory-os）
- 2026-06-11: レビュー滞留解消パイプライン追加（AI一次レビュー・一括処理・Factoryバックプレッシャー・Metrics・Human/AI Queue分離）
