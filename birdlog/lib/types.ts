// BirdLog ドメイン型定義（local-first / 外部DBなし / オフライン動作）

/**
 * 匿名化された目撃場所。
 * 精密な座標は保持せず、粗い情報のみ永続化する（秘密の観察スポット保護）。
 * - areaLabel: ユーザー入力のエリア名（公園・河川名など。住所番地は想定しない）
 * - coarseLat / coarseLng: 入力座標を 0.1 度（約 11km）に丸めた値（任意）
 */
export interface AnonymizedLocation {
  areaLabel: string;
  coarseLat?: number;
  coarseLng?: number;
}

/** 1 件の観察記録 */
export interface Observation {
  id: string;
  /** 観察日（YYYY-MM-DD） */
  date: string;
  /** 観察時刻（HH:mm・任意） */
  time?: string;
  /** 種 ID（birds.ts の static JSON を参照） */
  speciesId: string;
  /** 観察個体数（任意・既定 1） */
  count?: number;
  /** 写真（DataURL / base64。localStorage に直接保存） */
  photoDataUrl?: string;
  /** 匿名化済みの場所 */
  location?: AnonymizedLocation;
  /** メモ */
  memo?: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 更新日時（ISO 8601・編集時に更新） */
  updatedAt?: string;
}

/** 観察記録の入力（CRUD の Create / Update 共通の編集可能フィールド） */
export type ObservationInput = Omit<
  Observation,
  "id" | "createdAt" | "updatedAt"
>;

/** 野鳥マスタ（静的 JSON） */
export interface BirdSpecies {
  id: string;
  /** 和名 */
  name: string;
  /** 英名 */
  nameEn: string;
  /** 科（和名） */
  family: string;
  /** 生息環境グループ（フィルタ・図鑑の章分け用） */
  habitat: "garden" | "forest" | "water" | "raptor" | "field";
  /** アイコン用絵文字 */
  emoji: string;
}

export const HABITAT_LABELS: Record<BirdSpecies["habitat"], string> = {
  garden: "市街地・庭",
  forest: "山地・林",
  water: "水辺",
  raptor: "猛禽",
  field: "草地・農耕地",
};
