import type { CatchRecord } from "./types";
import { speciesName } from "./fish-species";

export interface SpeciesStat {
  speciesId: string;
  name: string;
  count: number;
  maxSizeCm?: number;
}

export interface MonthStat {
  /** YYYY-MM */
  month: string;
  count: number;
}

export interface PersonalRecord {
  speciesId: string;
  name: string;
  sizeCm: number;
  date: string;
  catchId: string;
}

/** 魚種別の釣果数・最大サイズ（多い順） */
export function statsBySpecies(records: CatchRecord[]): SpeciesStat[] {
  const map = new Map<string, SpeciesStat>();
  for (const r of records) {
    const cur =
      map.get(r.speciesId) ??
      ({
        speciesId: r.speciesId,
        name: speciesName(r.speciesId),
        count: 0,
        maxSizeCm: undefined,
      } as SpeciesStat);
    cur.count += 1;
    if (typeof r.sizeCm === "number") {
      cur.maxSizeCm =
        cur.maxSizeCm === undefined ? r.sizeCm : Math.max(cur.maxSizeCm, r.sizeCm);
    }
    map.set(r.speciesId, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** 月別の釣果数（新しい月順） */
export function statsByMonth(records: CatchRecord[]): MonthStat[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const month = (r.date || "").slice(0, 7);
    if (!month) continue;
    map.set(month, (map.get(month) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** 魚種ごとの自己記録（最大サイズ）。サイズ未入力は対象外。 */
export function personalRecords(records: CatchRecord[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const r of records) {
    if (typeof r.sizeCm !== "number") continue;
    const cur = best.get(r.speciesId);
    if (!cur || r.sizeCm > cur.sizeCm) {
      best.set(r.speciesId, {
        speciesId: r.speciesId,
        name: speciesName(r.speciesId),
        sizeCm: r.sizeCm,
        date: r.date,
        catchId: r.id,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.sizeCm - a.sizeCm);
}

export interface TotalsSummary {
  totalCatches: number;
  speciesCount: number;
  tripDays: number;
}

/** 全体サマリー。釣行日数はユニークな日付数。 */
export function totals(records: CatchRecord[]): TotalsSummary {
  const species = new Set(records.map((r) => r.speciesId));
  const days = new Set(records.map((r) => r.date).filter(Boolean));
  return {
    totalCatches: records.length,
    speciesCount: species.size,
    tripDays: days.size,
  };
}
