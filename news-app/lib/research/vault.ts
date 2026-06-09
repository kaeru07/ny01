/**
 * Vault (obsidian-vault) を server side で読む。
 * - 原本は VAULT_RESEARCH_ROOT （未設定時は /root/company/obsidian-vault/06_research）
 * - ファイルが存在しない / 読み取り権限が無い場合も空配列で graceful degrade する
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  CATEGORY_ORDER,
  MonetizationHintEntry,
  ResearchCategory,
  ResearchDoc,
  TopicRef,
  UtilizationEntry,
} from "./types";
import { parseDoc } from "./parser";
import { summarizeDocTopics, sortByImportanceThenDate } from "./summary";

/**
 * 参照先の決定（優先順）:
 *   1. 環境変数 VAULT_RESEARCH_ROOT が設定されていればそれを使う（明示指定）
 *   2. VPS / ローカルで Vault 本体 (obsidian-vault/06_research) が存在すればそれを使う
 *      → 日次更新が即反映される（content/research へのコピー待ちが不要）
 *   3. それも無ければ news-app 同梱の content/research（Vercel 等、Vault 本体が無い環境）
 *
 * 旧実装は 1→3 のみで、Vault 本体があっても常に同梱 copy を読んでいたため、
 * Vault 側の日次（例: 2026-06-09）が反映されず最新日付が古いままになる不具合があった。
 */
export const VAULT_LIVE_ROOT = "/root/company/obsidian-vault/06_research";

function resolveResearchRoot(): string {
  const env = process.env.VAULT_RESEARCH_ROOT;
  if (env && env.trim().length > 0) return env;
  try {
    if (fsSync.existsSync(VAULT_LIVE_ROOT)) return VAULT_LIVE_ROOT;
  } catch {
    // existsSync が落ちる環境では同梱 copy にフォールバック
  }
  return path.join(process.cwd(), "content/research");
}

export const VAULT_RESEARCH_ROOT = resolveResearchRoot();

/** 参照中ルートの種別（ステータス表示・調査用）。 */
export type ResearchRootKind = "env" | "vault" | "bundled";

export function getResearchRootKind(): ResearchRootKind {
  if (process.env.VAULT_RESEARCH_ROOT?.trim()) return "env";
  if (VAULT_RESEARCH_ROOT === VAULT_LIVE_ROOT) return "vault";
  return "bundled";
}

const CATEGORY_SUBDIR: Record<ResearchCategory, string | null> = {
  market: "daily-market-research",
  news: "daily-ai-news",
  tools: "daily-ai-tools",
  method: "market-research-method-review",
  papers: "daily-ai-papers",
  monetization: null,
  utilization: null,
};

const FILE_DATE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

async function safeReadFile(p: string): Promise<string> {
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return "";
  }
}

async function safeReadDir(p: string): Promise<string[]> {
  try {
    return await fs.readdir(p);
  } catch {
    return [];
  }
}

/** 1 カテゴリの日次ファイルを新しい順で返す。派生カテゴリ・空ディレクトリでも安全に [] を返す。 */
export async function listResearchDocs(
  category: ResearchCategory
): Promise<ResearchDoc[]> {
  const subdir = CATEGORY_SUBDIR[category];
  if (!subdir) return [];
  const dir = path.join(VAULT_RESEARCH_ROOT, subdir);
  const files = await safeReadDir(dir);
  const mdFiles = files
    .filter((f) => FILE_DATE_RE.test(f))
    .sort()
    .reverse();
  const docs = await Promise.all(
    mdFiles.map(async (filename) => {
      const date = filename.replace(/\.md$/, "");
      const raw = await safeReadFile(path.join(dir, filename));
      return parseDoc(category, date, filename, `${subdir}/${filename}`, raw);
    })
  );
  return docs;
}

/** 単体取得（detail page 用）。見つからなければ null。 */
export async function getResearchDoc(
  category: ResearchCategory,
  date: string
): Promise<ResearchDoc | null> {
  const subdir = CATEGORY_SUBDIR[category];
  if (!subdir) return null;
  if (!FILE_DATE_RE.test(`${date}.md`)) return null;
  const filename = `${date}.md`;
  const filepath = path.join(VAULT_RESEARCH_ROOT, subdir, filename);
  const raw = await safeReadFile(filepath);
  if (!raw) return null;
  return parseDoc(category, date, filename, `${subdir}/${filename}`, raw);
}

export async function readMarketResearchIndex(): Promise<string> {
  return safeReadFile(
    path.join(VAULT_RESEARCH_ROOT, "market-research-index.md")
  );
}

export async function readMarketResearchMethod(): Promise<string> {
  return safeReadFile(
    path.join(VAULT_RESEARCH_ROOT, "market-research-method.md")
  );
}

