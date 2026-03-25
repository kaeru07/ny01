export type NewsCategory = "tech" | "domestic" | "international" | "paper";

export type FilterTab = "all" | NewsCategory;

export interface NewsItem {
  id: string;
  title: string;
  summary: string; // 日本語要約
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string; // ISO 8601
  imageUrl?: string;
  isSummarized?: boolean; // 海外ニュースはtrue
  score?: number; // HackerNews等のスコア
}

export interface PaperItem {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  url: string;
  publishedAt: string;
  arxivId?: string;
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
