/**
 * Vault (Hermes/Codex 市場調査) を読み込むための型定義。
 * 原本は /root/company/obsidian-vault/06_research/ 配下の Markdown。
 */

export type ResearchCategory =
  | "market"        // daily-market-research/
  | "news"          // daily-ai-news/
  | "tools"         // daily-ai-tools/
  | "method"        // market-research-method-review/
  | "monetization"  // 派生: daily-market-research の「収益化ヒント」セクション
  | "utilization"   // 派生: 各日次の「活用レビュー」セクション（現状は将来用）
  | "papers";       // daily-ai-papers/ + paper-watchlist.md（将来用）

export type Priority = "S" | "A" | "B" | "C";

export interface ResearchSection {
  heading: string;
  level: 2 | 3;
  body: string;
  items?: string[];
}

/** 活用レビュー欄。Markdown 側にあれば抽出、無ければ undefined。 */
export interface UtilizationReview {
  useCase?: string;
  monetization?: string;
  applyToExisting?: string;
  newAppIdea?: string;
  snsRepurpose?: string;
  doNow?: string;
  deferReason?: string;
  nextCheck?: string;
}

/** 注目の論文情報。将来 daily-ai-papers/ などに保存される想定。 */
export interface PaperInfo {
  title?: string;
  url?: string;
  org?: string;
  novelty?: string;
  indieImpact?: string;
  factoryImpact?: string;
  applicability?: string;
  monetizationRelation?: string;
  implementationIdea?: string;
  priority?: Priority;
}

export interface ResearchDoc {
  category: ResearchCategory;
  date: string;               // YYYY-MM-DD
  filename: string;
  relativePath: string;       // 06_research 配下の相対パス
  title: string;
  summary: string;
  sections: ResearchSection[];
  raw: string;
  utilization?: UtilizationReview;
  paperInfo?: PaperInfo;
  priority?: Priority;
  partial: boolean;
  hasError: boolean;
}

export interface MonetizationHintEntry {
  date: string;
  sourceCategory: ResearchCategory;
  items: string[];
  sourceDocPath: string;
}

export interface UtilizationEntry {
  date: string;
  sourceCategory: ResearchCategory;
  utilization: UtilizationReview;
  sourceTitle: string;
  sourceDocPath: string;
}

export interface CategoryMeta {
  slug: ResearchCategory;
  label: string;
  emoji: string;
  description: string;
  hasDetailPage: boolean;
}

export const CATEGORY_META: Record<ResearchCategory, CategoryMeta> = {
  market: {
    slug: "market",
    label: "市場調査",
    emoji: "📊",
    description: "個人開発・収益化観点の毎日の市場観測ログ",
    hasDetailPage: true,
  },
  news: {
    slug: "news",
    label: "AIニュース",
    emoji: "📰",
    description: "Claude/Codex/OpenAI/Gemini など AI 業界の日次ニュース",
    hasDetailPage: true,
  },
  tools: {
    slug: "tools",
    label: "AIツール",
    emoji: "🛠️",
    description: "個人開発で使える AI ツールの毎日棚卸し",
    hasDetailPage: true,
  },
  method: {
    slug: "method",
    label: "調査方法レビュー",
    emoji: "🔁",
    description: "調査方針そのものの日次自己レビュー",
    hasDetailPage: true,
  },
  monetization: {
    slug: "monetization",
    label: "収益化ヒント",
    emoji: "💰",
    description: "市場調査から抽出した収益化ヒントの集約ビュー",
    hasDetailPage: false,
  },
  utilization: {
    slug: "utilization",
    label: "活用レビュー",
    emoji: "🧭",
    description: "情報の使い道・反映候補・転用案の集約ビュー（将来用）",
    hasDetailPage: false,
  },
  papers: {
    slug: "papers",
    label: "注目の論文情報",
    emoji: "📄",
    description: "個人開発・AI 開発工場への影響度を中心に追う論文ウォッチリスト（将来用）",
    hasDetailPage: true,
  },
};

export const CATEGORY_ORDER: ResearchCategory[] = [
  "market",
  "news",
  "tools",
  "method",
  "monetization",
  "utilization",
  "papers",
];
