# 次のステップ

## 優先順位 (高→低)

### 1. Vercelデプロイ
```bash
npm i -g vercel
vercel --prod
```
- 環境変数は `.env.local` を参照
- `NEWS_CACHE_SECONDS` を設定（デフォルト 300s）

### 2. X枠の動作確認
- Nitter インスタンスの稼働状況を確認
  - `https://nitter.poast.org`
  - `https://nitter.privacydev.net`
  - `https://nitter.cz`
- 全インスタンスが停止している場合は degraded 表示で継続
- 代替インスタンスは `lib/fetchXFeed.ts` の `NITTER_INSTANCES` 配列を更新

### 3. AnthropicAI フィルタ調整
- `lib/fetchXFeed.ts` の `X_SOURCES` 内 `AnthropicAI` の `keywords` を調整
- 現在: `["Claude", "claude", "claude_code", "Claude Code"]`
- 必要に応じてキーワードを追加・削除

### 4. GitHub Trending 件数調整
- 現在 10件取得
- `app/page.tsx` の `fetchGitHubTrending(10)` を変更

### 5. 信頼性評価
- `lib/types.ts` の `TrustScore` を実装
- ソース別スコア, クロスチェックロジック
- `evaluateArticleQuality()` の `pass/conditional/fail` 判定と連携

### 6. PWAアイコン
- `public/icon-192.png`, `public/icon-512.png` を追加
- iPhoneホーム画面追加に対応
