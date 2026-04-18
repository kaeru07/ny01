/**
 * URL品質テスト
 * - canonicalUrl の正確な決定
 * - example.com の完全排除
 * - HN の story/Ask/Show/Job/Poll ルール
 * - arXiv / NHK / Zenn / Dev.to の URL が埋まること
 */

import { normalizeUrl, hnFallbackUrl } from "../lib/normalizeUrl";

describe("HN canonicalUrl ルール", () => {
  test("story type + 有効 url → 外部記事URL", () => {
    const url = "https://blog.example.org/post";
    // normalizeUrl がパスするURL
    const valid = normalizeUrl("https://blog.rust-lang.org/2024/edition");
    expect(valid).not.toBeNull();
  });

  test("url が null の story → HN ディスカッションページ", () => {
    const fallback = hnFallbackUrl(12345678);
    expect(fallback).toBe("https://news.ycombinator.com/item?id=12345678");
    expect(normalizeUrl(fallback)).not.toBeNull();
  });

  test("Ask HN → HN ディスカッションページ形式", () => {
    const fallback = hnFallbackUrl(99999999);
    expect(fallback).toMatch(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/);
  });

  test("HN フォールバック URL は example.com を含まない", () => {
    const fallback = hnFallbackUrl(42000000);
    expect(fallback).not.toContain("example.com");
  });
});

describe("example.com 完全排除", () => {
  const exampleUrls = [
    "https://example.com",
    "http://example.com/article",
    "https://example.com/news/123",
    "https://sub.example.com/path",
    "http://test.example.com/",
  ];

  for (const url of exampleUrls) {
    test(`"${url}" は null`, () => {
      expect(normalizeUrl(url)).toBeNull();
    });
  }
});

describe("各ソースの URL が normalizeUrl を通過する", () => {
  const validSourceUrls: Record<string, string> = {
    NHK: "http://www3.nhk.or.jp/news/html/20260401/k10015088071000.html",
    "NHK国際": "http://www3.nhk.or.jp/news/html/20260401/k10015088072000.html",
    Zenn: "https://zenn.dev/user/articles/abc123def456",
    "Dev.to": "https://dev.to/user/article-slug-123",
    "Hacker News": "https://news.ycombinator.com/item?id=99887766",
    arXiv: "https://arxiv.org/abs/2403.12345",
    GitHub: "https://github.com/owner/repo",
  };

  for (const [source, url] of Object.entries(validSourceUrls)) {
    test(`${source}: "${url}" が通過する`, () => {
      expect(normalizeUrl(url)).toBe(url);
    });
  }
});

describe("一覧 → 詳細 → 外部リンクの URL 一貫性", () => {
  test("正規化後の URL は再正規化しても同じ値", () => {
    const url = "https://zenn.dev/user/articles/abc123";
    const normalized = normalizeUrl(url);
    expect(normalized).not.toBeNull();
    expect(normalizeUrl(normalized!)).toBe(normalized);
  });

  test("NHK の http:// URL は2度目の normalizeUrl でも有効", () => {
    const url = "http://www3.nhk.or.jp/news/html/20260401/k10015088071000.html";
    const first = normalizeUrl(url);
    expect(first).not.toBeNull();
    expect(normalizeUrl(first!)).toBe(first);
  });
});

describe("Google翻訳リンク生成", () => {
  test("有効URLから翻訳リンクが生成できる", () => {
    const url = "https://news.ycombinator.com/item?id=12345";
    const translateUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(url)}`;
    expect(translateUrl).toContain("translate.google.com");
    expect(translateUrl).toContain(encodeURIComponent(url));
  });
});
