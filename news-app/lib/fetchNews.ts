import { NewsItem, NewsCategory } from "./types";
import { mockNewsItems } from "./mockData";

// Hacker News API (無料・キー不要)
const HN_API = "https://hacker-news.firebaseio.com/v0";
const HN_TOP_STORIES_URL = `${HN_API}/topstories.json`;

interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
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

export async function fetchHackerNews(limit = 10): Promise<NewsItem[]> {
  try {
    const res = await fetch(HN_TOP_STORIES_URL, {
      next: { revalidate: Number(process.env.NEWS_CACHE_SECONDS ?? 300) },
    });
    if (!res.ok) throw new Error("HN fetch failed");

    const ids: number[] = await res.json();
    const top = ids.slice(0, limit * 3); // スコアフィルタのため多めに取得

    const stories = await Promise.all(top.map(fetchHNStory));
    const valid = stories
      .filter((s): s is HNStory => s !== null && !!s.url && s.score > 10)
      .slice(0, limit);

    return valid.map((story) => ({
      id: `hn-${story.id}`,
      title: story.title,
      summary: `Hacker Newsで話題。スコア: ${story.score}点、${story.descendants ?? 0}件のコメント。`,
      url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
      source: "Hacker News",
      category: "tech" as NewsCategory,
      publishedAt: new Date(story.time * 1000).toISOString(),
      score: story.score,
    }));
  } catch (err) {
    console.error("[fetchHackerNews] error:", err);
    return [];
  }
}

// RSS取得ユーティリティ
async function fetchRSS(url: string): Promise<string> {
  const res = await fetch(url, {
    next: { revalidate: Number(process.env.NEWS_CACHE_SECONDS ?? 300) },
    headers: { "User-Agent": "NewsApp/1.0" },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${url}`);
  return res.text();
}

function parseRSSItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block))?.[1] ?? "";
    const link = (/<link>(.*?)<\/link>/.exec(block) || /<link\s+href="(.*?)"/.exec(block))?.[1] ?? "";
    const description = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) || /<description>(.*?)<\/description>/.exec(block))?.[1] ?? "";
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1] ?? new Date().toISOString();
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

export async function fetchNHKNews(limit = 5): Promise<NewsItem[]> {
  try {
    const xml = await fetchRSS("https://www3.nhk.or.jp/rss/news/cat0.xml");
    const items = parseRSSItems(xml).slice(0, limit);
    return items.map((item, i) => ({
      id: `nhk-${i}-${Date.now()}`,
      title: item.title,
      summary: item.description
        ? item.description.replace(/<[^>]+>/g, "").slice(0, 150)
        : "続きはリンク先でご確認ください。",
      url: item.link || "https://www3.nhk.or.jp/news/",
      source: "NHK",
      category: "domestic" as NewsCategory,
      publishedAt: new Date(item.pubDate).toISOString(),
    }));
  } catch (err) {
    console.error("[fetchNHKNews] error:", err);
    return [];
  }
}

export async function fetchZennTechNews(limit = 5): Promise<NewsItem[]> {
  try {
    const xml = await fetchRSS("https://zenn.dev/feed");
    const items = parseRSSItems(xml).slice(0, limit);
    return items.map((item, i) => ({
      id: `zenn-${i}-${Date.now()}`,
      title: item.title,
      summary: item.description
        ? item.description.replace(/<[^>]+>/g, "").slice(0, 150)
        : "Zennの技術記事です。",
      url: item.link || "https://zenn.dev",
      source: "Zenn",
      category: "tech" as NewsCategory,
      publishedAt: new Date(item.pubDate).toISOString(),
    }));
  } catch (err) {
    console.error("[fetchZennTechNews] error:", err);
    return [];
  }
}

// 全ニュース取得 (技術を優先ソート)
export async function fetchAllNews(): Promise<NewsItem[]> {
  const [hn, nhk, zenn] = await Promise.allSettled([
    fetchHackerNews(8),
    fetchNHKNews(5),
    fetchZennTechNews(5),
  ]);

  const items: NewsItem[] = [
    ...(hn.status === "fulfilled" ? hn.value : mockNewsItems.filter(n => n.category === "tech")),
    ...(zenn.status === "fulfilled" ? zenn.value : []),
    ...(nhk.status === "fulfilled" ? nhk.value : mockNewsItems.filter(n => n.category === "domestic")),
    // 海外ニュースは現在モックデータ (将来: BBCなどのRSS + Claude API要約)
    ...mockNewsItems.filter(n => n.category === "international"),
  ];

  // 技術ニュースを先頭に、次いで新しい順
  return items.sort((a, b) => {
    if (a.category === "tech" && b.category !== "tech") return -1;
    if (a.category !== "tech" && b.category === "tech") return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export function getNewsById(id: string, items: NewsItem[]): NewsItem | undefined {
  return items.find((n) => n.id === id);
}
