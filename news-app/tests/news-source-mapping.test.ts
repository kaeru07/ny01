/**
 * ニュースソースのURL/IDマッピングテスト
 *
 * 各ソースのXMLサンプルから parseRSSItems が正しく
 * link・guid・title を抽出できるか、
 * stableId が安定したIDを生成するか検証する。
 */

import { parseRSSItems } from "../lib/fetchNews";
import { normalizeUrl, xmlDecodeUrl, stableId } from "../lib/normalizeUrl";

// ─── NHK RSS サンプル ─────────────────────────────────────────────────────────

const NHK_RSS_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
<channel>
<title>NHKニュース</title>
<link>http://www3.nhk.or.jp/news/</link>
<item>
<title>トランプ氏 軍事作戦終結に向けた協議を主張 イランは否定</title>
<link>http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html</link>
<guid isPermaLink="true">http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html</guid>
<pubDate>Tue, 31 Mar 2026 08:32:30 +0900</pubDate>
<description>テスト記事の説明文</description>
</item>
<item>
<title>別の記事</title>
<link>http://www3.nhk.or.jp/news/html/20260331/k10015088072000.html</link>
<guid isPermaLink="true">http://www3.nhk.or.jp/news/html/20260331/k10015088072000.html</guid>
<pubDate>Tue, 31 Mar 2026 07:00:00 +0900</pubDate>
<description>別の記事の説明文</description>
</item>
</channel>
</rss>`;

// ─── BBC RSS サンプル（&amp; を含む） ─────────────────────────────────────────

const BBC_RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>BBC Japanese</title>
<link>https://www.bbc.com/japanese</link>
<item>
<title><![CDATA[トランプ氏、イランで体制転換が起こったと主張]]></title>
<description><![CDATA[テスト記事の説明文]]></description>
<link>https://www.bbc.com/japanese/articles/c86ejj93qx2o?at_medium=RSS&amp;at_campaign=rss</link>
<guid isPermaLink="false">https://www.bbc.com/japanese/articles/c86ejj93qx2o#0</guid>
<pubDate>Mon, 30 Mar 2026 04:10:41 GMT</pubDate>
</item>
<item>
<title><![CDATA[別のBBC記事]]></title>
<description><![CDATA[別の記事]]></description>
<link>https://www.bbc.com/japanese/articles/xyz789abc?at_medium=RSS&amp;at_campaign=rss</link>
<guid isPermaLink="false">https://www.bbc.com/japanese/articles/xyz789abc#0</guid>
<pubDate>Mon, 30 Mar 2026 08:39:08 GMT</pubDate>
</item>
</channel>
</rss>`;

// ─── Zenn RSS サンプル ────────────────────────────────────────────────────────

const ZENN_RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title><![CDATA[Zennのトレンド]]></title>
<link>https://zenn.dev</link>
<item>
<title><![CDATA[AI時代におけるタスク管理を考える]]></title>
<description><![CDATA[Zenn記事の説明文]]></description>
<link>https://zenn.dev/mkj/articles/geminitask_20260325</link>
<guid isPermaLink="true">https://zenn.dev/mkj/articles/geminitask_20260325</guid>
<pubDate>Mon, 30 Mar 2026 02:50:05 GMT</pubDate>
</item>
</channel>
</rss>`;

// ─── Dev.to RSS サンプル ──────────────────────────────────────────────────────

const DEVTO_RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>DEV Community</title>
<link>https://dev.to</link>
<item>
<title>fastrad: GPU-Native Radiomics at 25x the Speed</title>
<pubDate>Mon, 30 Mar 2026 23:43:36 +0000</pubDate>
<link>https://dev.to/helloerika__/fastrad-gpu-native-radiomics-3ha4</link>
<guid>https://dev.to/helloerika__/fastrad-gpu-native-radiomics-3ha4</guid>
<description>&lt;p&gt;Article description here&lt;/p&gt;</description>
</item>
</channel>
</rss>`;

// ─── NHK parse テスト ─────────────────────────────────────────────────────────

describe("parseRSSItems — NHK", () => {
  const items = parseRSSItems(NHK_RSS_SAMPLE);

  test("2件を正しくパースする", () => {
    expect(items).toHaveLength(2);
  });

  test("タイトルが正しく取得される", () => {
    expect(items[0].title).toBe("トランプ氏 軍事作戦終結に向けた協議を主張 イランは否定");
  });

  test("link が http:// URLとして取得される", () => {
    expect(items[0].link).toBe("http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html");
  });

  test("guid が link と同一", () => {
    expect(items[0].guid).toBe(items[0].link);
  });

  test("normalizeUrl が http:// NHK URLを有効とみなす", () => {
    expect(normalizeUrl(items[0].link)).not.toBeNull();
    expect(normalizeUrl(items[1].link)).not.toBeNull();
  });

  test("各アイテムのIDが安定している（Date.now() 非使用）", () => {
    const id0a = stableId("nhk", items[0].guid);
    const id0b = stableId("nhk", items[0].guid);
    expect(id0a).toBe(id0b);
  });

  test("2件のIDが異なる", () => {
    const id0 = stableId("nhk", items[0].guid);
    const id1 = stableId("nhk", items[1].guid);
    expect(id0).not.toBe(id1);
  });
});

// ─── BBC parse テスト ─────────────────────────────────────────────────────────

