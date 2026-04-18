# 作業ログ

## 2026-03-25

### [secretary] フェーズ整理
- フェーズ1: 設計・技術選定
- フェーズ2: 実装（最小版）
- フェーズ3: レビュー・デプロイ確認

### [pm] タスク分解
優先順位:
1. プロジェクト基盤 (Next.js, Tailwind)
2. データ型定義・APIルート
3. ニュース取得ロジック (HackerNews API + RSS)
4. ホーム画面・カードUI
5. 詳細画面
6. カテゴリフィルター
7. 論文プレースホルダー
8. Vercel設定

### [researcher] 技術選定結果
- ニュースAPI: Hacker News API (無料・キー不要、技術ニュース優先)
- 日本ニュース: NHK RSS, Zenn RSS (技術)
- 国際ニュース: BBC RSS + モック日本語要約（初期版）
- 要約: Claude API プレースホルダー (将来統合)
- フレームワーク: Next.js 14 App Router
- スタイル: Tailwind CSS (モバイルファースト)
- デプロイ: Vercel

### [architect] 設計完了
- App Router構成
- /app/page.tsx → ホーム（ニュース一覧）
- /app/news/[id]/page.tsx → 詳細
- /app/api/news/route.ts → ニュース取得API
- /app/api/papers/route.ts → 論文プレースホルダー
- /lib/types.ts → 型定義
- /lib/fetchNews.ts → データ取得ロジック

### [ui-designer] UI設計
- iPhone前提 (max-width: 390px想定)
- 縦スクロール、カードUI
- カテゴリタブ (全て/技術/国内/海外)
- 技術ニュースを最上部に表示

### [coder] 実装完了
- 全ファイル実装済み

### [reviewer] チェック完了
- モバイルレイアウト確認
- TypeScript型安全確認

### [deployer] デプロイ確認
- vercel.json作成
- .env.example作成
- build確認

## 2026-03-26

### [coder] ニュースリンク不具合修正
- `app/news/[id]/page.tsx`: `item.url` が空/未定義の場合にリンクを非活性表示するよう修正（従来は`href={undefined}`で壊れたリンクになっていた）
- `lib/fetchNews.ts`: NHK/Zennのフォールバック URL を追加（`item.link` が空文字の場合に各サービスのトップページURLを使用）
  - NHK: `https://www3.nhk.or.jp/news/`
  - Zenn: `https://zenn.dev`
- HackerNewsは既にフォールバック実装済みのため変更なし

### [coder] 論文機能 arXiv RSS 実装
- `lib/fetchPapers.ts` 新規作成: arXiv RSS (`cs.AI`, `cs.LG`, `cs.CL`) を並列フェッチ、Regexで XML パース、重複除去・新着順30件返却（APIキー不要、1時間キャッシュ）
- `app/api/papers/route.ts`: モックデータから `fetchPapers()` に切り替え
- `app/page.tsx`: `mockPapers` を `fetchPapers()` に差し替え、統計バーに論文件数を追加
- `components/NewsList.tsx`: 「論文機能 開発中」バナーを除去し、実データ表示に変更
- `next build` ✅

## 2026-04-18

### [coder] source階層化・URL品質改善・翻訳導線・X枠分離

**変更ファイル:**
- `lib/types.ts` — `FeedTier`, `XFeedResult` 追加, `FilterTab` に "github"/"x" 追加, `NewsItem` に `sourceTier` / `language` / `stars` 追加
- `lib/sourcePolicy.ts` (新規) — `classifySource()`, `evaluateArticleQuality()`, `isMainFeedSource()`
- `lib/fetchNews.ts` — 全ソースに `sourceTier` 付与, HN の canonicalUrl ルール明文化, BBC 削除, GitHub Trending を supplemental へ
- `lib/fetchXFeed.ts` (新規) — Nitter RSS 経由で X ソース取得（graceful degradation 対応）
- `lib/mockData.ts` — `sourceTier: "main"` を全モックアイテムに追加
- `components/CategoryFilter.tsx` — "話題のリポジトリ"(📦) / "Xで話題"(🐦) タブ追加
- `components/NewsList.tsx` — github/x タブのレンダリング, degraded 表示, main のみフィルタ
- `app/page.tsx` — `fetchGitHubTrending` / `fetchXFeeds` を別取得して NewsList へ渡す
- `app/news/[id]/page.tsx` — 全記事に「翻訳して読む」ボタン表示, supplemental/x バッジ追加, GitHub/X アイテムも検索対象
- `tests/source-policy.test.ts` (新規) — source tier / article quality テスト
- `tests/url.test.ts` (新規) — HN URL ルール / example.com 排除 / 翻訳リンク生成テスト

**確認:**
- TypeScript エラー: 0
- テスト: 109件 全 pass
- Next.js build: ✅ 成功

### [coder] PaperCard 翻訳導線追加
- `components/PaperCard.tsx` — 全体リンク `<a>` を廃止し、ボタン方式に変更
  - 「🌐 翻訳して読む」→ Google翻訳URL
  - 「原文 (arXiv)」→ abstract URL
  - 「PDF」→ `arxivId` がある場合のみ表示
- TypeScript エラー: 0、テスト: 109件 全 pass
