import { NewsItem, NewsCategory, FeedTier } from "./types";
import { mockNewsItems } from "./mockData";
import { normalizeUrl, hnFallbackUrl, xmlDecodeUrl, stableId } from "./normalizeUrl";
import { translateBatch, isEnglish } from "./translate";

// ─── Hacker News ──────────────────────────────────────────────────────────────

const HN_API = "https://hacker-news.firebaseio.com/v0";
const HN_TOP_STORIES_URL = `${HN_API}/topstories.json`;

interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  type?: string; // "story" | "ask" | "show" | "job" | "poll"
  descendants?: number;
}

async function fetchHNStory(id: number): Promise<HNStory | null> {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`, {
      next: { revalidate: Number(process.env.NEWS_CACHE_SECONDS ?? 300) },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Hacker News の canonicalUrl 決定ルール:
 *   story type かつ story.url がある → 外部記事URL
 *   それ以外（Ask / Show / Job / Poll / url欠落）→ HN ディスカッションページ
 */
function hnCanonicalUrl(story: HNStory): string {
  if (story.type === "story" && story.url) {
    const validated = normalizeUrl(story.url);
    if (validated) return validated;
  }
  return hnFallbackUrl(story.id);
}

export async function fetchHackerNews(limit = 15): Promise<NewsItem[]> {
  try {
    const res = await fetch(HN_TOP_STORIES_URL, {
      next: { revalidate: Number(process.env.NEWS_CACHE_SECONDS ?? 300) },
    });
    if (!res.ok) throw new Error("HN fetch failed");

    const ids: number[] = await res.json();
    const top = ids.slice(0, limit * 4); // スコアフィルタのため多めに取得

    const stories = await Promise.all(top.map(fetchHNStory));
    const valid = stories
      .filter((s): s is HNStory => s !== null && s.score > 10)
      .slice(0, limit);

    // 英語タイトルを一括翻訳
    const titles = valid.map((s) => s.title);
    const translated = await translateBatch(titles);

    return valid.map((story, i) => {
      const url = hnCanonicalUrl(story);
      const isEng = isEnglish(story.title);
      const translatedTitle = translated[i];

      return {
        id: `hn-${story.id}`,
        title: translatedTitle ?? story.title,
        originalTitle: isEng && translatedTitle ? story.title : undefined,
        summary: `Hacker Newsで話題。スコア: ${story.score}点、${story.descendants ?? 0}件のコメント。`,
        url,
        source: "Hacker News",
        category: "tech" as NewsCategory,
        sourceTier: "main",
        publishedAt: new Date(story.time * 1000).toISOString(),
        score: story.score,
        isSummarized: isEng && translatedTitle !== null,
      };
    });
  } catch (err) {
    console.error("[fetchHackerNews] error:", err);
    return [];
  }
}

// ─── RSS ユーティリティ ────────────────────────────────────────────────────────

async function fetchRSS(url: string): Promise<string> {
  const res = await fetch(url, {
    next: { revalidate: Number(process.env.NEWS_CACHE_SECONDS ?? 300) },
    headers: { "User-Agent": "NewsApp/1.0" },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${url}`);
  return res.text();
}

/**
 * RSS <item> を解析して返す。
 * - link: XML実体参照デコード済み記事URL
 * - guid: 記事の一意識別子（安定ID生成に使用）
 *
 * ソースごとのlink/guid形式:
 *   NHK     : <link>http://www3.nhk.or.jp/...</link>  <guid isPermaLink="true">同URL</guid>
 *   Zenn    : <link>https://zenn.dev/...</link>         <guid isPermaLink="true">同URL</guid>
 *   Dev.to  : <link>https://dev.to/...</link>           <guid>同URL</guid>
 */
