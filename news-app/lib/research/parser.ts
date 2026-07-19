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
  ReferenceLink,
  ResearchTopic,
  StructuredResearch,
  ConfidenceLevel,
  SourceType,
  AffectsProjects,
} from "./types";

/** タイトル等から URL 安全な slug を生成する（将来 /research/topic/[id] 用）。 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** topic-id が無いトピック用の安定 ID を date + index + title から作る。 */
export function generateTopicId(
  date: string,
  index: number,
  title: string
): string {
  const base = slugify(title);
  return base ? `${date}-${index}-${base}` : `${date}-${index}`;
}

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

  const utilization = extractUtilization(sections);
  const paperInfo = extractPaperInfo(sections, category);
  const priority = pickPriority(raw, paperInfo);
  const structured = extractStructured(sections, date);
  const summary = structured?.conclusion
    ? truncate(stripMarkdown(firstNonEmptyLine(structured.conclusion) ?? ""), 110)
    : pickSummary(sections);

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
    structured,
    priority,
    partial,
    hasError,
  };
}

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
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

/* ── 新フォーマット（トピックカード）解析 ───────────────────────── */

/**
 * 「## 今日の結論 / ## 記事本文 / ## トピック一覧 / ## 今日のToDo候補 / ## 保留・未確認」を構造化する。
 * トピックが 1 件も取れず記事本文も無い場合は undefined を返し、呼び出し側で従来表示に fallback する。
 * （記事本文があればトピック 0 件でも「1日1ページの記事」レイアウトで表示できるよう構造化を返す）
 */
function extractStructured(
  sections: ResearchSection[],
  date: string
): StructuredResearch | undefined {
  const topicSection = sections.find((s) => s.heading.includes("トピック"));
  const topics = topicSection ? parseTopics(topicSection.body, date) : [];

  const conclusionSection = sections.find((s) => s.heading.includes("結論"));
  const articleSection = sections.find(isArticleBodySection);
  const articleBody = articleSection ? articleSection.body.trim() : "";
  if (topics.length === 0 && articleBody.length === 0) return undefined;

  const todoSection = sections.find(
    (s) => s.heading.includes("ToDo") || s.heading.includes("やること")
  );
  const pendingSection = sections.find(
    (s) => s.heading.includes("保留") || s.heading.includes("未確認")
  );

  const consumed = new Set<ResearchSection>(
    [
      topicSection,
      conclusionSection,
      articleSection,
      todoSection,
      pendingSection,
    ].filter((s): s is ResearchSection => s !== undefined)
  );
  const restMarkdown = sections
    .filter((s) => !consumed.has(s) && !s.heading.includes("取得状況"))
    .map((s) => `## ${s.heading}\n\n${s.body.trim()}`)
    .filter((block) => block.trim().length > 0)
    .join("\n\n");

  return {
    conclusion: conclusionSection ? conclusionSection.body.trim() : "",
    articleBody,
    topics,
    todos: bulletItemsOf(todoSection),
    pending: bulletItemsOf(pendingSection),
    restMarkdown,
  };
}

function isArticleBodySection(section: ResearchSection): boolean {
  const heading = section.heading.trim();
  return (
    heading.includes("記事本文") ||
    heading.includes("詳細記事") ||
    heading === "本文" ||
    /^article body$/i.test(heading)
  );
}

function bulletItemsOf(section?: ResearchSection): string[] {
  if (!section || !section.items) return [];
  return section.items.map((i) => stripMarkdown(i)).filter((i) => i.length > 0);
}

function parseTopics(body: string, date: string): ResearchTopic[] {
  const lines = body.split("\n");
  const topics: ResearchTopic[] = [];
  let heading: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (heading !== null) {
      topics.push(
        parseTopicBlock(heading, buf.join("\n"), topics.length + 1, date)
      );
    }
  };

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      heading = h3[1].trim();
      buf = [];
      continue;
    }
    if (heading !== null) buf.push(line);
  }
  flush();
  return topics;
}

type TopicFieldKey =
  | "topicId"
  | "summaryTlDr"
  | "kind"
  | "importance"
  | "confidence"
  | "tags"
  | "summary"
  | "evidence"
  | "references"
  | "monetizationImpact"
  | "affectsProjects"
  | "nextActions"
  | "todoCandidate"
  | "updatedAt"
  | "timelineKey"
  | "duplicateKey"
  | "similarityHints"
  | "sourceDate"
  | "relatedTopics"
  | "duplicateCandidates";

