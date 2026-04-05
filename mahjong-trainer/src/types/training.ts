import { PlayerIndex, TileIndex } from "./mahjong";

// 手牌スタイルタグ
export const HAND_STYLES = [
  { id: 'menzen',  label: '面前寄り',  desc: 'ポンチーなし' },
  { id: 'nakite',  label: '仕掛け寄り', desc: '鳴き主体' },
  { id: 'somete',  label: '染め手',    desc: '一色集中' },
  { id: 'toitsu',  label: '対子系',    desc: '対々・七対子' },
  { id: 'yakuhai', label: '役牌系',    desc: '字牌の重ね' },
  { id: 'tanyao',  label: '断么九',    desc: '中張牌中心' },
  { id: 'chiitoi', label: '七対子系',  desc: '対子7組狙い' },
  { id: 'honitsu', label: '染め手強',  desc: '混一/清一色' },
] as const;

export type HandStyleId = typeof HAND_STYLES[number]['id'];

// ユーザーが読みを行ったときの記録
export interface ReadAttempt {
  id: string;
  targetPlayer: PlayerIndex;    // 誰を読んだか
  turnCount: number;            // 何巡目か
  handStyleTags: HandStyleId[]; // 手牌スタイル予想タグ (NEW)
  tileRangePrediction: TileIndex[];  // 手牌に含まれると予想した牌 (詳細版)
  rolePrediction: string[];     // 予想した役: ['tanyao', 'honitsu', ...]
  waitPrediction: TileIndex[];  // 待ち牌予想
  freeNote: string;
  submittedAt: number;
}

// 読み評価グレード
export type ReviewGrade = 'hit' | 'close' | 'miss';

// 局後の答え合わせ結果
export interface ReviewResult {
  attemptId: string;
  targetPlayer: PlayerIndex;
  actualHand: TileIndex[];
  actualWaits: TileIndex[];
  grade: ReviewGrade;        // 当たり / 近い / 外れ
  yakuHints: string[];       // 実際の手牌から推定した役の傾向
  scores: {
    waitScore: number;    // 0-100: 待ち予想の正確さ
    styleScore: number;   // 0-100: スタイルタグ予想の正確さ
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
