# プロジェクト状態

## 現在状態: ✅ source階層化・URL品質改善・翻訳導線・X枠分離・論文翻訳導線 完了

## 完了作業
- [x] secretary: フェーズ整理
- [x] coder: ニュースリンク不具合修正 (2026-03-26)
- [x] coder: 論文機能 arXiv RSS 実装 (2026-03-26)
- [x] coder: source階層化 / URL品質改善 / 翻訳導線 / X枠分離 (2026-04-18)
- [x] coder: PaperCard 翻訳導線追加 (2026-04-18)

## 実装済み機能

### フィード階層
- **main**: NHK（国内）、NHK国際（海外）、Hacker News、Zenn、Dev.to
- **supplemental**: GitHub Trending（「話題のリポジトリ」タブ）
- **x**: claudeai / bcherny / AnthropicAI / claude_code（「Xで話題」タブ）

### URL品質
- `sourceTier` フィールドで main/supplemental/x を明示
- HN: story+url → 外部URL / Ask・Show・Job・Poll・urlなし → HNディスカッションページ
- NHK / Zenn / Dev.to: RSS link をそのまま canonicalUrl 候補
- example.com 完全排除
- URLなし記事は本当にURLがない場合のみ

### 翻訳導線
- 英語見出しは Google翻訳API（非公式・無料）で日本語化済み
- 詳細画面: 「翻訳して読む」ボタン（Google翻訳リンク）を全記事に表示
- 「原文で読む」「元記事を読む」ボタンを併置

### X枠 (Nitter RSS, 無料構成)
- claudeai / bcherny（通常取得）
- AnthropicAI（Claude Code関連キーワードフィルタ）
- claude_code（コミュニティ枠）
- 全インスタンス障害時も degraded 表示でアプリ継続

### source掲載基準
- `lib/sourcePolicy.ts` に `evaluateArticleQuality()` を実装
- pass / conditional / fail の3段階判定
- main tier + URL + タイトル + 十分な要約 → pass

## ブロッカー
なし

## テスト
- TypeScript エラー: 0
- テスト: 109件 全 pass
- Next.js build: ✅ 成功

## 再開方法
```bash
cd /root/ny01/news-app
npm run dev    # 開発: http://localhost:3000
npm run build  # 本番ビルド確認
npx jest       # テスト実行
```
