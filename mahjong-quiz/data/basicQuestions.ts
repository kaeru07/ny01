/**
 * 基礎問題
 * 捨て牌・巡目・ドラなどの情報から待ち牌の形を読む教科書的な問題集。
 * 基本的な待ちパターン（両面・カンチャン・ペンチャン・単騎・シャンポン等）を学ぶ。
 */

import { QuizQuestion } from '@/lib/types'

export const basicQuestions: QuizQuestion[] = [
  // ─── 初級 ───────────────────────────────────────────────────────────────

  {
    id: 'q001',
    title: '教科書的な両面待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    difficulty: 'beginner',
    tags: ['両面待ち', 'リーチ', '清一色まがい'],
    visibleInfo: {
      discards: [
        { tile: '9p', tsumokiri: false },
        { tile: '8p', tsumokiri: false },
        { tile: '7z', tsumokiri: false },
        { tile: '4z', tsumokiri: false },
        { tile: '3z', tsumokiri: false },
      ],
      melds: [],
      riichiState: true,
      turn: 8,
      doraIndicators: ['3p'],
    },
    answer: {
      waits: ['2s', '5s'],
      hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '1p', '3s', '4s'],
      explanation:
        '3s・4sの両面（リャンメン）待ちです。2sが来れば2s-3s-4sの順子、5sが来れば3s-4s-5sの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '字牌（7z・4z・3z）と端ピンズ（9p・8p）を早期に切りリーチ → 中張重視の整った手\n' +
        '捨て牌にソーズが出ていない → ソーズ中張が複数残っている可能性\n\n' +
        '実際の手牌：1m〜9mで3面子（123m・456m・789m）、1p・1pが雀頭、3s4sが両面待ち。\n' +
        'ドラ表示牌3p → ドラ4p。有効牌は2sと5sの最大8枚。',
    },
  },

  {
    id: 'q002',
    title: '字牌雀頭の両面待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '六段〜天鳳位想定',
    difficulty: 'beginner',
    tags: ['両面待ち', '字牌雀頭'],
    visibleInfo: {
      discards: [
        { tile: '1m', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '4z', tsumokiri: false },
        { tile: '2z', tsumokiri: false },
        { tile: '6m', tsumokiri: false },
      ],
      melds: [],
      riichiState: false,
      turn: 10,
      doraIndicators: ['5p'],
    },
    answer: {
      waits: ['1p', '4p'],
      hand: ['2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '1s', '2s', '3s', '7z', '7z'],
      explanation:
        '2p・3pの両面待ちです。1pが来れば1p-2p-3pの順子、4pが来れば2p-3p-4pの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '老頭牌（1m・9m）と字牌（4z・2z）・マンズ中張（6m）を切り → タンヤオ寄りの手組み\n' +
        '捨て牌にピンズが出ていない → ピンズに複数牌が残っている可能性\n\n' +
        '実際の手牌：4p5p6p + 7p8p9p + 1s2s3s + 7z7z（雀頭）+ 2p3p（待ち）\n' +
        'ドラ表示牌5p → ドラ6p。4p5p6pに6pが含まれており、ドラ1付き。',
    },
  },

  {
    id: 'q003',
    title: 'ペンチャン待ちの見分け方',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '五段〜八段想定',
    difficulty: 'beginner',
    tags: ['ペンチャン待ち', 'リーチ', '端牌'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '2z', tsumokiri: false },
        { tile: '3z', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
        { tile: '8p', tsumokiri: false },
      ],
      melds: [],
      riichiState: true,
      turn: 9,
      doraIndicators: ['2s'],
    },
    answer: {
      waits: ['3m'],
      hand: ['1m', '2m', '4m', '5m', '6m', '7m', '8m', '9m', '2p', '3p', '4p', '5s', '5s'],
      explanation:
        '1m・2mのペンチャン（辺張）待ちで、3mのみが待ち牌です。\n\n' +
        '【読みのポイント】\n' +
        '字牌3枚（1z・2z・3z）と端ピンズ（9p・8p）を早期に切りリーチ → タンヤオ系\n' +
        '捨て牌にマンズが出ていない → マンズが多く残っている可能性\n\n' +
        '実際の手牌：456m + 789m + 234p + 5s5s（雀頭）+ 1m2m（待ち）\n' +
        '「1-2」という形は端牌（1m）の存在でペンチャン待ちになります。3mで1m-2m-3m完成。\n' +
        'ドラ表示牌2s → ドラ3s。有効牌は3mのみの最大4枚。',
    },
  },

  // ─── 中級 ───────────────────────────────────────────────────────────────

  {
    id: 'q004',
    title: '間に挟まったカンチャン待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '六段〜天鳳位想定',
    difficulty: 'intermediate',
    tags: ['カンチャン待ち', 'リーチ', '中間牌'],
    visibleInfo: {
      discards: [
        { tile: '9s', tsumokiri: false },
        { tile: '8s', tsumokiri: false },
        { tile: '7s', tsumokiri: false },
        { tile: '4z', tsumokiri: false },
        { tile: '1z', tsumokiri: false },
      ],
      melds: [],
      riichiState: true,
      turn: 7,
      doraIndicators: ['9m'],
    },
    answer: {
      waits: ['3m'],
      hand: ['1m', '1m', '2m', '4m', '5m', '6m', '7m', '1p', '2p', '3p', '4p', '5p', '6p'],
      explanation:
        '2m・4mのカンチャン（嵌張）待ちで、間の3mが来て2m-3m-4mが完成します。\n\n' +
        '【読みのポイント】\n' +
        'ソーズ上端（9s・8s・7s）と字牌（4z・1z）を早期に切りリーチ → 整理した中張系の手\n' +
        '捨て牌にマンズ・ピンズが出ていない → マンズ・ピンズに複数牌が残っている可能性\n\n' +
        '実際の手牌：1m1m（雀頭）+ 567m + 123p・456p（2面子）+ 2m4m（カンチャン待ち）\n' +
        'ドラ表示牌9m → ドラ1m（次の牌は？）実は老頭牌の次は老頭牌自身に戻る仕様次第。\n' +
        'カンチャンは有効牌が最大4枚だが、高打点なら即リーチが正着です。',
    },
  },

  {
    id: 'q005',
    title: '役牌シャンポン待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    difficulty: 'intermediate',
    tags: ['シャンポン待ち', '役牌', '選択'],
    visibleInfo: {
      discards: [
        { tile: '9p', tsumokiri: false },
        { tile: '8p', tsumokiri: false },
        { tile: '9s', tsumokiri: false },
        { tile: '8s', tsumokiri: false },
        { tile: '1p', tsumokiri: false },
      ],
      melds: [],
      riichiState: false,
      turn: 11,
      doraIndicators: ['4p'],
    },
    answer: {
      waits: ['3z', '7z'],
      hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '3z', '3z', '7z', '7z'],
      explanation:
        '3z（西）と7z（中）のシャンポン（双碰）待ちです。どちらが来ても一方が雀頭・他方が刻子となります。\n\n' +
        '【読みのポイント】\n' +
        '端ピンズ（9p・8p・1p）と端ソーズ（9s・8s）を整理 → 数牌の端不要\n' +
        '字牌が1枚も捨て牌に出ていない → 字牌を複数保有している可能性（役牌系）\n\n' +
        '実際の手牌：1m〜9mで3面子（123m・456m・789m）+ 3z3z + 7z7z（シャンポン待ち）\n' +
        '7z（中）で上がれば中の役牌付き。西家なら3z（西）にも役がつき高打点。\n' +
        'シャンポンは有効牌最大8枚で、どちらで上がるかで手役が変わります。',
    },
  },

  {
    id: 'q006',
    title: '4面子完成の単騎待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '六段〜天鳳位想定',
    difficulty: 'intermediate',
    tags: ['単騎待ち', '端牌', 'タンピン'],
    visibleInfo: {
      discards: [
        { tile: '7z', tsumokiri: false },
        { tile: '6z', tsumokiri: false },
        { tile: '5z', tsumokiri: false },
        { tile: '4z', tsumokiri: false },
        { tile: '2z', tsumokiri: false },
      ],
      melds: [],
      riichiState: false,
      turn: 12,
      doraIndicators: ['8p'],
    },
    answer: {
      waits: ['9p'],
      hand: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '3s', '9p'],
      explanation:
        '4面子（123m・456m・789m・123s）が完成しており、9pの単騎（タンキ）待ちです。\n\n' +
        '【読みのポイント】\n' +
        '字牌を5枚（7z・6z・5z・4z・2z）連続して切り → 字牌を全て整理している\n' +
        '捨て牌に数牌が出ていない → 数牌4面子が揃っている = 単騎待ちの可能性大\n\n' +
        '実際の手牌：123m + 456m + 789m + 123s（4面子完成）+ 9p（単騎待ち）\n' +
        '9pは老頭牌（端牌）なので他家が比較的切りやすく出やすい牌。\n' +
        'ドラ表示牌8p → ドラ9p。9p単騎なのでドラ待ちでもあります！',
    },
  },

  {
    id: 'q007',
    title: 'ノベタン待ちの基本形',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    difficulty: 'intermediate',
    tags: ['ノベタン待ち', 'リーチ', '2面待ち'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '8m', tsumokiri: false },
        { tile: '7m', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
      ],
      melds: [],
      riichiState: true,
      turn: 9,
      doraIndicators: ['3m'],
    },
    answer: {
      waits: ['1m', '4m'],
      hand: ['1m', '2m', '3m', '4m', '5p', '6p', '7p', '2s', '3s', '4s', '6s', '7s', '8s'],
      explanation:
        '1m・2m・3m・4mの4連形（ノベタン）で、1mと4mが待ち牌です。\n\n' +
        '【読みのポイント】\n' +
        'マンズ上端（9m・8m・7m）と字牌（1z）・ピンズ端（9p）を切りリーチ\n' +
        '捨て牌にマンズ中張（1m〜6m）と索子が出ていない → その付近が残っている可能性\n\n' +
        '実際の手牌：567p + 234s + 678s + 1m2m3m4m（ノベタン待ち）\n' +
        '1mが来れば「1m1m（頭）+ 2m3m4m（順子）」、4mが来れば「1m2m3m（順子）+ 4m4m（頭）」\n' +
        'ドラ表示牌3m → ドラ4m。4m待ちで上がればドラ1付きです。',
    },
  },

  // ─── 上級 ───────────────────────────────────────────────────────────────

  {
    id: 'q008',
    title: '5連形の三面張',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '八段〜天鳳位想定',
    difficulty: 'advanced',
    tags: ['三面張', '多面張', '5連形'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '2z', tsumokiri: false },
        { tile: '3z', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '8m', tsumokiri: false },
      ],
      melds: [],
      riichiState: true,
      turn: 8,
      doraIndicators: ['6m'],
    },
    answer: {
      waits: ['2m', '5m', '8m'],
      hand: ['3m', '4m', '5m', '6m', '7m', '1p', '2p', '3p', '4p', '5p', '6p', '9s', '9s'],
      explanation:
        '3m・4m・5m・6m・7mの5連形による三面張（サンメンタン）です。2m・5m・8mの3種が待ちです。\n\n' +
        '3通りの解体パターン：\n' +
        '① 2mが来る → 2m3m4m + 5m6m7m の2面子完成\n' +
        '② 5mが来る → 3m4m5m + 5m6m7m の2面子完成\n' +
        '③ 8mが来る → 3m4m5m + 6m7m8m の2面子完成\n\n' +
        '【読みのポイント】\n' +
        '字牌3枚（1z・2z・3z）と老頭牌（9m・8m）を切りリーチ → 中張重視の手\n' +
        '捨て牌にマンズ中張が出ていない → マンズ中張が5連形として残っている可能性\n\n' +
        '実際の手牌：3m4m5m6m7m（5連形）+ 123p + 456p + 9s9s（雀頭）\n' +
        'ドラ表示牌6m → ドラ7m。7mが手牌に含まれており、リーチ+ドラ1確定です。',
    },
  },

  {
    id: 'q009',
    title: '七対子の単騎待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    difficulty: 'advanced',
    tags: ['七対子', '単騎待ち', '特殊役'],
    visibleInfo: {
      discards: [
        { tile: '9s', tsumokiri: false },
        { tile: '7s', tsumokiri: false },
        { tile: '5s', tsumokiri: false },
        { tile: '3s', tsumokiri: false },
        { tile: '1s', tsumokiri: false },
      ],
      melds: [],
      riichiState: false,
      turn: 13,
      doraIndicators: ['5m'],
    },
    answer: {
      waits: ['6p'],
      hand: ['2m', '2m', '4m', '4m', '6m', '6m', '8m', '8m', '2p', '2p', '4p', '4p', '6p'],
      explanation:
        '6対子（2m・4m・6m・8m・2p・4p）が完成しており、7枚目の対子である6pの単騎待ちです。\n\n' +
        '【読みのポイント】\n' +
        'ソーズ奇数牌（9s・7s・5s・3s・1s）を連続して切り → ソーズ全切り = 対子手の整理\n' +
        '奇数・偶数交互の捨て牌 → 対子を保持しながら不要牌を切っている特徴的なパターン\n\n' +
        '実際の手牌：2m2m + 4m4m + 6m6m + 8m8m + 2p2p + 4p4p（6対子完成）+ 6p（単騎待ち）\n' +
        '七対子（チートイツ）は7組の対子で完成する特殊な役。6pで7対子完成。\n' +
        'ドラ表示牌5m → ドラ6m。6m6mがあるのでドラ対子！七対子+ドラ2 = 高打点。',
    },
  },

  {
    id: 'q010',
    title: '暗刻含みの複合待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '八段〜天鳳位想定',
    difficulty: 'advanced',
    tags: ['複合待ち', '暗刻', 'シャンポン変形', '見落とし注意'],
    visibleInfo: {
      discards: [
        { tile: '5m', tsumokiri: false },
        { tile: '6m', tsumokiri: false },
        { tile: '7m', tsumokiri: false },
        { tile: '8m', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
      ],
      melds: [],
      riichiState: false,
      turn: 10,
      doraIndicators: ['3s'],
    },
    answer: {
      waits: ['1m', '9z'],
      hand: ['1m', '1m', '2m', '3m', '4m', '6p', '7p', '8p', '2s', '3s', '4s', '9z', '9z'],
      explanation:
        '一見「1m1m（雀頭）+ 2m3m4m + 9z9z待ち」に見えますが、1mも待ち牌の複合待ちです。\n\n' +
        '2通りの完成形：\n' +
        '① 9zが来る → 1m1m（頭）+ 2m3m4m（順子）+ 678p + 234s + 9z9z9z（暗刻）\n' +
        '② 1mが来る → 1m1m1m（暗刻）+ 2m3m4m（順子）+ 678p + 234s + 9z9z（頭）\n\n' +
        '【読みのポイント】\n' +
        'マンズ中上段（5m・6m・7m・8m・9m）を連続して切り → マンズ中上段が不要\n' +
        '捨て牌にマンズ低位（1m〜4m）・ピンズ・ソーズが出ていない → それらが残っている\n\n' +
        '実際の手牌：1m1m2m3m4m（暗刻変形）+ 678p + 234s + 9z9z（シャンポン的複合待ち）\n' +
        'ドラ表示牌3s → ドラ4s。2s3s4sに4sが含まれており、ドラ1。\n' +
        '暗刻から生まれる複合待ちは上位局でも見落とされやすい難問です。',
    },
  },
]
