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
});
