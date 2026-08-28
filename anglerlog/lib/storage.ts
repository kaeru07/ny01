import type { CatchRecord } from "./types";

/**
 * localStorage ベースの永続化リポジトリ（local-first）。
 * 外部 DB・サーバー API を使わず、ブラウザ内に保存する。
 * SSR 中は window が無いため、すべてのアクセスをガードする。
 */
const STORAGE_KEY = "anglerlog.catches.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadCatches(): CatchRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CatchRecord[];
  } catch {
    return [];
  }
}

function saveAll(records: CatchRecord[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function addCatch(record: CatchRecord): CatchRecord[] {
  const records = loadCatches();
  records.push(record);
  saveAll(records);
  return records;
}

export function deleteCatch(id: string): CatchRecord[] {
  const records = loadCatches().filter((r) => r.id !== id);
  saveAll(records);
  return records;
}

export function clearAll(): void {
  saveAll([]);
}

export function generateId(): string {
  // crypto.randomUUID はモダンブラウザで利用可。フォールバックも用意。
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
