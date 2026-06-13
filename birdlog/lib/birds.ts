import type { BirdSpecies } from "./types";

/**
 * 野鳥マスタ（静的 JSON）。
 * 外部 API を使わず、アプリ内に同梱する（local-first / オフライン）。
 * 日本でよく見られる代表的な野鳥 60 種。和名 / 英名 / 科を保持する。
 */
export const BIRDS: BirdSpecies[] = [
  // --- 市街地・庭 ---
  { id: "suzume", name: "スズメ", nameEn: "Eurasian Tree Sparrow", family: "スズメ科", habitat: "garden", emoji: "🐦" },
  { id: "hashibutogarasu", name: "ハシブトガラス", nameEn: "Large-billed Crow", family: "カラス科", habitat: "garden", emoji: "🐦‍⬛" },
  { id: "hashibosogarasu", name: "ハシボソガラス", nameEn: "Carrion Crow", family: "カラス科", habitat: "garden", emoji: "🐦‍⬛" },
  { id: "hiyodori", name: "ヒヨドリ", nameEn: "Brown-eared Bulbul", family: "ヒヨドリ科", habitat: "garden", emoji: "🐦" },
  { id: "shijukara", name: "シジュウカラ", nameEn: "Japanese Tit", family: "シジュウカラ科", habitat: "garden", emoji: "🐦" },
  { id: "mejiro", name: "メジロ", nameEn: "Warbling White-eye", family: "メジロ科", habitat: "garden", emoji: "🐦" },
  { id: "mukudori", name: "ムクドリ", nameEn: "White-cheeked Starling", family: "ムクドリ科", habitat: "garden", emoji: "🐦" },
  { id: "kijibato", name: "キジバト", nameEn: "Oriental Turtle Dove", family: "ハト科", habitat: "garden", emoji: "🕊️" },
  { id: "dobato", name: "ドバト（カワラバト）", nameEn: "Rock Dove", family: "ハト科", habitat: "garden", emoji: "🕊️" },
  { id: "tsubame", name: "ツバメ", nameEn: "Barn Swallow", family: "ツバメ科", habitat: "garden", emoji: "🐦" },
  { id: "hakusekirei", name: "ハクセキレイ", nameEn: "White Wagtail", family: "セキレイ科", habitat: "garden", emoji: "🐦" },
  { id: "segurosekirei", name: "セグロセキレイ", nameEn: "Japanese Wagtail", family: "セキレイ科", habitat: "water", emoji: "🐦" },
  { id: "kisekirei", name: "キセキレイ", nameEn: "Grey Wagtail", family: "セキレイ科", habitat: "water", emoji: "🐦" },
  { id: "jobitaki", name: "ジョウビタキ", nameEn: "Daurian Redstart", family: "ヒタキ科", habitat: "garden", emoji: "🐦" },

  // --- 山地・林 ---
  { id: "yamagara", name: "ヤマガラ", nameEn: "Varied Tit", family: "シジュウカラ科", habitat: "forest", emoji: "🐦" },
  { id: "enaga", name: "エナガ", nameEn: "Long-tailed Tit", family: "エナガ科", habitat: "forest", emoji: "🐦" },
  { id: "uguisu", name: "ウグイス", nameEn: "Japanese Bush Warbler", family: "ウグイス科", habitat: "forest", emoji: "🐦" },
  { id: "kogera", name: "コゲラ", nameEn: "Japanese Pygmy Woodpecker", family: "キツツキ科", habitat: "forest", emoji: "🐦" },
  { id: "aogera", name: "アオゲラ", nameEn: "Japanese Green Woodpecker", family: "キツツキ科", habitat: "forest", emoji: "🐦" },
  { id: "ruribitaki", name: "ルリビタキ", nameEn: "Red-flanked Bluetail", family: "ヒタキ科", habitat: "forest", emoji: "🐦" },
  { id: "kibitaki", name: "キビタキ", nameEn: "Narcissus Flycatcher", family: "ヒタキ科", habitat: "forest", emoji: "🐦" },
  { id: "oruri", name: "オオルリ", nameEn: "Blue-and-white Flycatcher", family: "ヒタキ科", habitat: "forest", emoji: "🐦" },
  { id: "komadori", name: "コマドリ", nameEn: "Japanese Robin", family: "ヒタキ科", habitat: "forest", emoji: "🐦" },
  { id: "isohiyodori", name: "イソヒヨドリ", nameEn: "Blue Rock Thrush", family: "ヒタキ科", habitat: "garden", emoji: "🐦" },
  { id: "tsugumi", name: "ツグミ", nameEn: "Dusky Thrush", family: "ヒタキ科", habitat: "field", emoji: "🐦" },
  { id: "shirohara", name: "シロハラ", nameEn: "Pale Thrush", family: "ヒタキ科", habitat: "forest", emoji: "🐦" },
  { id: "kawasemi", name: "カワセミ", nameEn: "Common Kingfisher", family: "カワセミ科", habitat: "water", emoji: "🐦" },
  { id: "kakkou", name: "カッコウ", nameEn: "Common Cuckoo", family: "カッコウ科", habitat: "field", emoji: "🐦" },
  { id: "hototogisu", name: "ホトトギス", nameEn: "Lesser Cuckoo", family: "カッコウ科", habitat: "forest", emoji: "🐦" },
  { id: "fukurou", name: "フクロウ", nameEn: "Ural Owl", family: "フクロウ科", habitat: "forest", emoji: "🦉" },
  { id: "aobazuku", name: "アオバズク", nameEn: "Brown Hawk-Owl", family: "フクロウ科", habitat: "forest", emoji: "🦉" },

  // --- 草地・農耕地 ---
  { id: "mozu", name: "モズ", nameEn: "Bull-headed Shrike", family: "モズ科", habitat: "field", emoji: "🐦" },
  { id: "kawarahiwa", name: "カワラヒワ", nameEn: "Grey-capped Greenfinch", family: "アトリ科", habitat: "field", emoji: "🐦" },
  { id: "mahiwa", name: "マヒワ", nameEn: "Eurasian Siskin", family: "アトリ科", habitat: "forest", emoji: "🐦" },
  { id: "shime", name: "シメ", nameEn: "Hawfinch", family: "アトリ科", habitat: "field", emoji: "🐦" },
  { id: "ikaru", name: "イカル", nameEn: "Japanese Grosbeak", family: "アトリ科", habitat: "forest", emoji: "🐦" },
  { id: "hoojiro", name: "ホオジロ", nameEn: "Meadow Bunting", family: "ホオジロ科", habitat: "field", emoji: "🐦" },
  { id: "aoji", name: "アオジ", nameEn: "Black-faced Bunting", family: "ホオジロ科", habitat: "field", emoji: "🐦" },
  { id: "kashiradaka", name: "カシラダカ", nameEn: "Rustic Bunting", family: "ホオジロ科", habitat: "field", emoji: "🐦" },
  { id: "kiji", name: "キジ", nameEn: "Green Pheasant", family: "キジ科", habitat: "field", emoji: "🐦" },
  { id: "kojukei", name: "コジュケイ", nameEn: "Chinese Bamboo Partridge", family: "キジ科", habitat: "field", emoji: "🐦" },
  { id: "hibari", name: "ヒバリ", nameEn: "Eurasian Skylark", family: "ヒバリ科", habitat: "field", emoji: "🐦" },

  // --- 水辺 ---
  { id: "karugamo", name: "カルガモ", nameEn: "Eastern Spot-billed Duck", family: "カモ科", habitat: "water", emoji: "🦆" },
  { id: "magamo", name: "マガモ", nameEn: "Mallard", family: "カモ科", habitat: "water", emoji: "🦆" },
  { id: "kogamo", name: "コガモ", nameEn: "Eurasian Teal", family: "カモ科", habitat: "water", emoji: "🦆" },
  { id: "onagagamo", name: "オナガガモ", nameEn: "Northern Pintail", family: "カモ科", habitat: "water", emoji: "🦆" },
  { id: "hidorigamo", name: "ヒドリガモ", nameEn: "Eurasian Wigeon", family: "カモ科", habitat: "water", emoji: "🦆" },
  { id: "kaitsuburi", name: "カイツブリ", nameEn: "Little Grebe", family: "カイツブリ科", habitat: "water", emoji: "🦆" },
  { id: "kawau", name: "カワウ", nameEn: "Great Cormorant", family: "ウ科", habitat: "water", emoji: "🐦" },
  { id: "aosagi", name: "アオサギ", nameEn: "Grey Heron", family: "サギ科", habitat: "water", emoji: "🐦" },
  { id: "daisagi", name: "ダイサギ", nameEn: "Great Egret", family: "サギ科", habitat: "water", emoji: "🐦" },
  { id: "kosagi", name: "コサギ", nameEn: "Little Egret", family: "サギ科", habitat: "water", emoji: "🐦" },
  { id: "goisagi", name: "ゴイサギ", nameEn: "Black-crowned Night Heron", family: "サギ科", habitat: "water", emoji: "🐦" },
  { id: "ban", name: "バン", nameEn: "Common Moorhen", family: "クイナ科", habitat: "water", emoji: "🐦" },
  { id: "oban", name: "オオバン", nameEn: "Eurasian Coot", family: "クイナ科", habitat: "water", emoji: "🐦" },
  { id: "yurikamome", name: "ユリカモメ", nameEn: "Black-headed Gull", family: "カモメ科", habitat: "water", emoji: "🐦" },
  { id: "segurokamome", name: "セグロカモメ", nameEn: "Vega Gull", family: "カモメ科", habitat: "water", emoji: "🐦" },

  // --- 猛禽 ---
  { id: "tobi", name: "トビ", nameEn: "Black Kite", family: "タカ科", habitat: "raptor", emoji: "🦅" },
  { id: "ootaka", name: "オオタカ", nameEn: "Northern Goshawk", family: "タカ科", habitat: "raptor", emoji: "🦅" },
  { id: "nosuri", name: "ノスリ", nameEn: "Eastern Buzzard", family: "タカ科", habitat: "raptor", emoji: "🦅" },
  { id: "chougenbou", name: "チョウゲンボウ", nameEn: "Common Kestrel", family: "ハヤブサ科", habitat: "raptor", emoji: "🦅" },
  { id: "misago", name: "ミサゴ", nameEn: "Osprey", family: "ミサゴ科", habitat: "raptor", emoji: "🦅" },
];

const SPECIES_BY_ID = new Map(BIRDS.map((s) => [s.id, s]));

export function getBird(id: string): BirdSpecies | undefined {
  return SPECIES_BY_ID.get(id);
}

export function birdName(id: string): string {
  return SPECIES_BY_ID.get(id)?.name ?? id;
}

export function birdNameEn(id: string): string {
  return SPECIES_BY_ID.get(id)?.nameEn ?? "";
}

export function birdEmoji(id: string): string {
  return SPECIES_BY_ID.get(id)?.emoji ?? "🐦";
}

export const SPECIES_TOTAL = BIRDS.length;
