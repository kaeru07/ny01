---
updated: 2026-06-11
updateNote: 運用ガイドページ（📖運用タブ）新設・運用ドキュメント自動管理を開始
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

## 画面構成（BottomNav 6タブ）

| タブ | ルート | 役割 |
|---|---|---|
| 司令塔 | `/` | 毎日最初に開く画面。今日やること・AI工場の状態・収益マイルストーン・直近の成果 |
| Inbox | `/decide` | あなたが処理するものだけが入る箱。承認 / Goal紐付け / おすすめ承認 / needs_human確認 |
| Projects | `/portfolio` | 進行中プロジェクトの一覧と次の作業 |
| Revenue | `/revenue` | 収益化マイルストーンの現在地 |
| 📖 運用 | `/guide` | このアプリの使い方を自分で説明するページ（本ドキュメントと連動） |
| Legacy | `/legacy` | 旧画面群（URL / 案件 / ログ / 旧ホーム / 旧Factory / 旧Goal）への入口。無削除退避 |

## 日次運用フロー

- 朝: 司令塔 → Inbox → 判断 → 終了
- 夜: 司令塔 → Inbox → おすすめ次作業（推薦Epic）確認 → 終了

## AI工場のパイプライン

目標 → 大きな作業 → AI作業 → レビュー → 学習 → 次の作業

- レビュー待ちが 10 件を超えると Factory は自動減速（maxRuns=1）、20 件を超えると起動スキップ
- 解消手段: Inbox の「AIにまとめて確認させる」（AI一次レビュー一括実行）
- AI が判断できないものだけ needs_human として Inbox（Human Queue）に上がる

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

## 収益化ロードマップ

MVP完成 → ストア公開 → 広告導入 → DL100 → はじめての収益 1円

- 現在の対象: BirdLog（判定ロジックは `lib/command-center.ts` の `buildRevenueMilestones`）

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

- 2026-06-11: 運用ガイドページ（📖運用タブ・/guide）新設。運用ドキュメント自動管理開始。BottomNav 6タブ化
- 2026-06-11: 新UX（人間用司令塔）導入。ホーム=司令塔 / Inbox(/decide) / Projects(/portfolio) / Revenue(/revenue) / Legacy退避。Goal Mapping移行（4 Goal投入・North Star=goal-ai-factory-os）
- 2026-06-11: レビュー滞留解消パイプライン追加（AI一次レビュー・一括処理・Factoryバックプレッシャー・Metrics・Human/AI Queue分離）
