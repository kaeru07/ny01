import { FeedTier, NewsItem } from "./types";

export type ArticleQuality = "pass" | "conditional" | "fail";

/**
 * ソース → ティア マッピング。
 * main: 一次情報・安定ソース（メインフィードに表示）
 * supplemental: 補助シグナル（別枠表示）
 * x: X/Twitter系（別タブ表示）
 */
const SOURCE_TIER_MAP: Record<string, FeedTier> = {
  NHK: "main",
  NHK国際: "main",
  "Hacker News": "main",
  Zenn: "main",
  "Dev.to": "main",
  "DEV Community": "main",
  "GitHub Trending": "supplemental",
  claudeai: "x",
  bcherny: "x",
  AnthropicAI: "x",
  claude_code: "x",
};

export function classifySource(source: string): FeedTier {
  return SOURCE_TIER_MAP[source] ?? "supplemental";
}

/**
 * 記事の掲載品質を3段階で判定する。
 *
 * pass        — main tier かつ URL・タイトル・要約が揃っている
 * conditional — supplemental/x tier、または要約が弱い
 * fail        — URL なし、タイトルなし、または明らかにノイズ
 */
export function evaluateArticleQuality(item: Partial<NewsItem>): ArticleQuality {
  if (!item.url || item.url.trim().length === 0) return "fail";
  if (!item.title || item.title.trim().length === 0) return "fail";
  if (!item.source) return "fail";

  const tier = item.sourceTier ?? classifySource(item.source);

  if (tier === "supplemental" || tier === "x") return "conditional";

  const hasSummary =
    typeof item.summary === "string" && item.summary.trim().length > 10;
  if (hasSummary) return "pass";

  return "conditional";
}

/** main feed に含めるべきかどうか */
export function isMainFeedSource(source: string): boolean {
  return classifySource(source) === "main";
}
