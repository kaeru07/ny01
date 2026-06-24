# Research Topic フォーマット仕様

news-app の `/research/[category]/[date]` は、Vault Markdown を「構造化 Research Topic」として解析してカード表示する。
ここでは Hermes / Codex / Claude Code が **構造化 Topic を生成する** ための仕様をまとめる。

> 思想: 「自由文の AI ニュースメモ」ではなく「構造化 Research DB」。
> 1 日次ファイル = 複数 Topic。1 Topic = 1 カード = 1 判断単位。

テンプレ実体は `content/research/_template.md`。本書は各項目の意味と記入基準を定義する。

---

## ファイル全体構造

```
# 市場調査ログ YYYY-MM-DD

## 今日の結論        … 3〜5 行。上部に結論カードとして表示
## 記事本文          … 1 日 1 ページの記事として読める詳細本文
## トピック一覧       … ### Topic N: 配下に各 Topic
## 今日のToDo候補     … 箇条書き
## 保留・未確認       … 箇条書き
## 取得状況（任意）   … status: partial で partial バッジ
```

- `## トピック一覧` が無い、または Topic を 1 件も抽出できない場合は **従来の全文 MarkdownView へ自動 fallback** する（旧フォーマット互換）。
- 見出しは日本語 / 英語どちらでも可（`今日の結論`／`結論`、`記事本文`／`詳細記事`／`本文`／`Article Body`、`トピック`、`ToDo`／`やること`、`保留`／`未確認`）。

## 記事本文

`## 記事本文` は、カード化された Topic の前に表示する読み物本文。
日次調査の背景、観測した変化、収益化への意味、次に取るべき一歩を文章でつなぎ、1 日 1 ページの記事として読める形にする。

- このセクションは必須。空欄にしない。
- 目安は 800〜1,500 字、最低 4 段落。
- 箇条書きだけで終わらせず、判断の流れが分かる段落にする。
- 本文内では必要に応じて `###` 小見出しを使ってよい。
- 個別の構造化データは `## トピック一覧` に残し、本文は全体像と意思決定の説明に寄せる。

2026-06-24 の既存生成物にはまだ `## 記事本文` が無かったため、次回生成では上記を満たすか確認する。

---

## Topic の項目

各 Topic は `### Topic N: タイトル`（`### Topic: タイトル` も可）で始める。配下に以下を書く。
ラベルは「`- 種別:`」のように箇条書きでも、「`種別:`」のようにダッシュ無しでも解釈される。値はラベル行の続き / 次行 / ネスト箇条書きのいずれでも良い。

| 項目 | Markdown ラベル | 型 | 未指定時 |
|---|---|---|---|
| topicId | `topic-id:` | slug 文字列 | title から自動生成 |
| TL;DR | `TL;DR:` | 1 行 | なし（非表示） |
| 種別 | `種別:` / `カテゴリ:` | enum（下記） | `general`（「一般」） |
| 重要度 | `重要度:` | `S`/`A`/`B`/`C` | `B` |
| 確度 | `確度:` / `信頼度:` | 高/中/低 | なし（バッジ非表示） |
| タグ | `タグ:` | `#tag` の箇条書き | `[]` |
| 要約 | `要約:` | 箇条書き | `[]` |
| 根拠 | `根拠:` | 箇条書き（折りたたみ） | `[]` |
| 参考URL | `参考URL:` / `参考リンク:` | URL 箇条書き | `[]`（セクション非表示） |
| 収益化への示唆 | `収益化への示唆:` / `収益化:` | 箇条書き | `[]` |
| 既存PJへの影響 | `既存PJへの影響:` | ネスト箇条書き | なし |
| 次アクション | `次アクション:` | 箇条書き | `[]` |
| ToDo化 | `ToDo化:` | yes/no | `false` |
| 更新日時 | `更新日時:` | ISO8601 | なし |
| timelineKey | `timelineKey:` / `タイムライン:` | slug | なし（topicId で代替） |
| duplicateKey | `duplicateKey:` / `重複キー:` | slug | なし |
| similarityHints | `similarityHints:` / `類似:` | 箇条書き | なし |
| sourceDate | `sourceDate:` / `情報日付:` | YYYY-MM-DD | 日次ファイルの date |
| relatedTopics | `relatedTopics:` / `関連トピック:` | topicId 箇条書き | なし |
| duplicateCandidates | `duplicateCandidates:` / `重複候補:` | topicId 箇条書き | なし |

---

## timelineKey（継続追跡）

