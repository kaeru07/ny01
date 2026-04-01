import { PlayerIndex, TileIndex } from "./mahjong";

// ユーザーが読みを行ったときの記録
export interface ReadAttempt {
  id: string;
  targetPlayer: PlayerIndex;    // 誰を読んだか
  turnCount: number;            // 何巡目か
  tileRangePrediction: TileIndex[];  // 手牌に含まれると予想した牌
  rolePrediction: string[];     // 予想した役: ['tanyao', 'honitsu', ...]
  waitPrediction: TileIndex[];  // 待ち牌予想
  freeNote: string;
  submittedAt: number;
}

// 局後の答え合わせ結果
export interface ReviewResult {
  attemptId: string;
  targetPlayer: PlayerIndex;
  actualHand: TileIndex[];
  actualWaits: TileIndex[];
  scores: {
    waitScore: number;    // 0-100: 待ち予想の正確さ
    rangeScore: number;   // 0-100: 手牌レンジ予想の正確さ
    roleScore: number;    // 0-100: 役予想の正確さ
    total: number;        // 0-100: 総合点
  };
  feedback: string[];
  comparison: {
    correctWaits: TileIndex[];
    missedWaits: TileIndex[];
    wrongWaits: TileIndex[];
  };
}

// 読みモードの現在の状態
export interface TrainingState {
  isReading: boolean;           // 読みモード中か
  selectedTarget: PlayerIndex | null;
  currentAttempt: Partial<ReadAttempt> | null;
  attempts: ReadAttempt[];      // この局の全読み回答
  reviewResults: ReviewResult[]; // 局後に計算された答え合わせ結果
}

// 予想できる役一覧
export const PREDICTABLE_ROLES = [
  { id: "tanyao", name: "タンヤオ" },
  { id: "pinfu", name: "平和" },
  { id: "iipeiko", name: "一盃口" },
  { id: "sanshoku", name: "三色同順" },
  { id: "ittsu", name: "一気通貫" },
  { id: "chanta", name: "混全帯么九" },
  { id: "toitoi", name: "対々和" },
  { id: "sanankou", name: "三暗刻" },
  { id: "honitsu", name: "混一色" },
  { id: "chinitsu", name: "清一色" },
  { id: "chiitoitsu", name: "七対子" },
  { id: "riichi", name: "立直" },
  { id: "menzen_tsumo", name: "門前清自摸和" },
] as const;

export type RoleId = (typeof PREDICTABLE_ROLES)[number]["id"];
