import { normalizeUrl, hnFallbackUrl } from "../lib/normalizeUrl";

describe("normalizeUrl", () => {
  // 有効URL
  test("正常なHTTPS URLはそのまま返す", () => {
    expect(normalizeUrl("https://zenn.dev/articles/abc")).toBe("https://zenn.dev/articles/abc");
  });

  test("正常なHTTP URLはそのまま返す", () => {
    expect(normalizeUrl("http://example.org/news")).toBe("http://example.org/news");
  });

  // example.com の除外
  test("example.com は null を返す", () => {
    expect(normalizeUrl("https://example.com/gpt5")).toBeNull();
  });

  test("example.com のサブドメインも null を返す", () => {
    expect(normalizeUrl("https://sub.example.com/path")).toBeNull();
  });

  test("http://example.com も null を返す", () => {
    expect(normalizeUrl("http://example.com")).toBeNull();
  });

  // localhost / 127.0.0.1 の除外
  test("localhost は null を返す", () => {
    expect(normalizeUrl("http://localhost:3000")).toBeNull();
  });

  test("127.0.0.1 は null を返す", () => {
    expect(normalizeUrl("http://127.0.0.1/path")).toBeNull();
  });

  // 空・null・undefined
  test("空文字は null を返す", () => {
    expect(normalizeUrl("")).toBeNull();
  });

  test("null は null を返す", () => {
    expect(normalizeUrl(null)).toBeNull();
  });

  test("undefined は null を返す", () => {
    expect(normalizeUrl(undefined)).toBeNull();
  });

  // 不正URLフォーマット
  test("プロトコルなしは null を返す", () => {
    expect(normalizeUrl("not-a-url")).toBeNull();
  });

  test("ftp:// は null を返す", () => {
    expect(normalizeUrl("ftp://files.example.org/file")).toBeNull();
  });

  // 前後スペース除去
  test("前後スペースをトリムして有効URLを返す", () => {
    expect(normalizeUrl("  https://nhk.or.jp/news/  ")).toBe("https://nhk.or.jp/news/");
  });
});

describe("hnFallbackUrl", () => {
  test("HN discussion URLを生成する", () => {
    expect(hnFallbackUrl(12345678)).toBe(
      "https://news.ycombinator.com/item?id=12345678"
    );
  });
});
