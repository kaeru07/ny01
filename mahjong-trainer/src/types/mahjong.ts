// 牌インデックス: 0-8=萬子1-9, 9-17=筒子1-9, 18-26=索子1-9, 27=東,28=南,29=西,30=北,31=白,32=発,33=中
export type TileIndex = number;

export type TileSuit = "man" | "pin" | "sou" | "honor";
export type Wind = "east" | "south" | "west" | "north";
export type PlayerIndex = 0 | 1 | 2 | 3;
export type MeldType = "chi" | "pon" | "kan" | "ankan";

export interface Tile {
  suit: TileSuit;
  number: number; // 1-9 (honor: 1=東,2=南,3=西,4=北,5=白,6=発,7=中)
  index: TileIndex; // 0-33
}

export interface Meld {
  type: MeldType;
  tiles: TileIndex[];
  fromPlayer?: PlayerIndex;
}

export interface Player {
  index: PlayerIndex;
  wind: Wind;
  hand: TileIndex[];      // 手牌 (ツモ牌含まず)
  drawnTile: TileIndex | null; // 今ツモった牌
  discards: TileIndex[];  // 河
  melds: Meld[];
  score: number;
  riichi: boolean;
  tenpai: boolean;
}
