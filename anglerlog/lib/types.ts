// AnglerLog ドメイン型定義（local-first / 外部DBなし）

/** 天候（静的選択肢） */
export type Weather =
  | "sunny"
  | "cloudy"
  | "rainy"
  | "windy"
  | "snowy";

export const WEATHER_LABELS: Record<Weather, string> = {
  sunny: "晴れ",
  cloudy: "曇り",
  rainy: "雨",
  windy: "強風",
  snowy: "雪",
};

/**
 * 匿名化された釣行場所。
 * 精密な座標は保持せず、粗い情報のみ永続化する。
 * - areaLabel: ユーザーが入力したエリア名（県・釣り場名など。住所番地は想定しない）
 * - coarseLat / coarseLng: 入力された座標を 0.1 度（約 11km）に丸めた値（任意）
 */
export interface AnonymizedLocation {
  areaLabel: string;
  coarseLat?: number;
  coarseLng?: number;
}

/** 1 匹の釣果記録 */
export interface CatchRecord {
  id: string;
  /** 釣行日（YYYY-MM-DD） */
  date: string;
  /** 魚種 ID（fish-species.ts の static JSON を参照） */
  speciesId: string;
  /** サイズ cm（任意） */
  sizeCm?: number;
  /** 重量 g（任意） */
  weightG?: number;
  /** 天候 */
  weather?: Weather;
  /** 仕掛け・タックル（自由記述） */
  rig?: string;
  /** 写真（DataURL / base64。localStorage に直接保存） */
  photoDataUrl?: string;
  /** 匿名化済みの場所 */
  location?: AnonymizedLocation;
  /** メモ */
  memo?: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
}

/** 魚種マスタ（静的 JSON） */
export interface FishSpecies {
  id: string;
  name: string;
  /** 分類（海水/淡水など、フィルタ用） */
  category: "saltwater" | "freshwater";
  /** アイコン用絵文字 */
  emoji: string;
}
