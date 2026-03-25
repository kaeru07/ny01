import { NewsItem, PaperItem } from "./types";

export const mockNewsItems: NewsItem[] = [
  // 技術ニュース (優先表示)
  {
    id: "tech-1",
    title: "OpenAI、GPT-5を発表 — 推論能力が大幅に向上",
    summary:
      "OpenAIが次世代モデルGPT-5を正式発表。数学・コーディング・科学分野での推論能力が前世代比で40%向上したと発表。APIは今週中に段階的に公開予定。",
    url: "https://example.com/gpt5",
    source: "Hacker News",
    category: "tech",
    publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    score: 1842,
    isSummarized: true,
  },
  {
    id: "tech-2",
    title: "Vercel、Edge Runtimeの新機能を発表 — 起動時間50ms以下を実現",
    summary:
      "VercelがEdge Runtimeの大幅アップデートを発表。コールドスタートを50ms以下に削減し、Node.js互換性も向上。Next.js 15との統合が強化された。",
    url: "https://example.com/vercel-edge",
    source: "Hacker News",
    category: "tech",
    publishedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    score: 743,
    isSummarized: true,
  },
  {
    id: "tech-3",
    title: "Zenn: TypeScript 5.5の新機能まとめ — 型推論がさらに賢くなった",
    summary:
      "TypeScript 5.5では制御フロー解析が大幅に改善。正規表現の型チェック、Set/Map操作の型推論強化など開発体験向上の機能が多数追加された。",
    url: "https://example.com/ts55",
    source: "Zenn",
    category: "tech",
    publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "tech-4",
    title: "Rust 2024 Editionがリリース — 非同期処理の書き方が変わる",
    summary:
      "Rust 2024 Editionが正式リリース。async/awaitの記法が整理され、クロージャのキャプチャルールが改善。既存コードへの影響は最小限とされている。",
    url: "https://example.com/rust-2024",
    source: "Hacker News",
    category: "tech",
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    score: 521,
    isSummarized: true,
  },
  // 国内ニュース
  {
    id: "domestic-1",
    title: "政府、AI規制法案を閣議決定 — 2026年度施行へ",
    summary:
      "政府はAIの開発・利用に関する包括的な規制法案を閣議決定。リスクレベルに応じた規制区分を設け、高リスクAIには第三者審査を義務付ける方針。",
    url: "https://example.com/ai-law",
    source: "NHK",
    category: "domestic",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "domestic-2",
    title: "東京都、スタートアップ支援に100億円 — AIと量子コンピュータ重点",
    summary:
      "東京都は2026年度補正予算でスタートアップ支援に100億円を計上。AIと量子コンピュータ分野を重点領域とし、海外からの起業家誘致も強化する。",
    url: "https://example.com/tokyo-startup",
    source: "NHK",
    category: "domestic",
    publishedAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
  },
  // 海外ニュース (日本語要約)
  {
    id: "intl-1",
    title: "【海外】Anthropic、Claude 4を発表 — コーディング性能が飛躍的向上",
    summary:
      "【AI要約】AnthropicがClaude 4シリーズを発表。SWE-benchスコアが過去最高を記録し、複数ファイルにまたがるコード編集が可能に。Enterprise向けには長期記憶機能も搭載。",
    url: "https://example.com/claude4",
    source: "TechCrunch",
    category: "international",
    publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    isSummarized: true,
  },
  {
    id: "intl-2",
    title: "【海外】EU、AI Actの第一段階が発効 — 禁止AIシステムのリスト公開",
    summary:
      "【AI要約】EUのAI規制法「AI Act」第一段階が発効。社会的スコアリングや感情認識AIなど禁止対象システムの公式リストが公開された。違反企業には年商の6%相当の制裁金が課される。",
    url: "https://example.com/eu-ai-act",
    source: "BBC",
    category: "international",
    publishedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    isSummarized: true,
  },
];

export const mockPapers: PaperItem[] = [
  {
    id: "paper-1",
    title: "Attention Is All You Need — revisited",
    summary:
      "Transformerアーキテクチャの現状分析。6年間の進化と今後の方向性について包括的にレビュー。",
    authors: ["Smith, J.", "Tanaka, A."],
    url: "https://arxiv.org/abs/example",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    arxivId: "2403.12345",
  },
];