type TopicFields = Record<TopicFieldKey, string[]>;

/** ラベル文字列（日本語/英語）→ 内部フィールドキー。長い別名を優先マッチさせる。 */
const FIELD_LABELS: Record<string, TopicFieldKey> = {
  "topic-id": "topicId",
  topicid: "topicId",
  "topic id": "topicId",
  "tl;dr": "summaryTlDr",
  tldr: "summaryTlDr",
  要約tldr: "summaryTlDr",
  種別: "kind",
  カテゴリ: "kind",
  category: "kind",
  重要度: "importance",
  importance: "importance",
  確度: "confidence",
  信頼度: "confidence",
  confidence: "confidence",
  タグ: "tags",
  tags: "tags",
  要約: "summary",
  summary: "summary",
  根拠: "evidence",
  evidence: "evidence",
  参考url: "references",
  参考リンク: "references",
  参考: "references",
  references: "references",
  収益化への示唆: "monetizationImpact",
  収益化インパクト: "monetizationImpact",
  収益化: "monetizationImpact",
  monetization: "monetizationImpact",
  既存pjへの影響: "affectsProjects",
  既存プロジェクトへの影響: "affectsProjects",
  影響pj: "affectsProjects",
  affectsprojects: "affectsProjects",
  次アクション: "nextActions",
  アクション: "nextActions",
  nextactions: "nextActions",
  todo化: "todoCandidate",
  "todo化候補": "todoCandidate",
  todocandidate: "todoCandidate",
  更新日時: "updatedAt",
  更新日: "updatedAt",
  updatedat: "updatedAt",
  timelinekey: "timelineKey",
  "timeline-key": "timelineKey",
  timeline: "timelineKey",
  タイムライン: "timelineKey",
  duplicatekey: "duplicateKey",
  "duplicate-key": "duplicateKey",
  重複キー: "duplicateKey",
  similarityhints: "similarityHints",
  "similarity-hints": "similarityHints",
  類似ヒント: "similarityHints",
  類似: "similarityHints",
  sourcedate: "sourceDate",
  "source-date": "sourceDate",
  情報日付: "sourceDate",
  情報日: "sourceDate",
  出典日: "sourceDate",
  relatedtopics: "relatedTopics",
  "related-topics": "relatedTopics",
  関連トピック: "relatedTopics",
  duplicatecandidates: "duplicateCandidates",
  "duplicate-candidates": "duplicateCandidates",
  重複候補: "duplicateCandidates",
};

// 行頭の "- " は任意（topic-id / TL;DR はダッシュ無しで書かれることがある）。
const FIELD_LABEL_RE = new RegExp(
  "^\\s*(?:[-*]\\s*)?(" +
    Object.keys(FIELD_LABELS)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join("|") +
    ")\\s*[:：]\\s*(.*)$",
  "i"
);

const EMPTY_FIELDS = (): TopicFields => ({
  topicId: [],
  summaryTlDr: [],
  kind: [],
  importance: [],
  confidence: [],
  tags: [],
  summary: [],
  evidence: [],
  references: [],
  monetizationImpact: [],
  affectsProjects: [],
  nextActions: [],
  todoCandidate: [],
  updatedAt: [],
  timelineKey: [],
  duplicateKey: [],
  similarityHints: [],
  sourceDate: [],
  relatedTopics: [],
  duplicateCandidates: [],
});