export async function readPaperWatchlist(): Promise<string> {
  return safeReadFile(path.join(VAULT_RESEARCH_ROOT, "paper-watchlist.md"));
}

/** market-research-index.md の「## 履歴」配下の最初の N 行を返す。 */
export async function readIndexHistory(maxRows = 7): Promise<string[]> {
  const raw = await readMarketResearchIndex();
  if (!raw) return [];
  const m = raw.match(/^##\s+履歴\s*\n([\s\S]*)$/m);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .slice(0, maxRows);
}

/** カテゴリごとのファイル数と最新日付を集計（overview 用）。 */
export interface CategorySummary {
  category: ResearchCategory;
  count: number;
  latestDate?: string;
  partial?: boolean;
  hasError?: boolean;
  /** 最新日次のトピック統計（新フォーマットのみ）。 */
  latestTopicCount?: number;
  latestSCount?: number;
  latestACount?: number;
  latestTodoCount?: number;
  latestStaleCount?: number;
  latestTopTags?: string[];
  latestTlDr?: string;
}

export async function summarizeCategories(): Promise<CategorySummary[]> {
  const out: CategorySummary[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (cat === "monetization") {
      const docs = await listResearchDocs("market");
      const hits = docs.filter((d) => d.sections.some((s) => s.heading.includes("収益化ヒント")));
      out.push({
        category: cat,
        count: hits.length,
        latestDate: hits[0]?.date,
      });
      continue;
    }
    if (cat === "utilization") {
      const all = (
        await Promise.all([
          listResearchDocs("market"),
          listResearchDocs("news"),
          listResearchDocs("tools"),
          listResearchDocs("method"),
        ])
      ).flat();
      const hits = all.filter((d) => d.utilization);
      out.push({
        category: cat,
        count: hits.length,
        latestDate: hits[0]?.date,
      });
      continue;
    }
    const docs = await listResearchDocs(cat);
    const latest = docs[0];
    const stats = latest ? summarizeDocTopics(latest) : null;
    out.push({
      category: cat,
      count: docs.length,
      latestDate: latest?.date,
      partial: latest?.partial,
      hasError: latest?.hasError,
      latestTopicCount: stats?.topicCount,
      latestSCount: stats?.sCount,
      latestACount: stats?.aCount,
      latestTodoCount: stats?.todoCount,
      latestStaleCount: stats?.staleCount,
      latestTopTags: stats?.topTags,
      latestTlDr: stats?.tlDr,
    });
  }
  return out;
}

/** 派生: daily-market-research から「収益化ヒント」セクションのアイテムを集約。 */
export async function aggregateMonetizationHints(): Promise<MonetizationHintEntry[]> {
  const docs = await listResearchDocs("market");
  const out: MonetizationHintEntry[] = [];
  for (const doc of docs) {
    const sec = doc.sections.find((s) => s.heading.includes("収益化ヒント"));
    if (!sec || !sec.items || sec.items.length === 0) continue;
    out.push({
      date: doc.date,
      sourceCategory: "market",
      items: sec.items,
      sourceDocPath: doc.relativePath,
    });
  }
  return out;
}

/* ── Topic 横断集計（topic / tag / timeline / todo ページ用） ───────── */

/** structured topics を持ちうるカテゴリ。 */
const TOPIC_CATEGORIES: ResearchCategory[] = [
  "market",
  "news",
  "tools",
  "method",
  "papers",
];

/** 全カテゴリ・全日次の Topic を出自付きで集める。日付新しい順・doc 内 index 順。 */
export async function collectAllTopics(): Promise<TopicRef[]> {
  const perCat = await Promise.all(
    TOPIC_CATEGORIES.map((cat) => listResearchDocs(cat))
  );
  const refs: TopicRef[] = [];
  for (const docs of perCat) {
    for (const doc of docs) {
      if (!doc.structured) continue;
      for (const topic of doc.structured.topics) {
        refs.push({
          topic,
          category: doc.category,
          date: doc.date,
          docTitle: doc.title,
        });
      }
    }
  }
  // 日付新しい順、同日は index 昇順
  refs.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return a.topic.index - b.topic.index;
  });
  return refs;
}

/** topicId で 1 Topic を引く。重複時は最新日付を返す。 */
export async function getTopicById(id: string): Promise<TopicRef | null> {
  const all = await collectAllTopics();
  const hits = all.filter((r) => r.topic.topicId === id);
  if (hits.length === 0) return null;
  // collectAllTopics は日付降順なので先頭が最新
  return hits[0];
}

