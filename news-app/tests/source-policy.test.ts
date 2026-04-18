import { classifySource, evaluateArticleQuality, isMainFeedSource } from "../lib/sourcePolicy";
import { NewsItem } from "../lib/types";

describe("classifySource", () => {
  test("NHK は main", () => expect(classifySource("NHK")).toBe("main"));
  test("NHK国際 は main", () => expect(classifySource("NHK国際")).toBe("main"));
  test("Hacker News は main", () => expect(classifySource("Hacker News")).toBe("main"));
  test("Zenn は main", () => expect(classifySource("Zenn")).toBe("main"));
  test("Dev.to は main", () => expect(classifySource("Dev.to")).toBe("main"));
  test("DEV Community は main", () => expect(classifySource("DEV Community")).toBe("main"));
  test("GitHub Trending は supplemental", () => expect(classifySource("GitHub Trending")).toBe("supplemental"));
  test("claudeai は x", () => expect(classifySource("claudeai")).toBe("x"));
  test("bcherny は x", () => expect(classifySource("bcherny")).toBe("x"));
  test("AnthropicAI は x", () => expect(classifySource("AnthropicAI")).toBe("x"));
  test("claude_code は x", () => expect(classifySource("claude_code")).toBe("x"));
  test("未知のソースは supplemental", () => expect(classifySource("Unknown Source")).toBe("supplemental"));
});

describe("isMainFeedSource", () => {
  test("NHK は true", () => expect(isMainFeedSource("NHK")).toBe(true));
  test("Zenn は true", () => expect(isMainFeedSource("Zenn")).toBe(true));
  test("GitHub Trending は false", () => expect(isMainFeedSource("GitHub Trending")).toBe(false));
  test("claudeai は false", () => expect(isMainFeedSource("claudeai")).toBe(false));
});

describe("evaluateArticleQuality", () => {
  const baseMain: Partial<NewsItem> = {
    url: "https://www3.nhk.or.jp/news/html/test.html",
    title: "テスト記事",
    source: "NHK",
    sourceTier: "main",
    summary: "これはテスト記事の説明文です。十分な長さがある要約。",
  };

  test("main tier + 全フィールド揃い → pass", () => {
    expect(evaluateArticleQuality(baseMain)).toBe("pass");
  });

  test("URLなし → fail", () => {
    expect(evaluateArticleQuality({ ...baseMain, url: "" })).toBe("fail");
    expect(evaluateArticleQuality({ ...baseMain, url: undefined })).toBe("fail");
  });

  test("タイトルなし → fail", () => {
    expect(evaluateArticleQuality({ ...baseMain, title: "" })).toBe("fail");
    expect(evaluateArticleQuality({ ...baseMain, title: undefined })).toBe("fail");
  });

  test("sourceなし → fail", () => {
    expect(evaluateArticleQuality({ ...baseMain, source: undefined })).toBe("fail");
  });

  test("GitHub Trending → conditional", () => {
    expect(
      evaluateArticleQuality({
        ...baseMain,
        source: "GitHub Trending",
        sourceTier: "supplemental",
      })
    ).toBe("conditional");
  });

  test("X tier → conditional", () => {
    expect(
      evaluateArticleQuality({
        ...baseMain,
        source: "claudeai",
        sourceTier: "x",
      })
    ).toBe("conditional");
  });

  test("main tier だが要約が短い → conditional", () => {
    expect(evaluateArticleQuality({ ...baseMain, summary: "短い" })).toBe("conditional");
  });
});
