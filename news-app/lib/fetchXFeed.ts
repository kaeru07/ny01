/**
 * X (Twitter) フィード取得モジュール。
 * Nitter の RSS エンドポイントを利用する（公式 API 不使用・無料構成）。
 * 全インスタンスが落ちていても app 全体を壊さない設計。
 */

import { NewsItem, XFeedResult, FeedTier } from "./types";
import { stableId, normalizeUrl } from "./normalizeUrl";
import { parseRSSItems } from "./fetchNews";
import { translateBatch, isEnglish } from "./translate";

/** 試行する Nitter インスタンス（上から順に試す） */
const NITTER_INSTANCES = [
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://nitter.cz",
];

const FETCH_TIMEOUT_MS = 5000;

/** X ソース定義 */
interface XSource {
  username: string;
  displayName: string;
  /** AnthropicAI のように特定キーワードを含む投稿のみ採用する場合に指定 */
  keywords?: string[];
  limit: number;
}

const X_SOURCES: XSource[] = [
  { username: "claudeai", displayName: "claudeai", limit: 5 },
  { username: "bcherny", displayName: "bcherny", limit: 5 },
  {
    username: "AnthropicAI",
    displayName: "AnthropicAI",
    keywords: ["Claude", "claude", "claude_code", "Claude Code"],
    limit: 5,
  },
  { username: "claude_code", displayName: "claude_code", limit: 5 },
];

async function fetchNitterRSS(username: string): Promise<string | null> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`${instance}/${username}/rss`, {
        next: { revalidate: 1800 }, // 30分キャッシュ
        headers: { "User-Agent": "NewsApp/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const text = await res.text();
      // HTML エラーページでないか確認
      if (text.includes("<rss") || text.includes("<feed")) return text;
    } catch {
      // このインスタンスはスキップ
    }
  }
  return null;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

async function fetchXSource(src: XSource): Promise<NewsItem[] | null> {
  const xml = await fetchNitterRSS(src.username);
  if (!xml) return null;

  const parsed = parseRSSItems(xml).slice(0, src.limit * 3);
  const filtered = src.keywords
    ? parsed.filter(
        (item) =>
          matchesKeywords(item.title, src.keywords!) ||
          matchesKeywords(item.description, src.keywords!)
      )
    : parsed;

  const top = filtered.slice(0, src.limit);
  if (top.length === 0) return [];

  const titles = top.map((t) => t.title);
  const translated = await translateBatch(titles);

  return top
    .map((item, i): NewsItem | null => {
      const url = normalizeUrl(item.link);
      if (!url) return null;
      const isEng = isEnglish(item.title);
      const translatedTitle = translated[i];
      return {
        id: stableId(`x-${src.username}`, item.guid || item.link),
        title: translatedTitle ?? item.title,
        originalTitle: isEng && translatedTitle ? item.title : undefined,
        summary: item.description
          ? item.description.replace(/<[^>]+>/g, "").slice(0, 200)
          : `${src.displayName} の投稿です。`,
        url,
        source: src.displayName,
        category: "tech",
        sourceTier: "x",
        publishedAt: new Date(item.pubDate).toISOString(),
        isSummarized: isEng && translatedTitle !== null,
      };
    })
    .filter((item): item is NewsItem => item !== null);
}

/** 全 X ソースを取得する。取得失敗は degraded として記録する。 */
export async function fetchXFeeds(): Promise<XFeedResult> {
  const degradedSources: string[] = [];
  const allItems: NewsItem[] = [];

  const results = await Promise.allSettled(
    X_SOURCES.map((src) => fetchXSource(src))
  );

  for (let i = 0; i < results.length; i++) {
    const src = X_SOURCES[i];
    const result = results[i];
    if (result.status === "fulfilled" && result.value !== null) {
      allItems.push(...result.value);
    } else {
      degradedSources.push(src.displayName);
    }
  }

  return {
    items: allItems.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    ),
    isDegraded: degradedSources.length > 0,
    degradedSources,
  };
}
