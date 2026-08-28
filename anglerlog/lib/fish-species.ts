import type { FishSpecies } from "./types";

/**
 * 魚種マスタ（静的 JSON）。
 * 外部 API を使わず、アプリ内に同梱する。MVP 用の代表的な対象魚。
 */
export const FISH_SPECIES: FishSpecies[] = [
  { id: "aji", name: "アジ", category: "saltwater", emoji: "🐟" },
  { id: "saba", name: "サバ", category: "saltwater", emoji: "🐟" },
  { id: "iwashi", name: "イワシ", category: "saltwater", emoji: "🐟" },
  { id: "kisu", name: "キス", category: "saltwater", emoji: "🐟" },
  { id: "mebaru", name: "メバル", category: "saltwater", emoji: "🐡" },
  { id: "kasago", name: "カサゴ", category: "saltwater", emoji: "🐡" },
  { id: "seabass", name: "シーバス（スズキ）", category: "saltwater", emoji: "🐠" },
  { id: "kurodai", name: "クロダイ", category: "saltwater", emoji: "🐠" },
  { id: "madai", name: "マダイ", category: "saltwater", emoji: "🐠" },
  { id: "hirame", name: "ヒラメ", category: "saltwater", emoji: "🐟" },
  { id: "aori-ika", name: "アオリイカ", category: "saltwater", emoji: "🦑" },
  { id: "tachiuo", name: "タチウオ", category: "saltwater", emoji: "🐟" },
  { id: "buri", name: "ブリ（青物）", category: "saltwater", emoji: "🐟" },
  { id: "ajuu", name: "アユ", category: "freshwater", emoji: "🐟" },
  { id: "yamame", name: "ヤマメ", category: "freshwater", emoji: "🐟" },
  { id: "iwana", name: "イワナ", category: "freshwater", emoji: "🐟" },
  { id: "nijimasu", name: "ニジマス", category: "freshwater", emoji: "🐟" },
  { id: "blackbass", name: "ブラックバス", category: "freshwater", emoji: "🐟" },
  { id: "herabuna", name: "ヘラブナ", category: "freshwater", emoji: "🐟" },
  { id: "wakasagi", name: "ワカサギ", category: "freshwater", emoji: "🐟" },
  { id: "other", name: "その他", category: "saltwater", emoji: "🎣" },
];

const SPECIES_BY_ID = new Map(FISH_SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): FishSpecies | undefined {
  return SPECIES_BY_ID.get(id);
}

export function speciesName(id: string): string {
  return SPECIES_BY_ID.get(id)?.name ?? id;
}

export function speciesEmoji(id: string): string {
  return SPECIES_BY_ID.get(id)?.emoji ?? "🎣";
}
