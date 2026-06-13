import type { Observation } from "./types";
import { birdName } from "./birds";

export interface SpeciesStat {
  speciesId: string;
  name: string;
  /** 観察回数（記録件数） */
  count: number;
  /** 観察個体数の合計 */
  individuals: number;
  /** 初観察日 */
  firstSeen: string;
}

export interface MonthStat {
  /** YYYY-MM */
  month: string;
  /** 観察記録件数 */
  count: number;
  /** その月に観察したユニーク種数 */
  speciesCount: number;
}

/** 1 件の観察個体数（未入力は 1 とみなす） */
function indiv(r: Observation): number {
  return typeof r.count === "number" && r.count > 0 ? r.count : 1;
}

/** 種別の観察回数・個体数（多い順） */
export function statsBySpecies(records: Observation[]): SpeciesStat[] {
  const map = new Map<string, SpeciesStat>();
  for (const r of records) {
    const cur =
      map.get(r.speciesId) ??
      ({
        speciesId: r.speciesId,
        name: birdName(r.speciesId),
        count: 0,
        individuals: 0,
        firstSeen: r.date,
      } as SpeciesStat);
    cur.count += 1;
    cur.individuals += indiv(r);
    if (r.date && r.date < cur.firstSeen) cur.firstSeen = r.date;
    map.set(r.speciesId, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** 月別の観察件数・種数（新しい月順） */
export function statsByMonth(records: Observation[]): MonthStat[] {
  const counts = new Map<string, number>();
  const speciesByMonth = new Map<string, Set<string>>();
  for (const r of records) {
    const month = (r.date || "").slice(0, 7);
    if (!month) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
    const set = speciesByMonth.get(month) ?? new Set<string>();
    set.add(r.speciesId);
    speciesByMonth.set(month, set);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({
      month,
      count,
      speciesCount: speciesByMonth.get(month)?.size ?? 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export interface TotalsSummary {
  totalObservations: number;
  speciesCount: number;
  observationDays: number;
  totalIndividuals: number;
}

/** 全体サマリー。観察日数はユニークな日付数。 */
export function totals(records: Observation[]): TotalsSummary {
  const species = new Set(records.map((r) => r.speciesId));
  const days = new Set(records.map((r) => r.date).filter(Boolean));
  const totalIndividuals = records.reduce((sum, r) => sum + indiv(r), 0);
  return {
    totalObservations: records.length,
    speciesCount: species.size,
    observationDays: days.size,
    totalIndividuals,
  };
}