export function parseRSSItems(xml: string): Array<{
  title: string;
  link: string;
  guid: string;
  description: string;
  pubDate: string;
}> {
  const items: Array<{
    title: string;
    link: string;
    guid: string;
    description: string;
    pubDate: string;
  }> = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title =
      (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ||
        /<title>(.*?)<\/title>/.exec(block))?.[1] ?? "";

    // link: XML実体参照(&amp; 等)をデコードして正しいURLに戻す
    const rawLink =
      (/<link>(.*?)<\/link>/.exec(block) ||
        /<link\s+href="(.*?)"/.exec(block))?.[1] ?? "";
    const link = xmlDecodeUrl(rawLink.trim());

    // guid: 安定ID生成に使用（linkと同じことが多い）
    const rawGuid =
      (/<guid[^>]*><!\[CDATA\[(.*?)\]\]><\/guid>/.exec(block) ||
        /<guid[^>]*>(.*?)<\/guid>/.exec(block))?.[1]?.trim() ?? "";
    const guid = xmlDecodeUrl(rawGuid);

    const description =
      (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ||
        /<description>(.*?)<\/description>/.exec(block))?.[1] ?? "";

    const pubDate =
      (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1] ??
      new Date().toISOString();

    const effectiveLink = link || guid;
    if (title && effectiveLink) {
      items.push({
        title,
        link: effectiveLink,
        guid: guid || effectiveLink,
        description,
        pubDate,
      });
    }
  }
  return items;
}

// ─── NHK（国内） ──────────────────────────────────────────────────────────────

export async function fetchNHKNews(limit = 15): Promise<NewsItem[]> {
  try {
    const xml = await fetchRSS("https://www3.nhk.or.jp/rss/news/cat0.xml");
    const items = parseRSSItems(xml).slice(0, limit);
    return items
      .map((item) => {
        const url = normalizeUrl(item.link);
        if (!url) return null;
        return {
          id: stableId("nhk", item.guid || item.link),
          title: item.title,
          summary: item.description
            ? item.description.replace(/<[^>]+>/g, "").slice(0, 150)
            : "続きはリンク先でご確認ください。",
          url,
          source: "NHK",
          category: "domestic" as NewsCategory,
          sourceTier: "main" as FeedTier,
          publishedAt: new Date(item.pubDate).toISOString(),
        };
      })
      .filter((item): item is NewsItem => item !== null);
  } catch (err) {
    console.error("[fetchNHKNews] error:", err);
    return [];
  }
}

// ─── Zenn（技術） ─────────────────────────────────────────────────────────────

export async function fetchZennTechNews(limit = 5): Promise<NewsItem[]> {
  try {
    const xml = await fetchRSS("https://zenn.dev/feed");
    const items = parseRSSItems(xml).slice(0, limit);
    return items
      .map((item) => {
        const url = normalizeUrl(item.link);
        if (!url) return null;
        return {
          id: stableId("zenn", item.guid || item.link),
          title: item.title,
          summary: item.description
            ? item.description.replace(/<[^>]+>/g, "").slice(0, 150)
            : "Zennの技術記事です。",
          url,
          source: "Zenn",
          category: "tech" as NewsCategory,
          sourceTier: "main" as FeedTier,
          publishedAt: new Date(item.pubDate).toISOString(),
        };
      })
      .filter((item): item is NewsItem => item !== null);
  } catch (err) {
    console.error("[fetchZennTechNews] error:", err);
    return [];
  }
}

// ─── Dev.to（技術、英語） ──────────────────────────────────────────────────────

export async function fetchDevToNews(limit = 5): Promise<NewsItem[]> {
  try {
    const xml = await fetchRSS("https://dev.to/feed");
    const items = parseRSSItems(xml).slice(0, limit);

    const titles = items.map((item) => item.title);
    const translated = await translateBatch(titles);

    const result: NewsItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const url = normalizeUrl(item.link);
      if (!url) continue;
      const isEng = isEnglish(item.title);
      const translatedTitle = translated[i];
      result.push({
        id: stableId("devto", item.guid || item.link),
        title: translatedTitle ?? item.title,
        originalTitle: isEng && translatedTitle ? item.title : undefined,
        summary: item.description
          ? item.description.replace(/<[^>]+>/g, "").slice(0, 150)
          : "Dev.toの技術記事です。",
        url,
        source: "Dev.to",
        category: "tech" as NewsCategory,
        sourceTier: "main" as FeedTier,
        publishedAt: new Date(item.pubDate).toISOString(),
        isSummarized: isEng && translatedTitle !== null,
      });
    }
    return result;
  } catch (err) {
    console.error("[fetchDevToNews] error:", err);
    return [];
  }
}

