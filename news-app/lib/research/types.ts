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

/** 確度（情報の確からしさ）。Markdown の「確度: 高/中/低」を正規化する。 */
export type ConfidenceLevel = "high" | "medium" | "low";

/** 参考URL の出典種別。ラベル・ドメインから推定する。 */
export type SourceType =
  | "official"
  | "reddit"
  | "github"
  | "ranking"
  | "paper"
  | "social"
  | "news"
  | "other";

/** 参考URL: 表示はラベル（無ければドメイン）、リンク先は url。 */
export interface ReferenceLink {
  url: string;
  label?: string;
  sourceType?: SourceType;
}

/** トピックが影響しうる既存プロジェクト。記載のあるキーのみ埋まる。 */
export interface AffectsProjects {
  progress?: string[];
  newsApp?: string[];
  mahjong?: string[];
  shogi?: string[];
  scrapeLab?: string[];
  other?: string[];
}

/** 1トピック = 1カード。新フォーマット「## トピック一覧」配下の各 ### Topic を表す。 */
export interface ResearchTopic {
  /** 安定参照用 slug。Markdown の topic-id、無ければ title から生成。 */
  topicId?: string;
  index: number;
  title: string;
  kind: string;          // 種別（市場 / 競合 / ユーザー不満 / 収益化 / 技術 / ToDo候補 / general）
  importance: Priority;  // 重要度 S/A/B/C（未指定は B）
  confidence?: ConfidenceLevel;
  /** 1 行要約（TL;DR）。カード最上部に出す。 */
  summaryTlDr?: string;
  summary: string[];
  evidence: string[];          // 根拠（折りたたみ表示）
  references: ReferenceLink[]; // 参考URL
  monetizationImpact: string[]; // 収益化への示唆
  affectsProjects?: AffectsProjects;
  nextActions: string[];        // 次アクション
  todoCandidate: boolean;       // ToDo化候補（未指定は false）
  tags: string[];
  updatedAt?: string;           // ISO8601 文字列（あれば）
  /** Topic の継続変化を横断追跡するためのキー。同一値の Topic を timeline として束ねる。 */
  timelineKey?: string;
  /** 重複検出の基盤キー。AI 判定はせず、同一値を重複候補として扱える構造のみ用意。 */
  duplicateKey?: string;
  /** 重複判定の手がかり（将来用）。 */
  similarityHints?: string[];
  /** 情報そのものの日付（sourceDate）。stale 判定に使う。未指定時は日次ファイルの date。 */
  sourceDate?: string;
  /** 関連 Topic の topicId（将来用）。 */
  relatedTopics?: string[];
  /** 重複候補の topicId（将来用）。 */
  duplicateCandidates?: string[];
}

/** 日次レポートを「カード分離できる構造」に解析した結果。topics が空なら従来表示へ fallback。 */
export interface StructuredResearch {
  conclusion: string;   // 今日の結論
  topics: ResearchTopic[];
  todos: string[];      // 今日のToDo候補
  pending: string[];    // 保留・未確認
}

/** 全 Research 横断で 1 Topic を出自（カテゴリ・日付）付きで扱うための参照。 */
export interface TopicRef {
  topic: ResearchTopic;
  category: ResearchCategory;
  date: string;        // 日次ファイルの日付 YYYY-MM-DD
  docTitle: string;
}

/** ToDo 化候補を Progress 連携用に正規化した形（生成準備のみ・連携はしない）。 */
export interface TodoCandidate {
  title: string;
  priority: Priority;
  sourceTopicId: string;
  sourceDate: string;
  sourceCategory: ResearchCategory;
  summary: string;
  nextActions: string[];
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
  /** 新フォーマット解析結果。topics があれば detail page はカード表示する。 */
  structured?: StructuredResearch;
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