describe("parseRSSItems — BBC（&amp;含むURL）", () => {
  const items = parseRSSItems(BBC_RSS_SAMPLE);

  test("2件を正しくパースする", () => {
    expect(items).toHaveLength(2);
  });

  test("link の &amp; が & にデコードされる", () => {
    // parseRSSItems内でxmlDecodeUrlを通すため、&amp;は&になっているはず
    expect(items[0].link).not.toContain("&amp;");
    expect(items[0].link).toContain("&at_campaign=rss");
  });

  test("デコード後のlinkはnormalizeUrlを通過する", () => {
    expect(normalizeUrl(items[0].link)).not.toBeNull();
    expect(normalizeUrl(items[1].link)).not.toBeNull();
  });

  test("guidはlinkと異なる（#0付き）", () => {
    expect(items[0].guid).toBe("https://www.bbc.com/japanese/articles/c86ejj93qx2o#0");
    expect(items[0].guid).not.toBe(items[0].link);
  });

  test("IDはguidベースで安定している", () => {
    const id1 = stableId("bbc", items[0].guid);
    const id2 = stableId("bbc", items[0].guid);
    expect(id1).toBe(id2);
    expect(id1.startsWith("bbc-")).toBe(true);
  });

  test("2件のIDが異なる", () => {
    const id0 = stableId("bbc", items[0].guid);
    const id1 = stableId("bbc", items[1].guid);
    expect(id0).not.toBe(id1);
  });
});

// ─── Zenn parse テスト ───────────────────────────────────────────────────────

describe("parseRSSItems — Zenn", () => {
  const items = parseRSSItems(ZENN_RSS_SAMPLE);

  test("1件を正しくパースする", () => {
    expect(items).toHaveLength(1);
  });

  test("CDATA内タイトルが正しく取得される", () => {
    expect(items[0].title).toBe("AI時代におけるタスク管理を考える");
  });

  test("linkがhttps://zenn.devのURLである", () => {
    expect(items[0].link).toBe("https://zenn.dev/mkj/articles/geminitask_20260325");
  });

  test("normalizeUrl がZenn URLを有効とみなす", () => {
    expect(normalizeUrl(items[0].link)).toBe(items[0].link);
  });

  test("IDが安定している", () => {
    const id1 = stableId("zenn", items[0].guid);
    const id2 = stableId("zenn", items[0].guid);
    expect(id1).toBe(id2);
    expect(id1.startsWith("zenn-")).toBe(true);
  });
});

// ─── Dev.to parse テスト ─────────────────────────────────────────────────────

describe("parseRSSItems — Dev.to", () => {
  const items = parseRSSItems(DEVTO_RSS_SAMPLE);

  test("1件を正しくパースする", () => {
    expect(items).toHaveLength(1);
  });

  test("linkがhttps://dev.toのURLである", () => {
    expect(items[0].link).toBe("https://dev.to/helloerika__/fastrad-gpu-native-radiomics-3ha4");
  });

  test("IDが安定している", () => {
    const id1 = stableId("devto", items[0].guid);
    const id2 = stableId("devto", items[0].guid);
    expect(id1).toBe(id2);
  });
});

// ─── ID安定性の統合テスト ─────────────────────────────────────────────────────

describe("ID安定性 — fetchAllNews を複数回呼び出しても同一IDを返す", () => {
  test("NHKの同一記事URLから常に同じIDが生成される", () => {
    const url = "http://www3.nhk.or.jp/news/html/20260331/k10015088071000.html";
    // 異なるタイミングで呼び出してもIDは変わらない
    const ids = Array.from({ length: 5 }, () => stableId("nhk", url));
    expect(new Set(ids).size).toBe(1); // 全て同じ値
  });

  test("BBCの同一guidから常に同じIDが生成される", () => {
    const guid = "https://www.bbc.com/japanese/articles/c86ejj93qx2o#0";
    const ids = Array.from({ length: 5 }, () => stableId("bbc", guid));
    expect(new Set(ids).size).toBe(1);
  });

  test("Zennの同一記事URLから常に同じIDが生成される", () => {
    const url = "https://zenn.dev/mkj/articles/geminitask_20260325";
    const ids = Array.from({ length: 5 }, () => stableId("zenn", url));
    expect(new Set(ids).size).toBe(1);
  });

  test("Dev.toの同一記事URLから常に同じIDが生成される", () => {
    const url = "https://dev.to/helloerika__/fastrad-gpu-native-radiomics-3ha4";
    const ids = Array.from({ length: 5 }, () => stableId("devto", url));
    expect(new Set(ids).size).toBe(1);
  });
});

// ─── URLなし記事の扱い ────────────────────────────────────────────────────────

describe("URLバリデーション — 各ソースで無効URLを除外する", () => {
  test("example.com URLは除外される", () => {
    expect(normalizeUrl("https://example.com/article")).toBeNull();
  });

  test("空のlinkは除外される", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });

  test("有効なHTTPS URLはそのまま通過する", () => {
    const urls = [
      "https://news.ycombinator.com/item?id=12345",
      "https://zenn.dev/user/articles/abc",
      "https://www.bbc.com/japanese/articles/abc",
      "https://dev.to/user/article-slug",
      "https://github.com/owner/repo",
    ];
    for (const url of urls) {
      expect(normalizeUrl(url)).toBe(url);
    }
  });

  test("HNフォールバックURLは常に有効", () => {
    const { hnFallbackUrl } = require("../lib/normalizeUrl");
    const fallback = hnFallbackUrl(42742685);
    expect(normalizeUrl(fallback)).toBe(fallback);
  });
});