/** Topic のタイムライン束（timelineKey 優先、無ければ同一 topicId）を日付昇順で返す。 */
export async function getTimelineFor(ref: TopicRef): Promise<TopicRef[]> {
  const key = ref.topic.timelineKey ?? ref.topic.topicId;
  if (!key) return [];
  const all = await collectAllTopics();
  const group = all.filter(
    (r) => (r.topic.timelineKey ?? r.topic.topicId) === key
  );
  group.sort((a, b) => a.date.localeCompare(b.date));
  return group;
}

/** duplicateKey が一致する他 Topic（自分は除く）。 */
export async function getDuplicateCandidates(
  ref: TopicRef
): Promise<TopicRef[]> {
  const key = ref.topic.duplicateKey;
  if (!key) return [];
  const all = await collectAllTopics();
  return all.filter(
    (r) =>
      r.topic.duplicateKey === key &&
      !(r.date === ref.date && r.topic.topicId === ref.topic.topicId)
  );
}

/** tag（先頭 # は無視）に一致する Topic を重要度→日付順で返す。 */
export async function getTopicsByTag(tag: string): Promise<TopicRef[]> {
  const norm = tag.replace(/^#/, "").toLowerCase();
  const all = await collectAllTopics();
  const hits = all.filter((r) =>
    r.topic.tags.some((t) => t.toLowerCase() === norm)
  );
  return sortByImportanceThenDate(hits);
}

/** 全 Topic の tag を頻度集計（tag 一覧・index 用）。 */
export async function collectAllTags(): Promise<{ tag: string; count: number }[]> {
  const all = await collectAllTopics();
  const counts = new Map<string, number>();
  for (const r of all) {
    for (const t of r.topic.tags) {
      const k = t.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** todoCandidate な Topic を重要度→日付順で返す。 */
export async function collectTodoCandidateTopics(): Promise<TopicRef[]> {
  const all = await collectAllTopics();
  return sortByImportanceThenDate(all.filter((r) => r.topic.todoCandidate));
}

/* ── スキャンメタ（市場調査ビューのステータスバー用） ───────────────── */

export interface ResearchScanMeta {
  /** このスキャンを実行した時刻（ISO 8601, サーバー時刻） */
  scannedAt: string;
  /** 参照中のルートパス */
  root: string;
  /** ルート種別: env=環境変数 / vault=Vault本体 / bundled=同梱copy */
  rootKind: ResearchRootKind;
  /** 読み込んだ Markdown 件数（全カテゴリ合計） */
  totalDocs: number;
  /** 全カテゴリ横断のグローバル最新日付（YYYY-MM-DD） */
  latestDate?: string;
  /** partial と判定された日次の件数 */
  partialCount: number;
  /** 更新ステータス: empty=0件 / stale=最新が2日より古い / ok */
  status: "ok" | "stale" | "empty";
  /** 最新日付が何日前か（stale 判定の根拠） */
  latestAgeDays?: number;
}

/** 市場調査ビューのステータスバー用に、現在のスキャン状態を集計する。 */
export async function getResearchScanMeta(): Promise<ResearchScanMeta> {
  const cats: ResearchCategory[] = ["market", "news", "tools", "method", "papers"];
  const all = (await Promise.all(cats.map((c) => listResearchDocs(c)))).flat();
  const totalDocs = all.length;
  const dates = all.map((d) => d.date).sort();
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : undefined;
  const partialCount = all.filter((d) => d.partial).length;

  let status: ResearchScanMeta["status"] = "ok";
  let latestAgeDays: number | undefined;
  if (totalDocs === 0) {
    status = "empty";
  } else if (latestDate) {
    latestAgeDays = Math.floor(
      (Date.now() - new Date(`${latestDate}T00:00:00Z`).getTime()) / 86_400_000
    );
    if (latestAgeDays > 2) status = "stale";
  }

  return {
    scannedAt: new Date().toISOString(),
    root: VAULT_RESEARCH_ROOT,
    rootKind: getResearchRootKind(),
    totalDocs,
    latestDate,
    partialCount,
    status,
    latestAgeDays,
  };
}

/** 派生: 各日次から「活用レビュー」セクション抽出（現状はほぼ 0 件）。 */
export async function aggregateUtilization(): Promise<UtilizationEntry[]> {
  const all = await Promise.all([
    listResearchDocs("market"),
    listResearchDocs("news"),
    listResearchDocs("tools"),
    listResearchDocs("method"),
  ]);
  const out: UtilizationEntry[] = [];
  for (const docs of all) {
    for (const doc of docs) {
      if (!doc.utilization) continue;
      out.push({
        date: doc.date,
        sourceCategory: doc.category,
        utilization: doc.utilization,
        sourceTitle: doc.title,
        sourceDocPath: doc.relativePath,
      });
    }
  }
  // 新しい順
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}