function parseTopicBlock(
  heading: string,
  body: string,
  index: number,
  date: string
): ResearchTopic {
  const fields = EMPTY_FIELDS();
  let current: TopicFieldKey | null = null;

  for (const rawLine of body.split("\n")) {
    const labeled = rawLine.match(FIELD_LABEL_RE);
    if (labeled) {
      current = FIELD_LABELS[labeled[1].toLowerCase()];
      const inline = labeled[2].trim();
      // affectsProjects は入れ子構造を保つため生行を貯める
      if (inline) fields[current].push(inline);
      continue;
    }
    if (!current) continue;
    if (current === "affectsProjects") {
      // ネスト（- Progress: / 二重インデント）解析のため生行を保持
      if (rawLine.trim()) fields.affectsProjects.push(rawLine);
      continue;
    }
    const bullet = rawLine.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      const v = bullet[1].trim();
      if (v) fields[current].push(v);
      continue;
    }
    const text = rawLine.trim();
    if (text) fields[current].push(text);
  }

  const title =
    heading.replace(/^(?:Topic|トピック)\s*\d*\s*[:：]\s*/i, "").trim() ||
    heading;

  const topicId =
    cleanScalar(fields.topicId) || generateTopicId(date, index, title);

  return {
    topicId,
    index,
    title,
    kind: pickKind(fields.kind),
    importance: pickTopicPriority(fields.importance),
    confidence: parseConfidence(cleanScalar(fields.confidence)),
    summaryTlDr: cleanScalar(fields.summaryTlDr) || undefined,
    summary: fields.summary.map(stripMarkdown),
    evidence: fields.evidence.map(stripMarkdown),
    references: parseReferences(fields.references),
    monetizationImpact: fields.monetizationImpact.map(stripMarkdown),
    affectsProjects: parseAffectsProjects(fields.affectsProjects),
    nextActions: fields.nextActions.map(stripMarkdown),
    todoCandidate: parseBool(cleanScalar(fields.todoCandidate)),
    tags: parseTags(fields.tags),
    updatedAt: cleanScalar(fields.updatedAt) || undefined,
    timelineKey: cleanScalar(fields.timelineKey) || undefined,
    duplicateKey: cleanScalar(fields.duplicateKey) || undefined,
    similarityHints: fields.similarityHints.length
      ? fields.similarityHints.map(stripMarkdown)
      : undefined,
    sourceDate: parseSourceDate(cleanScalar(fields.sourceDate)) || undefined,
    relatedTopics: fields.relatedTopics.length
      ? fields.relatedTopics.map((s) => stripMarkdown(s))
      : undefined,
    duplicateCandidates: fields.duplicateCandidates.length
      ? fields.duplicateCandidates.map((s) => stripMarkdown(s))
      : undefined,
  };
}

/** sourceDate から YYYY-MM-DD を取り出す。ISO や日本語表記でも先頭の日付部分を拾う。 */
function parseSourceDate(value: string): string {
  if (!value) return "";
  const iso = value.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const jp = value.match(/(\d{4})[/年.](\d{1,2})[/月.](\d{1,2})/);
  if (jp) {
    const mm = jp[2].padStart(2, "0");
    const dd = jp[3].padStart(2, "0");
    return `${jp[1]}-${mm}-${dd}`;
  }
  return "";
}

function cleanScalar(values: string[]): string {
  return stripMarkdown((values[0] ?? "").trim());
}

function pickKind(values: string[]): string {
  const raw = (values[0] ?? "").trim();
  // テンプレ未記入（"市場 / 競合 / ..."）や空欄は general 扱い
  if (!raw || raw.includes("/")) return "general";
  return raw;
}

function pickTopicPriority(values: string[]): Priority {
  const raw = (values[0] ?? "").toUpperCase();
  const m = raw.match(/[SABC]/);
  return (m ? m[0] : "B") as Priority;
}

function parseConfidence(value: string): ConfidenceLevel | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (/高|high|h\b/.test(v)) return "high";
  if (/低|low|l\b/.test(v)) return "low";
  if (/中|medium|mid|m\b/.test(v)) return "medium";
  return undefined;
}

function parseBool(value: string): boolean {
  return /^(yes|y|true|はい|する|済|✓|◯|〇|○)$/i.test(value.trim());
}

function parseTags(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    // "#a #b" のような同一行複数タグも分割
    for (const tok of v.split(/[\s,、]+/)) {
      const t = tok.replace(/^#/, "").trim();
      if (t) out.push(t);
    }
  }
  return Array.from(new Set(out));
}

const PROJECT_KEYS: { re: RegExp; key: keyof AffectsProjects }[] = [
  { re: /progress|進捗/i, key: "progress" },
  { re: /news\s*-?\s*app|newsapp|ニュース/i, key: "newsApp" },
  { re: /mahjong|麻雀/i, key: "mahjong" },
  { re: /shogi|将棋/i, key: "shogi" },
  { re: /scrape\s*-?\s*lab|scrapelab|スクレイプ/i, key: "scrapeLab" },
  { re: /other|その他|他/i, key: "other" },
];

