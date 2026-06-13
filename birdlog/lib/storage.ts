import type { Observation, ObservationInput } from "./types";

/**
 * localStorage ベースの永続化リポジトリ（local-first）。
 * 外部 DB・サーバー API を使わず、ブラウザ内に保存する（オフライン動作）。
 * SSR 中は window が無いため、すべてのアクセスをガードする。
 */
const STORAGE_KEY = "birdlog.observations.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadObservations(): Observation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Observation[];
  } catch {
    return [];
  }
}

function saveAll(records: Observation[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Create */
export function addObservation(input: ObservationInput): Observation[] {
  const records = loadObservations();
  const record: Observation = {
    ...input,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  records.push(record);
  saveAll(records);
  return records;
}

/** Update（編集）。対象が無い場合は変更せず返す。 */
export function updateObservation(
  id: string,
  input: ObservationInput
): Observation[] {
  const records = loadObservations().map((r) =>
    r.id === id
      ? { ...r, ...input, id: r.id, createdAt: r.createdAt, updatedAt: new Date().toISOString() }
      : r
  );
  saveAll(records);
  return records;
}

/** Delete */
export function deleteObservation(id: string): Observation[] {
  const records = loadObservations().filter((r) => r.id !== id);
  saveAll(records);
  return records;
}

export function clearAll(): void {
  saveAll([]);
}

export function generateId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
