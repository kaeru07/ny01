/**
 * Hermes/Codex が生成する Vault Markdown を構造化する parser。
 * テンプレ準拠を仮定するが、欠けていてもクラッシュしない。
 */

import {
  ResearchCategory,
  ResearchDoc,
  ResearchSection,
  UtilizationReview,
  PaperInfo,
  Priority,
} from "./types";

const PRIORITY_RE = /(?:priority|追跡優先度|重要度)\s*[:：]\s*([SABCsabc])/;

export function parseDoc(
  category: ResearchCategory,
  date: string,
  filename: string,
  relativePath: string,
  raw: string
): ResearchDoc {
  if (!raw || !raw.trim()) {
    return {
      category,
      date,
      filename,
      relativePath,
      title: filename.replace(/\.md$/, ""),
      summary: "",
      sections: [],
      raw: raw ?? "",
      partial: false,
      hasError: false,
    };
  }

  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, "");

  const sections = splitSections(raw);

  const partial = /status\s*[:：]\s*partial/i.test(raw);
  const hasError =
    raw.includes("## 実行エラー") || raw.startsWith("# (fallback)");

  const summary = pickSummary(sections);
  const utilization = extractUtilization(sections);
  const paperInfo = extractPaperInfo(sections, category);
  const priority = pickPriority(raw, paperInfo);

  return {
    category,
    date,
    filename,
    relativePath,
    title,
    summary,
    sections,
    raw,
    utilization,
    paperInfo,
    priority,
    partial,
    hasError,
  };
}

/** 「## ...」と「### ...」を区別して section に切る。H3 は H2 の body にそのまま含める。 */
function splitSections(raw: string): ResearchSection[] {
  const lines = raw.split("\n");
  const sections: ResearchSection[] = [];
  let current: ResearchSection | null = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) sections.push(finalize(current));
      current = { heading: h2[1].trim(), level: 2, body: "" };
      continue;
    }
    if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(finalize(current));
  return sections;
}

function finalize(section: ResearchSection): ResearchSection {
  const items: string[] = [];
  for (const ln of section.body.split("\n")) {
    const m = ln.match(/^(?:-|\*|\d+\.)\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return {
    ...section,
    body: section.body.trim(),
    items: items.length ? items : undefined,
  };
}

function pickSummary(sections: ResearchSection[]): string {
  for (const sec of sections) {
    if (sec.heading.includes("品質チェック") || sec.heading.includes("取得状況") || sec.heading.includes("実行エラー")) {
      continue;
    }
    if (sec.items && sec.items.length > 0) {
      return truncate(stripMarkdown(sec.items[0]), 110);
    }
    const firstLine = sec.body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (firstLine) return truncate(stripMarkdown(firstLine), 110);
  }
  return "";
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function findSubBody(rawBody: string, h3: string): string | undefined {
  const re = new RegExp(
    "^###\\s+" + escapeRegex(h3) + "\\s*\\n([\\s\\S]*?)(?=^###\\s+|^##\\s+|\\Z)",
    "m"
  );
  const m = rawBody.match(re);
  if (!m) return undefined;
  const body = m[1].trim();
  return body || undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSection(sections: ResearchSection[], headingContains: string): ResearchSection | undefined {
  return sections.find((s) => s.heading.includes(headingContains));
}

function extractUtilization(sections: ResearchSection[]): UtilizationReview | undefined {
  const sec = findSection(sections, "活用レビュー");
  if (!sec) return undefined;
  const review: UtilizationReview = {
    useCase: findSubBody(sec.body, "この情報の使い道"),
    monetization: findSubBody(sec.body, "収益化への使い方"),
    applyToExisting: findSubBody(sec.body, "既存アプリ"),
    newAppIdea: findSubBody(sec.body, "新規アプリ案"),
    snsRepurpose: findSubBody(sec.body, "SNS"),
    doNow: findSubBody(sec.body, "すぐやる"),
    deferReason: findSubBody(sec.body, "まだ保留"),
    nextCheck: findSubBody(sec.body, "次に確認"),
  };
  const anyFilled = Object.values(review).some((v) => v && v.length > 0);
  return anyFilled ? review : undefined;
}

function extractPaperInfo(
  sections: ResearchSection[],
  category: ResearchCategory
): PaperInfo | undefined {
  if (category !== "papers") return undefined;
  const merged = sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
  const get = (h3: string) => findSubBody(merged, h3);
  const info: PaperInfo = {
    title: get("論文タイトル"),
    url: get("URL"),
    org: get("発表元"),
    novelty: get("何が新しいか"),
    indieImpact: get("個人開発への影響"),
    factoryImpact: get("AI開発工場への影響"),
    applicability: get("既存アプリへの応用候補"),
    monetizationRelation: get("収益化との関係"),
    implementationIdea: get("実装に使えそうなアイデア"),
  };
  const prioRaw = get("追跡優先度") ?? get("優先度");
  if (prioRaw) {
    const m = prioRaw.match(/[SABCsabc]/);
    if (m) info.priority = m[0].toUpperCase() as Priority;
  }
  const anyFilled = Object.values(info).some((v) => v && String(v).length > 0);
  return anyFilled ? info : undefined;
}

function pickPriority(raw: string, paperInfo?: PaperInfo): Priority | undefined {
  if (paperInfo?.priority) return paperInfo.priority;
  const m = raw.match(PRIORITY_RE);
  if (m) return m[1].toUpperCase() as Priority;
  return undefined;
}
