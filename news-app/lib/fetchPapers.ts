import { PaperItem } from "./types";
import { normalizeUrl } from "./normalizeUrl";
import { translateBatch } from "./translate";

const ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL"];

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
}

function parseArxivId(url: string): string {
  const match = url.match(/arxiv\.org\/abs\/([^\s?#]+)/i);
  return match ? match[1] : "";
}

function parseAuthors(creator: string): string[] {
  if (!creator) return [];
  return creator
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 5); // 最大5人
}

function cleanTitle(title: string): string {
  // "Title (arXiv:2403.12345v1 [cs.AI])" → "Title"
  return title.replace(/\s*\(arXiv:[^\)]+\)\s*$/, "").trim();
}

async function fetchArxivRss(category: string): Promise<PaperItem[]> {
  const url = `https://rss.arxiv.org/rss/${category}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // 1時間キャッシュ
      headers: { "User-Agent": "news-app/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items: PaperItem[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = cleanTitle(extractTag(block, "title"));
      const link = extractTag(block, "link");
      const description = extractTag(block, "description");
      const creator = extractTag(block, "dc:creator");
      const pubDate = extractTag(block, "pubDate");
      const arxivId = parseArxivId(link);

      if (!title || !link) continue;
      const url = normalizeUrl(link);
      if (!url) continue; // 無効URLはスキップ

      items.push({
        id: `arxiv-${arxivId || encodeURIComponent(title).slice(0, 40)}`,
        title,
        summary: description.replace(/<[^>]+>/g, "").trim(),
        authors: parseAuthors(creator),
        url,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        arxivId: arxivId || undefined,
      });
    }

    return items;
  } catch {
    return [];
  }
}

export async function fetchPapers(): Promise<PaperItem[]> {
  const results = await Promise.allSettled(
    ARXIV_CATEGORIES.map((cat) => fetchArxivRss(cat))
  );

  const allPapers: PaperItem[] = [];
  const seenIds = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const paper of result.value) {
        if (!seenIds.has(paper.id)) {
          seenIds.add(paper.id);
          allPapers.push(paper);
        }
      }
    }
  }

  // 新しい順にソートして15件に絞る
  allPapers.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const top15 = allPapers.slice(0, 15);

  // タイトルと要約を一括翻訳
  const titles = top15.map((p) => p.title);
  const summaries = top15.map((p) => p.summary);
  const [translatedTitles, translatedSummaries] = await Promise.all([
    translateBatch(titles),
    translateBatch(summaries),
  ]);

  return top15.map((paper, i) => ({
    ...paper,
    title: translatedTitles[i] ?? paper.title,
    summary: translatedSummaries[i] ?? paper.summary,
  }));
}
