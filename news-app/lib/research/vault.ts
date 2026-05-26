/**
 * Vault (obsidian-vault) を server side で読む。
 * - 原本は VAULT_RESEARCH_ROOT （未設定時は /root/company/obsidian-vault/06_research）
 * - ファイルが存在しない / 読み取り権限が無い場合も空配列で graceful degrade する
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  CATEGORY_ORDER,
  MonetizationHintEntry,
  ResearchCategory,
  ResearchDoc,
  UtilizationEntry,
} from "./types";
import { parseDoc } from "./parser";

export const VAULT_RESEARCH_ROOT =
  process.env.VAULT_RESEARCH_ROOT ??
  "/root/company/obsidian-vault/06_research";

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
    out.push({
      category: cat,
      count: docs.length,
      latestDate: docs[0]?.date,
      partial: docs[0]?.partial,
      hasError: docs[0]?.hasError,
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
