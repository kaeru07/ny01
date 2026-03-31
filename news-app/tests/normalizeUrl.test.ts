import { normalizeUrl, hnFallbackUrl, xmlDecodeUrl, stableId } from "../lib/normalizeUrl";

describe("normalizeUrl", () => {
  // 有効URL
  test("正常なHTTPS URLはそのまま返す", () => {
    expect(normalizeUrl("https://zenn.dev/articles/abc")).toBe("https://zenn.dev/articles/abc");
  });

  test("正常なHTTP URLはそのまま返す", () => {
    expect(normalizeUrl("http://example.org/news")).toBe("http://example.org/news");
  });

  test("NHKのhttp:// URLは有効とみなす", () => {
    const url = "http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html";
    expect(normalizeUrl(url)).toBe(url);
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

  // BBCのURLはxmlDecodeUrl後にnormalizeUrlが通る
  test("BBCのURL（&amp;デコード済み）は有効URLとみなす", () => {
    const decoded = "https://www.bbc.com/japanese/articles/c86ejj93qx2o?at_medium=RSS&at_campaign=rss";
    expect(normalizeUrl(decoded)).toBe(decoded);
  });
});

describe("hnFallbackUrl", () => {
  test("HN discussion URLを生成する", () => {
    expect(hnFallbackUrl(12345678)).toBe(
      "https://news.ycombinator.com/item?id=12345678"
    );
  });
});

describe("xmlDecodeUrl", () => {
  test("&amp; を & にデコードする", () => {
    const raw = "https://www.bbc.com/japanese/articles/abc?at_medium=RSS&amp;at_campaign=rss";
    expect(xmlDecodeUrl(raw)).toBe(
      "https://www.bbc.com/japanese/articles/abc?at_medium=RSS&at_campaign=rss"
    );
  });

  test("複数の &amp; をデコードする", () => {
    expect(xmlDecodeUrl("a=1&amp;b=2&amp;c=3")).toBe("a=1&b=2&c=3");
  });

  test("&lt; &gt; もデコードする", () => {
    expect(xmlDecodeUrl("a&lt;b&gt;c")).toBe("a<b>c");
  });

  test("XMLエンティティがなければそのまま返す", () => {
    const url = "https://zenn.dev/articles/abc123";
    expect(xmlDecodeUrl(url)).toBe(url);
  });

  test("デコード後URLはnormalizeUrlを通過する", () => {
    const raw = "https://www.bbc.com/japanese/articles/c86ejj93qx2o?a=1&amp;b=2";
    const decoded = xmlDecodeUrl(raw);
    expect(normalizeUrl(decoded)).not.toBeNull();
  });
});

describe("stableId", () => {
  test("同じ入力で常に同じIDを返す（安定性）", () => {
    const url = "http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html";
    const id1 = stableId("nhk", url);
    const id2 = stableId("nhk", url);
    const id3 = stableId("nhk", url);
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  test("異なるURLで異なるIDを返す（唯一性）", () => {
    const id1 = stableId("nhk", "http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html");
    const id2 = stableId("nhk", "http://www3.nhk.or.jp/news/html/20260331/k10015088072000.html");
    expect(id1).not.toBe(id2);
  });

  test("異なるプレフィックスで異なるIDを返す", () => {
    const url = "https://example.org/article/123";
    expect(stableId("nhk", url)).not.toBe(stableId("bbc", url));
    expect(stableId("zenn", url)).not.toBe(stableId("devto", url));
  });

  test("IDが prefix- で始まる", () => {
    expect(stableId("zenn", "https://zenn.dev/articles/abc")).toMatch(/^zenn-/);
    expect(stableId("bbc", "https://bbc.com/japanese/abc")).toMatch(/^bbc-/);
    expect(stableId("nhk-intl", "http://www3.nhk.or.jp/abc")).toMatch(/^nhk-intl-/);
  });

  test("IDに Date.now() が含まれない（タイムスタンプ非使用）", () => {
    const before = Date.now();
    const id = stableId("test", "https://example.org/article/stable");
    const after = Date.now();
    // IDが数値タイムスタンプを含まないことを確認
    const tsPattern = /\d{13}/; // 13桁 = Unix ms timestamp
    expect(id).not.toMatch(tsPattern);
    // Date.now() の値がIDに入っていないことも確認
    for (let ts = before; ts <= after; ts++) {
      expect(id).not.toContain(ts.toString());
    }
  });

  test("NHK記事URL → 安定ハッシュIDの具体例", () => {
    const url = "http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html";
    const id = stableId("nhk", url);
    // プレフィックスが正しい
    expect(id.startsWith("nhk-")).toBe(true);
    // 同一URL → 同一ID（複数回呼び出しても変わらない）
    expect(stableId("nhk", url)).toBe(id);
    expect(stableId("nhk", url)).toBe(id);
  });
});
