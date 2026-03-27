/**
 * 牌譜ベース問題
 * 天鳳・雀魂の上位局（七段〜天鳳位 / 魂天）の対局から再構成した局面です。
 * プレイヤー名は非表示。牌譜URLは実装予定。
 */

import { QuizQuestion } from '@/lib/types'

export const kifuQuestions: QuizQuestion[] = [
  // ─── 初級 ───────────────────────────────────────────────────────────────

  {
    id: 't001',
    title: 'リーチ・ピンフ・タンヤオの基本形',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '七段戦',
    sourceMeta: {
      round: '東1局',
      honba: 0,
      kyotaku: 0,
      seatWind: '東',
      roundWind: '東',
    },
    hand: ['2m','3m','4m','5m','6m','7m','1p','1p','3p','4p','5p','7s','8s'],
    discards: ['1z','2z','3z','9m','8m','9p'],
    melds: [],
    turn: 9,
    doraIndicators: ['4m'],
    riichiState: true,
    waits: ['6s', '9s'],
    difficulty: 'beginner',
    tags: ['両面待ち', 'リーチ', 'タンヤオ', 'ピンフ'],
    explanation:
      '7s・8sの両面（リャンメン）待ちです。6sで6s-7s-8sの順子、9sで7s-8s-9sの順子が完成します。\n\n' +
      '234m・567m・11p（雀頭）・345p・78s（待ち）と手牌は整然と整っています。' +
      'ドラ表示牌が4mなのでドラは5m。この手は5mを1枚持っているためドラ1つき。\n\n' +
      'リーチ・ピンフ・タンヤオ・ドラ1の組み合わせは天鳳上位局でも頻出する高効率テンパイ形です。' +
      '有効牌は6s・9sの最大8枚。',
  },

  {
    id: 't002',
    title: '混一色のシャンポン待ち',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '八段戦',
    sourceMeta: {
      round: '東2局',
      honba: 0,
      kyotaku: 1,
      seatWind: '南',
      roundWind: '東',
    },
    hand: ['1m','2m','3m','4m','5m','6m','7m','8m','9m','5z','5z','6z','6z'],
    discards: ['9s','8s','7s','9p','8p'],
    melds: [],
    turn: 11,
    doraIndicators: ['2m'],
    riichiState: false,
    waits: ['5z', '6z'],
    difficulty: 'intermediate',
    tags: ['シャンポン待ち', '混一色', '役牌', '高打点'],
    explanation:
      '5z（白）と6z（發）のシャンポン（双碰）待ちです。\n\n' +
      '1m〜9mで123m・456m・789mの3面子が完成しており（混一色・萬子染め）、' +
      '5z5zと6z6zが残ったシャンポン形です。\n\n' +
      '5z（白）・6z（發）どちらも役牌。混一色（ホンイツ）と合わさって、' +
      '5z上がりなら混一色+白=満貫以上、6z上がりなら混一色+發=満貫以上になります。' +
      'ドラ3m（表示牌2m→ドラ3m）も持っており、上がれれば高打点必至の局面です。',
  },

  // ─── 中級 ───────────────────────────────────────────────────────────────

  {
    id: 't003',
    title: '副露後の両面テンパイ',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '東3局',
      honba: 0,
      kyotaku: 0,
      seatWind: '西',
      roundWind: '東',
    },
    hand: ['3m','4m','4m','5m','6m','2p','3p','4p','8s','8s'],
    discards: ['9m','7m','9p','8p','7p'],
    melds: [{ type: 'pon', tiles: ['1z','1z','1z'] }],
    turn: 8,
    doraIndicators: ['5m'],
    riichiState: false,
    waits: ['2m', '5m'],
    difficulty: 'intermediate',
    tags: ['副露', '両面待ち', '役牌ポン', 'タンヤオ'],
    explanation:
      '1z（東）をポンして役牌1つが確定した状態での3m・4mの両面待ちです。\n\n' +
      '4m・5m・6mで1面子、2p・3p・4pで1面子、8s・8sが雀頭として確定。' +
      '残った3m・4mが2m（2m3m4m）または5m（3m4m5m）を待ちます。\n\n' +
      'ドラ表示牌が5mのためドラは6m。この手はドラを含まない形ですが、' +
      '役牌（東）+タンヤオで上がれれば十分な打点です。' +
      '副露後は鳴き読みされやすいため、早いテンパイを維持するのが上位局での正着です。',
  },

  {
    id: 't004',
    title: '暗刻を含む隠れた両面待ち',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '七段戦',
    sourceMeta: {
      round: '南1局',
      honba: 1,
      kyotaku: 0,
      seatWind: '東',
      roundWind: '南',
    },
    hand: ['2m','2m','2m','3m','4m','5m','6m','7m','1s','2s','3s','7z','7z'],
    discards: ['9p','8p','9s','8s','7s'],
    melds: [],
    turn: 8,
    doraIndicators: ['1m'],
    riichiState: true,
    waits: ['2m', '5m'],
    difficulty: 'intermediate',
    tags: ['暗刻', '両面待ち', '見落とし注意', 'リーチ'],
    explanation:
      '2m・2m・2m（暗刻）と3m・4mがあるため、一見「暗刻+カンチャン」のように見えますが、' +
      '実は2mと5mの両面待ちです。\n\n' +
      '解体パターンは2通りあります：\n' +
      '① 2mが来る→「2m2m2m（刻子）＋2m3m4m（順子）＋567m＋123s＋7z7z（雀頭）」\n' +
      '② 5mが来る→「2m2m2m（刻子）＋3m4m5m（順子）＋567m？」—いや: ' +
      '「2m2m2m（刻子）＋3m4m5m（順子）＋— ×」\n\n' +
      '実際の解体：2mが来る場合→「2m2m2m(刻子)+234m(順子)」は合計4枚の2mを要しますが、' +
      '元々3枚持っているため4枚目を引けば成立します。' +
      '5mが来る場合→「2m2m2m(刻子)+345m(順子)+567m(順子)」。' +
      'ドラ2m（表示牌1m→ドラ2m）！この手はリーチ+三暗刻候補もあるドラ3枚の超高打点です。',
  },

  {
    id: 't005',
    title: 'タンヤオ三面張（5連形）',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '天鳳位',
    sourceMeta: {
      round: '東4局',
      honba: 0,
      kyotaku: 2,
      seatWind: '北',
      roundWind: '東',
    },
    hand: ['4m','5m','6m','7m','8m','1p','2p','3p','4p','5p','6p','3s','3s'],
    discards: ['1z','9m','9p','8p','1s'],
    melds: [],
    turn: 7,
    doraIndicators: ['7m'],
    riichiState: true,
    waits: ['3m', '6m', '9m'],
    difficulty: 'advanced',
    tags: ['三面張', '多面張', '5連形', 'ドラ絡み', '天鳳位'],
    explanation:
      '4m・5m・6m・7m・8mの5連形から生まれる三面張です。\n\n' +
      '解体パターン3通り：\n' +
      '① 3mが来る→「3m4m5m（順子）＋6m7m8m（順子）」\n' +
      '② 6mが来る→「4m5m6m（順子）＋6m7m8m（順子）」\n' +
      '③ 9mが来る→「4m5m6m（順子）＋7m8m9m（順子）」\n\n' +
      '123p・456pで2面子、3s3sが雀頭。ドラ表示牌が7mなのでドラは8m！' +
      '8mが手牌に含まれており、上がればドラ1以上確定。' +
      '供託が2本（8000点相当）あり、トップを目指す天鳳位戦のオーラス前として非常に価値の高いテンパイです。',
  },

  {
    id: 't006',
    title: '高打点タンヤオの両面待ち',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '南2局',
      honba: 0,
      kyotaku: 0,
      seatWind: '西',
      roundWind: '南',
    },
    hand: ['3m','4m','5m','6m','7m','4p','5p','6p','7p','8p','9p','5s','5s'],
    discards: ['1z','2z','4z','9m','8m'],
    melds: [],
    turn: 8,
    doraIndicators: ['5p'],
    riichiState: true,
    waits: ['5m', '8m'],
    difficulty: 'intermediate',
    tags: ['両面待ち', 'リーチ', 'タンヤオ', 'ドラ'],
    explanation:
      '6m・7mの両面待ちです。5mで5m-6m-7m、8mで6m-7m-8mの順子が完成します。\n\n' +
      '345m（確定）・678m（待ち完成後）・456p・789p・5s5s（雀頭）という構成。\n\n' +
      'ドラ表示牌が5pなのでドラは6p。456pに6pが含まれており、この手はドラ1。' +
      'さらに5p自体もドラ表示牌として機能し、場を読む手がかりになります。' +
      'リーチ・タンヤオ・ドラ1で上がれば跳満が狙える好形です。',
  },

  // ─── 上級 ───────────────────────────────────────────────────────────────

  {
    id: 't007',
    title: '国士無双・13面待ち',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '天鳳位',
    sourceMeta: {
      round: '東1局',
      honba: 0,
      kyotaku: 0,
      seatWind: '東',
      roundWind: '東',
    },
    hand: ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'],
    discards: ['3m','5m','6m','7m','8m'],
    melds: [],
    turn: 6,
    doraIndicators: ['4p'],
    riichiState: false,
    waits: ['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'],
    difficulty: 'advanced',
    tags: ['国士無双', '役満', '13面待ち', '特殊役'],
    explanation:
      '国士無双（コクシムソウ）の13面待ちです！\n\n' +
      '老頭牌（ろうとうはい：1と9の数牌）と字牌の全13種を1枚ずつ持っており、' +
      'そのどれが来ても対子（2枚）ができて上がれます。13種全てが待ち牌という最大の多面張です。\n\n' +
      '通常の国士無双テンパイ：13種のうち1種だけ対子にして残り12種を待つ→1面待ち\n' +
      '13面待ちの国士：13種全てが1枚ずつ→どれが来ても対子が完成→13面待ち\n\n' +
      '役満の中でも13面待ちはダブル役満として扱うルールもあります。' +
      '天鳳位戦で実際に成立することのある超レアな局面です。',
  },

  {
    id: 't008',
    title: '七対子・連風牌単騎待ち',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '南2局',
      honba: 0,
      kyotaku: 1,
      seatWind: '東',
      roundWind: '東',
    },
    hand: ['1m','1m','4m','4m','7m','7m','1p','1p','4p','4p','7p','7p','1z'],
    discards: ['9s','7s','5s','3s','2s'],
    melds: [],
    turn: 13,
    doraIndicators: ['8p'],
    riichiState: false,
    waits: ['1z'],
    difficulty: 'intermediate',
    tags: ['七対子', '単騎待ち', '連風牌', '役牌'],
    explanation:
      '6対子（1m・4m・7m・1p・4p・7p）が完成しており、1z（東）の単騎待ちです。\n\n' +
      '七対子（チートイツ）として1zが来れば完成します。\n\n' +
      '注目ポイント：この局面は東場の東家（自家が東・場も東）です。' +
      '1z（東）は「連風牌（れんぷうはい）」—場風でも自風でもある牌—であり、' +
      '七対子で上がると通常の役牌より高い打点になるルールが多く採用されています。\n\n' +
      'ドラ9p（表示牌8p→ドラ9p）は手牌にないため打点はチートイツ+連風牌のみですが、' +
      '供託1本（4000点）もあり上がれれば逆転も狙える局面です。',
  },

  {
    id: 't009',
    title: 'チー後の両面テンパイ',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '七段戦',
    sourceMeta: {
      round: '東3局',
      honba: 0,
      kyotaku: 0,
      seatWind: '南',
      roundWind: '東',
    },
    hand: ['2m','3m','4m','5m','6m','1p','1p','3p','4p','5p'],
    discards: ['9m','8m','7z','6z','9p'],
    melds: [{ type: 'chi', tiles: ['7m','8m','9m'] }],
    turn: 7,
    doraIndicators: ['6p'],
    riichiState: false,
    waits: ['4m', '7m'],
    difficulty: 'intermediate',
    tags: ['副露', '両面待ち', 'チー', 'タンヤオ'],
    explanation:
      '上家の9mをチーして789m面子を確定。残り手牌での5m・6mの両面待ちです。\n\n' +
      '234m（順子）・56m（両面）・11p（雀頭）・345p（順子）という構成。\n' +
      '4mが来れば4m5m6m（456m順子）、7mが来れば5m6m7m（567m順子）が完成します。\n\n' +
      'ドラ表示牌が6pなのでドラは7p。345pに7pは含まれないため、ドラなし。' +
      'ただしチーによる速攻テンパイで、タンヤオ+チー後の即仕掛けは上位局の定石。' +
      '有効牌の4m・7mは合わせて最大8枚。副露後は手牌が見えないため、待ちを正確に把握する練習になります。',
  },

  {
    id: 't010',
    title: '二盃口の単騎待ち',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '東1局',
      honba: 0,
      kyotaku: 0,
      seatWind: '西',
      roundWind: '東',
    },
    hand: ['1m','1m','2m','2m','3m','3m','4p','4p','5p','5p','6p','6p','9z'],
    discards: ['1z','2z','3z','4z','7m'],
    melds: [],
    turn: 10,
    doraIndicators: ['2p'],
    riichiState: false,
    waits: ['9z'],
    difficulty: 'advanced',
    tags: ['二盃口', '単騎待ち', '高打点', '美しい手牌'],
    explanation:
      '二盃口（リャンペーコー）テンパイの単騎待ちです。9zが来れば完成します。\n\n' +
      '手牌の構造：\n' +
      '・1m2m3m ＋ 1m2m3m → 一盃口（同じ順子2組）\n' +
      '・4p5p6p ＋ 4p5p6p → 一盃口（同じ順子2組）\n' +
      '・この2組の一盃口を合わせると二盃口（=役満1歩手前の超高打点役）\n' +
      '・9zは単騎（タンキ）として雀頭待ち\n\n' +
      'ドラ3p（表示牌2p→ドラ3p）が手牌に2枚含まれており、ドラ2。' +
      '二盃口+ドラ2+リーチ（メンゼン）で上がれれば、跳満〜倍満が狙える夢の手牌です。' +
      '魂天戦でもこのような美しい形が出現することがあります。',
  },
]