同じテーマを日をまたいで追うときに **同じ `timelineKey`** を付ける。
`/research/topic/[id]` の「関連Timeline」に、同一 `timelineKey`（無ければ同一 `topicId`）の Topic が日付昇順で並ぶ。

```
timelineKey:
google-play-discovery
```

## duplicateKey / similarityHints（重複基盤）

重複候補を機械的に束ねるためのキー。**AI 判定はしない**。`/research/topic/[id]` の「重複候補」に同一 `duplicateKey` の Topic が並ぶ。

```
duplicateKey:
ai-learning-apps
similarityHints:
  - AI学習アプリ
  - クイズ生成
```

## sourceDate（情報の鮮度）

**情報そのものの日付**（取得日ではなく出来事/出典の日付）。未指定なら日次ファイルの日付を使う。
基準日から 30 日以上前だと「情報が古い」バッジ（stale）が付く。

```
sourceDate:
2026-05-27
```

---

## 種別（category）の基準

| 値 | 使う場面 |
|---|---|
| 市場 | 市場全体の動き・トレンド・配布/発見の変化 |
| 競合 | 特定アプリ/企業の動向・ポジショニング |
| ユーザー不満 | レビュー・SNS 等で観測した不満・痛点 |
| 収益化 | 課金・価格・収益モデルに直結する示唆 |
| 技術 | SDK / MCP / API / 実装手法など技術トレンド |
| ToDo候補 | そのまま作業 ToDo になりうるネタ |

未指定は `general`（カードでは「一般」）。

## 重要度（importance）の基準

| 値 | 目安 |
|---|---|
| S | 方針を変えるレベル。今すぐ反映を検討 |
| A | 重要。近いうちに反映/検証したい |
| B | 把握しておく。標準（未指定時もここ） |
| C | 参考。今は動かない |

## 確度（confidence）の基準

| 値 | 目安 |
|---|---|
| 高 (high) | 公式 / 一次情報で裏が取れている |
| 中 (medium) | 二次情報・複数状況証拠 |
| 低 (low) | 推測 / Reddit 等の未確認情報を含む |

`高/中/低` は内部で `high/medium/low` に正規化される。

## sourceType（参考URL の出典種別）

参考URL は次のいずれかで書く。`[label]` を付けると出典バッジに反映される。

```
- [official] https://...        ← 公式バッジ
- [reddit] https://reddit.com/...
- https://github.com/...         ← ドメインから github 推定
- App Store ランキング https://apps.apple.com/...
```

| sourceType | バッジ | 推定キーワード（ラベル / ドメイン） |
|---|---|---|
| official | 公式 | official / 公式 / *.google blog / openai.com / anthropic.com / developer |
| reddit | Reddit | reddit |
| github | GitHub | github.com |
| ranking | ランキング | apps.apple.com / play.google.com / appbrain / charts / hunted.space |
| paper | 論文 | arxiv / paper / 論文 |
| social | SNS | tiktok / lemon8 / instagram / x.com / youtube |
| news | ニュース | producthunt / techradar / globenewswire / news |
| other | （🔗のみ） | 上記以外 |

`[label]` が `official/reddit/...` と一致すればそれを最優先で使う。ラベルが無い場合はドメインから推定し、ドメインが表示ラベルになる。

## ToDo化（todoCandidate）の基準

- `yes`: そのトピックを作業 ToDo にすべき（カードに「ToDo候補」バッジ）。
- `no` / 未指定: ToDo にはしない。
- 受理する真値: `yes` / `y` / `true` / `はい` / `する` / `済` / `✓` / `◯`。

## 既存PJへの影響（affectsProjects）の書き方

ネスト箇条書きでプロジェクト別に書く。プロジェクト名は表記ゆれを吸収する。

```
- 既存PJへの影響:
  - Progress:
    - progress 側に反映したい内容
  - News App:
    - news-app 側に反映したい内容
  - Mahjong:
    - 
```

| 表記例 | 内部キー |
|---|---|
| Progress / 進捗 | progress |
| News App / NewsApp / ニュース | newsApp |
| Mahjong / 麻雀 | mahjong |
| Shogi / 将棋 | shogi |
| Scrape Lab / ScrapeLab | scrapeLab |
| Other / その他 | other |

---

## fallback と互換性

- 旧フォーマット（`## 注目ジャンル` 等の自由文）はそのまま MarkdownView 表示される。
- 解析できない Topic 構造でも、`## トピック一覧` に Topic が 0 件なら全文表示に戻る。
- 既存の `04_reviews` / `news` / `tools` 系ファイルは変更不要。