// ─── GitHub Trending（supplemental） ──────────────────────────────────────────
// sourceTier: "supplemental" — main feed には混ぜない

export async function fetchGitHubTrending(limit = 10): Promise<NewsItem[]> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const apiUrl = `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=${limit}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "NewsApp/1.0",
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const repos: Array<{
      id: number;
      full_name: string;
      description: string | null;
      html_url: string;
      stargazers_count: number;
      created_at: string;
      language: string | null;
    }> = (data.items ?? []).slice(0, limit);

    const descriptions = repos.map((r) => r.description ?? "");
    const translated = await translateBatch(descriptions);

    return repos.map((repo, i) => {
      const rawDesc = repo.description ?? "";
      const translatedDesc = translated[i];
      const langBadge = repo.language ? ` [${repo.language}]` : "";
      return {
        id: `gh-${repo.id}`,
        title: `${repo.full_name}${langBadge} ⭐${repo.stargazers_count}`,
        summary:
          translatedDesc ??
          (rawDesc ? rawDesc.slice(0, 150) : "GitHubトレンドのリポジトリです。"),
        url: repo.html_url,
        source: "GitHub Trending",
        category: "tech" as NewsCategory,
        sourceTier: "supplemental" as FeedTier,
        publishedAt: repo.created_at,
        language: repo.language ?? undefined,
        stars: repo.stargazers_count,
      };
    });
  } catch (err) {
    console.error("[fetchGitHubTrending] error:", err);
    return [];
  }
}

// ─── NHK国際 ─────────────────────────────────────────────────────────────────

async function fetchNHKInternational(limit = 8): Promise<NewsItem[]> {
  try {
    const xml = await fetchRSS("https://www3.nhk.or.jp/rss/news/cat6.xml");
    const items = parseRSSItems(xml).slice(0, limit);
    return items
      .map((item) => {
        const url = normalizeUrl(item.link);
        if (!url) return null;
        return {
          id: stableId("nhk-intl", item.guid || item.link),
          title: item.title,
          summary: item.description
            ? item.description.replace(/<[^>]+>/g, "").slice(0, 150)
            : "続きはリンク先でご確認ください。",
          url,
          source: "NHK国際",
          category: "international" as NewsCategory,
          sourceTier: "main" as FeedTier,
          publishedAt: new Date(item.pubDate).toISOString(),
        };
      })
      .filter((item): item is NewsItem => item !== null);
  } catch (err) {
    console.error("[fetchNHKInternational] error:", err);
    return [];
  }
}

// ─── 全ニュース取得（main feed のみ） ─────────────────────────────────────────

/**
 * main feed 向けニュースを返す。
 * GitHub Trending（supplemental）・X系（x）は含まない。
 *
 * カテゴリ別目標件数:
 *   tech:          25件 (HN 15 + Zenn 5 + Dev.to 5)
 *   domestic:      15件 (NHK)
 *   international:  8件 (NHK国際)
 */
export async function fetchAllNews(): Promise<NewsItem[]> {
  const [hn, nhk, zenn, nhkIntl, devto] = await Promise.allSettled([
    fetchHackerNews(15),
    fetchNHKNews(15),
    fetchZennTechNews(5),
    fetchNHKInternational(8),
    fetchDevToNews(5),
  ]);

  const getValue = <T>(
    result: PromiseSettledResult<T[]>,
    fallback: T[] = []
  ): T[] =>
    result.status === "fulfilled" ? result.value : fallback;

  const items: NewsItem[] = [
    ...getValue(hn, mockNewsItems.filter((n) => n.category === "tech")),
    ...getValue(zenn),
    ...getValue(devto),
    ...getValue(nhk, mockNewsItems.filter((n) => n.category === "domestic")),
    ...getValue(nhkIntl, mockNewsItems.filter((n) => n.category === "international")),
  ];

  const CATEGORY_PRIORITY: Record<NewsCategory, number> = {
    tech: 0,
    domestic: 1,
    international: 2,
    paper: 3,
  };

  return items.sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category];
    const pb = CATEGORY_PRIORITY[b.category];
    if (pa !== pb) return pa - pb;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export function getNewsById(id: string, items: NewsItem[]): NewsItem | undefined {
  return items.find((n) => n.id === id);
}