function parseAffectsProjects(rawLines: string[]): AffectsProjects | undefined {
  if (rawLines.length === 0) return undefined;
  const out: AffectsProjects = {};
  let currentKey: keyof AffectsProjects | null = null;

  for (const rawLine of rawLines) {
    const bullet = rawLine.match(/^\s*[-*]\s+(.*)$/);
    if (!bullet) {
      const t = rawLine.trim();
      if (t && currentKey) pushTo(out, currentKey, stripMarkdown(t));
      continue;
    }
    const content = bullet[1];
    const headMatch = content.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (headMatch) {
      const project = PROJECT_KEYS.find((p) => p.re.test(headMatch[1].trim()));
      if (project) {
        currentKey = project.key;
        const inline = headMatch[2].trim();
        if (inline) pushTo(out, currentKey, stripMarkdown(inline));
        continue;
      }
    }
    // 見出しでない箇条書きは現在のプロジェクトの項目
    if (currentKey) {
      const v = content.trim();
      if (v) pushTo(out, currentKey, stripMarkdown(v));
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function pushTo(obj: AffectsProjects, key: keyof AffectsProjects, value: string) {
  if (!value) return;
  (obj[key] ??= []).push(value);
}

function parseReferences(items: string[]): ReferenceLink[] {
  const out: ReferenceLink[] = [];
  for (const raw of items) {
    // 1) Markdown リンク [label](url)
    const md = raw.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    if (md) {
      const url = md[2].trim();
      const label = md[1].trim() || domainOf(url);
      out.push({ url, label, sourceType: inferSourceType(label, url) });
      continue;
    }
    // 2) [label] url 形式（ブラケットラベル + 素URL）
    const bracket = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (bracket) {
      const label = bracket[1].trim();
      const rest = bracket[2];
      const u = rest.match(/https?:\/\/[^\s)]+/);
      if (u) {
        const url = u[0].replace(/[.,。、)]+$/, "");
        out.push({ url, label: label || domainOf(url), sourceType: inferSourceType(label, url) });
        continue;
      }
      // URL が無いブラケットラベルのみ
      out.push({ url: "", label });
      continue;
    }
    // 3) 素URL（前後にラベルテキストがあれば拾う）
    const urlMatch = raw.match(/https?:\/\/[^\s)]+/);
    if (!urlMatch || urlMatch.index === undefined) {
      const t = stripMarkdown(raw);
      if (t) out.push({ url: "", label: t });
      continue;
    }
    const url = urlMatch[0].replace(/[.,。、)]+$/, "");
    const before = raw.slice(0, urlMatch.index).replace(/[-—:：|]\s*$/, "").trim();
    const after = raw
      .slice(urlMatch.index + urlMatch[0].length)
      .replace(/^[\s\-—:：|]+/, "")
      .trim();
    const label = before || after || domainOf(url);
    out.push({ url, label, sourceType: inferSourceType(label, url) });
  }
  return out;
}

const SOURCE_TYPE_WORDS: SourceType[] = [
  "official",
  "reddit",
  "github",
  "ranking",
  "paper",
  "social",
  "news",
  "other",
];

function inferSourceType(label: string, url: string): SourceType | undefined {
  const l = label.toLowerCase().trim();
  // ラベルが sourceType そのものを名指ししている場合は最優先
  const explicit = SOURCE_TYPE_WORDS.find((w) => l === w);
  if (explicit) return explicit;

  const hay = (l + " " + url.toLowerCase()).trim();
  if (/reddit/.test(hay)) return "reddit";
  if (/github\.com|gist\.github/.test(hay)) return "github";
  if (/arxiv|\bpaper\b|論文|openreview/.test(hay)) return "paper";
  if (
    /apps\.apple\.com|play\.google\.com|appbrain|charts|ranking|ランキング|top-?free|top_free|hunted\.space/.test(
      hay
    )
  )
    return "ranking";
  if (/tiktok|lemon8|instagram|x\.com|twitter|youtube|youtu\.be|threads|社交|social/.test(hay))
    return "social";
  if (
    /blog\.google|developers\.google|android-developers|googleblog|openai\.com|anthropic\.com|公式|official|developer/.test(
      hay
    )
  )
    return "official";
  if (/producthunt|techradar|globenewswire|theverge|techcrunch|reuters|bloomberg|news|ニュース/.test(hay))
    return "news";
  return "other";
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
