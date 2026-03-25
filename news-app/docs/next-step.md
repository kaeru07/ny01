# 次のステップ

## 優先順位 (高→低)

### 1. Vercelデプロイ
```bash
# Vercel CLIでデプロイ
npm i -g vercel
vercel --prod
```
- .env.example を参考に環境変数を設定
- `ANTHROPIC_API_KEY` は後で追加可能

### 2. 海外ニュース自動要約 (Claude API)
- `app/api/summarize/route.ts` を作成
- `lib/fetchNews.ts` の `fetchBBCNews()` に要約処理を追加
- 環境変数: `ANTHROPIC_API_KEY`

### 3. 論文機能実装
- `app/api/papers/route.ts` にarXiv API連携を追加
- arXiv API (無料・キー不要): `https://export.arxiv.org/api/query`
- フィルタ例: `cs.AI`, `cs.LG`

### 4. 信頼性評価
- `lib/types.ts` の `TrustScore` を実装
- ソース別スコア, クロスチェックロジック

### 5. PWAアイコン
- `public/icon-192.png`, `public/icon-512.png` を追加
- iPhoneホーム画面追加に対応

## 必要ファイル
- `.env.local` (`.env.example`をコピーして作成)
- `public/icon-192.png`, `public/icon-512.png`
