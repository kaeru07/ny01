export type NewsCategory = "tech" | "domestic" | "international" | "paper";

/** ソースの階層: main=メインフィード, supplemental=補助, x=Xで話題 */
export type FeedTier = "main" | "supplemental" | "x";

export type FilterTab = "all" | NewsCategory | "github" | "x";

export interface NewsItem {
  id: string;
  title: string;
  originalTitle?: string; // 翻訳前の英語タイトル
  summary: string; // 日本語要約
  url: string;
  source: string;
  category: NewsCategory;
  sourceTier: FeedTier;
  publishedAt: string; // ISO 8601
  imageUrl?: string;
  isSummarized?: boolean; // 海外ニュースはtrue
  score?: number; // HackerNews等のスコア
  // GitHub Trending 専用
  language?: string;
  stars?: number;
}

export interface PaperItem {
  id: string;
  title: string;
  originalTitle?: string; // 翻訳前の英語タイトル
  summary: string;
  authors: string[];
  url: string;
  publishedAt: string;
  arxivId?: string;
}

/** X (Twitter) フィード取得結果 */
export interface XFeedResult {
  items: NewsItem[];
  isDegraded: boolean;
  degradedSources: string[];
}

// 将来: 信頼性評価
export interface TrustScore {
  newsId: string;
  score: number; // 0-100
  factors: string[];
}

export interface NewsApiResponse {
  items: NewsItem[];
  fetchedAt: string;
  sources: string[];
}
