import { existsSync, readFileSync } from "fs";
import { parseDoc } from "../lib/research/parser";

describe("research parser", () => {
  test("記事本文セクションを構造化データへ抽出する", () => {
    const raw = `# 市場調査ログ 2026-06-24

## 今日の結論
AI動画広告生成は小規模事業者向けの収益化候補として見る。

## 記事本文
今日の調査では、AI動画広告生成が制作時間の短縮だけでなく、業種別テンプレートの販売余地につながることが分かった。

### 次に見る観点
美容室、不動産、飲食店のように訴求文が定型化しやすい業種から検証する。

## トピック一覧

### Topic 1: AI動画広告生成

topic-id:
ai-video-ad-generation

TL;DR:
業種別テンプレートにすると小さく課金しやすい。

- 種別:
  収益化
- 重要度:
  A
- 要約:
  - 動画広告生成の業種別テンプレート化に余地がある。
- 次アクション:
  - 1業種でLPと台本生成を試す。

## 今日のToDo候補
- 美容室向け動画広告テンプレートを1つ試作する。

## 保留・未確認
- 実際の広告費対効果は未確認。
`;

    const doc = parseDoc(
      "market",
      "2026-06-24",
      "2026-06-24.md",
      "daily-market-research/2026-06-24.md",
      raw
    );

    expect(doc.structured?.articleBody).toContain("AI動画広告生成");
    expect(doc.structured?.articleBody).toContain("### 次に見る観点");
    expect(doc.structured?.topics).toHaveLength(1);
  });

  test("トピック一覧が無くても記事本文があれば構造化する（記事レイアウト表示用）", () => {
    const raw = `# 市場調査ログ 2026-07-19

## 今日の結論
汎用AIアプリの上位固定化が進んでいる。

## 記事本文
本日の観測では、汎用AIアプリの定番化と周辺ワークフロー型ツールの細分化が同時に進んでいる。

## 注目ジャンル
- AI動画編集 / 需要が強い

## 参考URL
- https://example.com/ranking

## 取得状況
- status: partial
`;

    const doc = parseDoc(
      "market",
      "2026-07-19",
      "2026-07-19.md",
      "daily-market-research/2026-07-19.md",
      raw
    );

    expect(doc.structured).toBeDefined();
    expect(doc.structured?.topics).toHaveLength(0);
    expect(doc.structured?.conclusion).toContain("汎用AIアプリ");
    expect(doc.structured?.articleBody).toContain("周辺ワークフロー型ツール");
    expect(doc.structured?.restMarkdown).toContain("## 注目ジャンル");
    expect(doc.structured?.restMarkdown).toContain("## 参考URL");
    expect(doc.structured?.restMarkdown).not.toContain("取得状況");
    expect(doc.summary).toContain("汎用AIアプリ");
  });

  test("記事本文もトピックも無い旧フォーマットは従来どおり fallback する", () => {
    const raw = `# 市場調査ログ 2026-05-01

## 注目ジャンル
- 自由文のメモのみ
`;

    const doc = parseDoc(
      "market",
      "2026-05-01",
      "2026-05-01.md",
      "daily-market-research/2026-05-01.md",
      raw
    );

    expect(doc.structured).toBeUndefined();
  });

  // 実際の同梱日次ファイル（記事本文あり・トピック一覧なしの現行 Hermes 出力）の回帰確認
  const realFile = "content/research/daily-market-research/2026-07-19.md";
  const maybeTest = existsSync(realFile) ? test : test.skip;

  maybeTest("実ファイル 2026-07-19 が記事レイアウト用に構造化される", () => {
    const raw = readFileSync(realFile, "utf8");
    const doc = parseDoc(
      "market",
      "2026-07-19",
      "2026-07-19.md",
      "daily-market-research/2026-07-19.md",
      raw
    );
    expect(doc.structured).toBeDefined();
    expect(doc.structured?.topics).toHaveLength(0);
    expect(doc.structured?.articleBody.length).toBeGreaterThan(500);
    expect(doc.structured?.restMarkdown).toContain("## 参考URL");
    expect(doc.structured?.restMarkdown).not.toContain("## 取得状況");
    expect(doc.summary.length).toBeGreaterThan(0);
  });
});
