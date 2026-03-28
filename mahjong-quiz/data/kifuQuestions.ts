/**
 * 牌譜読みクイズ問題
 * 捨て牌・副露・リーチなど「見える情報」から待ち牌を推理する問題集。
 * 天鳳・雀魂の上位局（七段〜天鳳位 / 魂天）を参考に再構成。
 */

import { QuizQuestion } from '@/lib/types'

export const kifuQuestions: QuizQuestion[] = [
  // ─── 初級 ───────────────────────────────────────────────────────────────

  {
    id: 't001',
    title: '字牌・端牌早切りのリーチ',
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
    difficulty: 'beginner',
    tags: ['両面待ち', 'リーチ', '字牌早切り', '端牌整理'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '1p', tsumokiri: false },
        { tile: '8s', tsumokiri: false },
        { tile: '3p', tsumokiri: false }, // リーチ宣言牌
        { tile: '6m', tsumokiri: true },
        { tile: '9p', tsumokiri: true },
      ],
      melds: [],
      riichiState: true,
      riichiTurn: 6,
      turn: 8,
      doraIndicators: ['4m'],
      // 他家データ（参考）
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '4z', tsumokiri: false },
            { tile: '3z', tsumokiri: false },
            { tile: '9m', tsumokiri: true },
            { tile: '1p', tsumokiri: true },
            { tile: '7p', tsumokiri: false },
            { tile: '8m', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '8s', tsumokiri: true },
            { tile: '7z', tsumokiri: false },
            { tile: '3m', tsumokiri: true },
            { tile: '6p', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '2z', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '9s', tsumokiri: true },
          ],
          melds: [{ type: 'pon', tiles: ['6z', '6z', '6z'] }],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['2s', '5s'],
      hand: ['2m', '3m', '4m', '5m', '6m', '7m', '1p', '1p', '2p', '3p', '4p', '3s', '4s'],
      explanation:
        '3s・4sの両面（リャンメン）待ちです。2sで2s-3s-4s、5sで3s-4s-5sの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 1巡目に字牌（1z）を切り → 役牌を使わないタンヤオ系か中張重視の手\n' +
        '② 9m・1pと端牌を続けて切り → マンズ・ピンズの端牌不要 = 中張が揃っている\n' +
        '③ 8sを切り → ソーズの上端も不要\n' +
        '④ 3pで宣言 → 3pが不要になった = 2p3p4pが既に面子完成し3pが余剰\n\n' +
        '捨て牌に索子中張（2s〜7s）が1枚も出ていない → 索子中張が複数残っている可能性大。\n' +
        '実際の手牌：2m3m4m + 5m6m7m + 2p3p4p + 1p1p（雀頭） + 3s4s（待ち）\n' +
        'ドラ表示牌4m → ドラ5m。5m・6m・7mに5mが含まれており、ドラ1付きのリーチです。',
    },
  },

  {
    id: 't002',
    title: '手出し多数の字牌単騎リーチ',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '東2局',
      honba: 0,
      kyotaku: 0,
      seatWind: '南',
      roundWind: '東',
    },
    difficulty: 'beginner',
    tags: ['単騎待ち', 'リーチ', '字牌単騎', '整った手'],
    visibleInfo: {
      discards: [
        { tile: '7z', tsumokiri: false },
        { tile: '3z', tsumokiri: false },
        { tile: '1m', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
        { tile: '4m', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '2z', tsumokiri: false },
        { tile: '5p', tsumokiri: false }, // リーチ宣言牌
        { tile: '4p', tsumokiri: true },
        { tile: '8s', tsumokiri: true },
      ],
      melds: [],
      riichiState: true,
      riichiTurn: 9,
      turn: 11,
      doraIndicators: ['8p'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '9m', tsumokiri: false },
            { tile: '7p', tsumokiri: true },
            { tile: '3s', tsumokiri: true },
            { tile: '6m', tsumokiri: false },
            { tile: '2z', tsumokiri: false },
            { tile: '4z', tsumokiri: true },
            { tile: '8p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '7z', tsumokiri: false },
            { tile: '3z', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '9p', tsumokiri: true },
            { tile: '4s', tsumokiri: false },
            { tile: '6z', tsumokiri: false },
            { tile: '5m', tsumokiri: true },
            { tile: '1p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '4z', tsumokiri: false },
            { tile: '5z', tsumokiri: false },
            { tile: '1s', tsumokiri: false },
            { tile: '9m', tsumokiri: true },
            { tile: '2p', tsumokiri: false },
            { tile: '7m', tsumokiri: true },
            { tile: '6s', tsumokiri: true },
            { tile: '3p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['1z'],
      hand: ['2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '4p', '6p', '7p', '8p', '1z'],
      explanation:
        '1z（東）の単騎待ちです。東が来れば東東の雀頭が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 字牌を3枚（7z・3z・2z）早期に切り → 字牌は役牌以外は使わない方針\n' +
        '② 老頭牌（1m・9p・4m・9m）を連続して切り → 端牌不要のタンヤオ系か整った中張手\n' +
        '③ 字牌を3枚切ったが1zだけ残している → 1z（東）は何か意図がある？\n' +
        '④ 5pを捨ててリーチ → 数牌中張が余った = 面子が全て完成している\n\n' +
        'ここで「字牌を3枚切ったのに1枚残している」= 字牌待ちの単騎が有力！\n' +
        '実際の手牌：2m3m4m + 5m6m7m + 2p3p4p + 6p7p8p + 1z（単騎待ち）\n' +
        '数牌4面子が全て中張で構成された整然たる手。字牌の単騎待ちは相手が警戒しにくく実戦的です。',
    },
  },

  // ─── 中級 ───────────────────────────────────────────────────────────────

  {
    id: 't003',
    title: '索子染め手（チンイツ）の両面リーチ',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '天鳳位',
    sourceMeta: {
      round: '東3局',
      honba: 0,
      kyotaku: 0,
      seatWind: '西',
      roundWind: '東',
    },
    difficulty: 'intermediate',
    tags: ['両面待ち', 'リーチ', '清一色', '染め手読み'],
    visibleInfo: {
      discards: [
        { tile: '1m', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
        { tile: '3m', tsumokiri: false },
        { tile: '7p', tsumokiri: false },
        { tile: '6m', tsumokiri: false },
        { tile: '2p', tsumokiri: false },
        { tile: '1p', tsumokiri: false },
        { tile: '4p', tsumokiri: false }, // リーチ宣言牌
        { tile: '7m', tsumokiri: true },
      ],
      melds: [],
      riichiState: true,
      riichiTurn: 9,
      turn: 10,
      doraIndicators: ['3s'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '9m', tsumokiri: false },
            { tile: '8p', tsumokiri: false },
            { tile: '7z', tsumokiri: true },
            { tile: '3m', tsumokiri: false },
            { tile: '6s', tsumokiri: true },
            { tile: '9s', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '3z', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '8m', tsumokiri: true },
            { tile: '4p', tsumokiri: false },
            { tile: '7p', tsumokiri: true },
            { tile: '5m', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '2z', tsumokiri: false },
            { tile: '1p', tsumokiri: false },
            { tile: '4z', tsumokiri: true },
            { tile: '5z', tsumokiri: false },
            { tile: '9m', tsumokiri: true },
            { tile: '3p', tsumokiri: false },
            { tile: '6m', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['2s', '5s'],
      hand: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '3s', '4s', '6s', '6s'],
      explanation:
        '3s・4sの両面待ちです。2sで2s-3s-4s、5sで3s-4s-5sの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 捨て牌がマンズ（1m・3m・6m）とピンズ（9p・7p・2p・1p・4p）だけ → ソーズ牌が1枚も出ていない！\n' +
        '② 染め手（清一色・混一色）の可能性が非常に高い\n' +
        '③ 字牌が1枚も切られていない → 字牌なし = 清一色（チンイツ）が有力\n' +
        '④ 4pで宣言 → ピンズを全て整理した時点でテンパイ = 索子清一色確定\n\n' +
        '実際の手牌：1s2s3s + 4s5s6s + 7s8s9s + 3s4s（待ち） + 6s6s（雀頭）\n' +
        'ドラ表示牌3s → ドラ4s。4sが手牌に含まれており、清一色+リーチ+ドラ1 = 跳満以上の超高打点です。',
    },
  },

  {
    id: 't004',
    title: '役牌ポン後の中張待ち',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '七段戦',
    sourceMeta: {
      round: '東4局',
      honba: 0,
      kyotaku: 0,
      seatWind: '北',
      roundWind: '東',
    },
    difficulty: 'intermediate',
    tags: ['副露', '両面待ち', '役牌ポン', '中張読み'],
    visibleInfo: {
      discards: [
        { tile: '9p', tsumokiri: false },
        { tile: '8m', tsumokiri: false },
        { tile: '9m', tsumokiri: false }, // after pon
        { tile: '1p', tsumokiri: false },
        { tile: '8p', tsumokiri: false },
      ],
      melds: [{ type: 'pon', tiles: ['1z', '1z', '1z'] }],
      riichiState: false,
      turn: 8,
      doraIndicators: ['6p'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '7z', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '3z', tsumokiri: true },
            { tile: '8s', tsumokiri: true },
          ],
          melds: [{ type: 'pon', tiles: ['4z', '4z', '4z'] }],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '5z', tsumokiri: false },
            { tile: '9m', tsumokiri: true },
            { tile: '1s', tsumokiri: false },
            { tile: '4m', tsumokiri: false },
            { tile: '7p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '6z', tsumokiri: false },
            { tile: '2z', tsumokiri: false },
            { tile: '8m', tsumokiri: true },
            { tile: '9s', tsumokiri: false },
            { tile: '1p', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['4m', '7m'],
      hand: ['3m', '4m', '5m', '5m', '6m', '2s', '3s', '4s', '2s', '2s'],
      explanation:
        '5m・6mの両面待ちです。4mで3m-4m-5m・4mが来た方が完成、7mで5m-6m-7mの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 東（1z）をポン → 役牌確定、即テンパイを目指している\n' +
        '② ポン後に9m・8pと端牌を切り → マンズ・ピンズの端不要 = 中張が揃っている\n' +
        '③ 1pを切り → ピンズの端も不要\n' +
        '④ 捨て牌にマンズ中張（2m〜8m）が4m・5m・6m・7mの範囲で出ていない → その付近が残っている\n\n' +
        '実際の手牌：東東東（ポン）+ 3m4m5m（面子）+ 5m6m（待ち）+ 2s3s4s（面子）+ 2s2s（雀頭）\n' +
        'ドラ表示牌6p → ドラ7p。手牌にドラはないが、役牌（東）＋副露テンパイで十分な打点です。',
    },
  },

  {
    id: 't005',
    title: 'リーチ宣言牌から待ちを逆算する',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '天鳳位',
    sourceMeta: {
      round: '南1局',
      honba: 0,
      kyotaku: 0,
      seatWind: '東',
      roundWind: '南',
    },
    difficulty: 'intermediate',
    tags: ['両面待ち', 'リーチ', '宣言牌逆算', 'ドラ絡み'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '3z', tsumokiri: false },
        { tile: '9s', tsumokiri: false },
        { tile: '1s', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
        { tile: '6m', tsumokiri: false }, // リーチ宣言牌
        { tile: '3s', tsumokiri: true },
        { tile: '7p', tsumokiri: true },
      ],
      melds: [],
      riichiState: true,
      riichiTurn: 7,
      turn: 9,
      doraIndicators: ['8m'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '3z', tsumokiri: false },
            { tile: '4z', tsumokiri: false },
            { tile: '7m', tsumokiri: true },
            { tile: '9s', tsumokiri: false },
            { tile: '2p', tsumokiri: true },
            { tile: '8m', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '5z', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '8p', tsumokiri: true },
            { tile: '9m', tsumokiri: true },
            { tile: '3m', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '2z', tsumokiri: false },
            { tile: '6z', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '1s', tsumokiri: true },
            { tile: '7z', tsumokiri: false },
            { tile: '5z', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['4p', '7p'],
      hand: ['1m', '2m', '3m', '7m', '8m', '9m', '2p', '3p', '4p', '5p', '6p', '4s', '4s'],
      explanation:
        '5p・6pの両面待ちです。4pで2p-3p-4p・5p-6p、7pで5p-6p-7pの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 字牌・ソーズ端・ピンズ端を整理 → タンヤオ寄りの中張重視の手\n' +
        '② 6mを切ってリーチ宣言 → 6mが余剰になった = 6mの周辺（4m5m・7m8m9m）が既に面子として完成\n' +
        '③ 6mを切ったということは「1m2m3m + 7m8m9m」の2面子がマンズで確定していると読める\n' +
        '④ マンズ2面子が確定 + ソーズ端を切り続けている = 残りはピンズに待ちがある\n\n' +
        '実際の手牌：1m2m3m + 7m8m9m + 2p3p4p + 5p6p（待ち）+ 4s4s（雀頭）\n' +
        'ドラ表示牌8m → ドラ9m。7m8m9mに9mが含まれており、リーチ+ドラ1 = 打点十分です。',
    },
  },

  {
    id: 't006',
    title: 'チー後の捨て牌から待ちを絞る',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '東2局',
      honba: 0,
      kyotaku: 0,
      seatWind: '南',
      roundWind: '東',
    },
    difficulty: 'intermediate',
    tags: ['副露', '両面待ち', 'チー', '副露後読み'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
        { tile: '8p', tsumokiri: false },
        { tile: '7m', tsumokiri: false }, // after chi
        { tile: '8m', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '1p', tsumokiri: false },
      ],
      melds: [{ type: 'chi', tiles: ['3m', '4m', '5m'] }],
      riichiState: false,
      turn: 9,
      doraIndicators: ['5s'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '3m', tsumokiri: false },
            { tile: '8m', tsumokiri: true },
            { tile: '5z', tsumokiri: false },
            { tile: '7p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '4z', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '9m', tsumokiri: true },
            { tile: '6m', tsumokiri: false },
            { tile: '2z', tsumokiri: true },
            { tile: '8s', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '7z', tsumokiri: false },
            { tile: '3z', tsumokiri: false },
            { tile: '1s', tsumokiri: false },
            { tile: '9p', tsumokiri: true },
            { tile: '6z', tsumokiri: false },
            { tile: '4m', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['3s', '6s'],
      hand: ['6p', '7p', '8p', '3p', '4p', '5p', '4s', '5s', '2s', '2s'],
      explanation:
        '4s・5sの両面待ちです。3sで3s-4s-5s、6sで4s-5s-6sの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① チー（3m4m5m）で上家のマンズ牌を使って速攻面子確定\n' +
        '② チー後に7m・8m・9mを連続して切り → マンズ上位が全て不要 = 345m面子以外のマンズは持っていない\n' +
        '③ 9p・8pと端ピンズを早期に切り → ピンズ端不要\n' +
        '④ 1pを切り → ピンズ端不要確認。ピンズ中張（6p7p8p・3p4p5p付近）が残っている可能性\n' +
        '⑤ 捨て牌にソーズ中張（3s〜7s）が1枚も出ていない → ソーズ中張が複数残っている\n\n' +
        '実際の手牌：345m（チー）+ 6p7p8p + 3p4p5p + 4s5s（待ち）+ 2s2s（雀頭）\n' +
        'ドラ表示牌5s → ドラ6s。6sが待ち牌の一方なので、6s上がりにはドラ1がつきます。',
    },
  },

  // ─── 上級 ───────────────────────────────────────────────────────────────

  {
    id: 't007',
    title: '混一色のシャンポンをダマで構える',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '天鳳位',
    sourceMeta: {
      round: '南3局',
      honba: 0,
      kyotaku: 0,
      seatWind: '西',
      roundWind: '南',
    },
    difficulty: 'advanced',
    tags: ['シャンポン待ち', '混一色', '役牌', 'ダマテン', '染め手読み'],
    visibleInfo: {
      discards: [
        { tile: '3m', tsumokiri: false },
        { tile: '6m', tsumokiri: false },
        { tile: '5m', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '1s', tsumokiri: false },
        { tile: '3s', tsumokiri: false },
        { tile: '4s', tsumokiri: false },
        { tile: '8s', tsumokiri: false },
        { tile: '7m', tsumokiri: true },
        { tile: '2m', tsumokiri: true },
      ],
      melds: [],
      riichiState: false,
      turn: 14,
      doraIndicators: ['6p'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '9m', tsumokiri: false },
            { tile: '8p', tsumokiri: false },
            { tile: '3s', tsumokiri: false },
            { tile: '5m', tsumokiri: true },
            { tile: '7p', tsumokiri: true },
            { tile: '2p', tsumokiri: false },
            { tile: '6p', tsumokiri: true },
            { tile: '4m', tsumokiri: true },
          ],
          melds: [],
          riichiState: true,
          riichiTurn: 8,
        },
        {
          seat: '対面',
          discards: [
            { tile: '4z', tsumokiri: false },
            { tile: '2z', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '8m', tsumokiri: true },
            { tile: '5s', tsumokiri: false },
            { tile: '7s', tsumokiri: true },
            { tile: '9s', tsumokiri: true },
            { tile: '2m', tsumokiri: false },
            { tile: '4p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '7z', tsumokiri: false },
            { tile: '3z', tsumokiri: false },
            { tile: '1p', tsumokiri: false },
            { tile: '9m', tsumokiri: true },
            { tile: '6s', tsumokiri: false },
            { tile: '1s', tsumokiri: false },
            { tile: '8p', tsumokiri: true },
            { tile: '4m', tsumokiri: false },
            { tile: '5p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['5z', '6z'],
      hand: ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '5z', '5z', '6z', '6z'],
      explanation:
        '5z（白）と6z（發）のシャンポン（双碰）待ちです。どちらが来ても役牌の刻子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 捨て牌がマンズ（3m・6m・5m・9m・7m・2m）とソーズ（1s・3s・4s・8s）のみ → ピンズが1枚も出ていない！\n' +
        '② リーチなし（ダマテン）+ ピンズ+字牌系 = 混一色（ホンイツ）のダマテンが有力\n' +
        '③ ピンズ123・456・789の3面子が完成していると推測できる\n' +
        '④ 残り4枚 = 字牌2対子 → 役牌シャンポンのダマテン\n' +
        '⑤ リーチをかけないのは、シャンポンの両方が役牌で役有りのため\n\n' +
        '実際の手牌：1p2p3p + 4p5p6p + 7p8p9p + 5z5z + 6z6z（シャンポン待ち）\n' +
        'ドラ表示牌6p → ドラ7p。7p8p9pに7pが含まれており、ドラ1。\n' +
        '混一色+白または發+ドラ1 = 跳満以上の高打点をダマで構えている怖い局面です。',
    },
  },

  {
    id: 't008',
    title: '三副露からドラ単騎を読む',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '七段戦',
    sourceMeta: {
      round: '東1局',
      honba: 0,
      kyotaku: 0,
      seatWind: '南',
      roundWind: '東',
    },
    difficulty: 'advanced',
    tags: ['単騎待ち', '副露複数', 'ドラ読み', '三副露'],
    visibleInfo: {
      discards: [
        { tile: '7m', tsumokiri: false },
        { tile: '2m', tsumokiri: false },
        { tile: '1s', tsumokiri: false }, // after 1st pon
        { tile: '9s', tsumokiri: false }, // after chi
        { tile: '5p', tsumokiri: false }, // after 2nd pon
      ],
      melds: [
        { type: 'pon', tiles: ['3z', '3z', '3z'] },
        { type: 'chi', tiles: ['4p', '5p', '6p'] },
        { type: 'pon', tiles: ['8s', '8s', '8s'] },
      ],
      riichiState: false,
      turn: 12,
      doraIndicators: ['5m'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '7m', tsumokiri: false },
            { tile: '3s', tsumokiri: true },
            { tile: '9p', tsumokiri: false },
            { tile: '2m', tsumokiri: false },
            { tile: '4p', tsumokiri: true },
            { tile: '8m', tsumokiri: true },
            { tile: '5p', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '対面',
          discards: [
            { tile: '3z', tsumokiri: false },
            { tile: '9m', tsumokiri: false },
            { tile: '1m', tsumokiri: true },
            { tile: '6p', tsumokiri: false },
            { tile: '4z', tsumokiri: false },
            { tile: '7p', tsumokiri: true },
            { tile: '2s', tsumokiri: false },
            { tile: '8p', tsumokiri: true },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '7z', tsumokiri: false },
            { tile: '2z', tsumokiri: false },
            { tile: '9s', tsumokiri: true },
            { tile: '1p', tsumokiri: false },
            { tile: '5z', tsumokiri: false },
            { tile: '3m', tsumokiri: true },
            { tile: '8s', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['6m'],
      hand: ['3m', '4m', '5m', '6m'],
      explanation:
        '6m（ドラ！）の単騎待ちです。6mが来れば3m4m5m面子+6m6m雀頭で完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 三副露（西ポン・456pチー・8sポン）→ 残り閉じ手は4枚のみ\n' +
        '② 4枚の構成：「面子（3枚）+ 単騎（1枚）」か「対子（2枚）+ 対子（2枚）シャンポン」\n' +
        '③ ここが重要：ドラ表示牌5m → ドラ6m。捨て牌に6mが1枚も出ていない！\n' +
        '④ 上位局でドラを自分で使い切る確率は高い → 6m単騎の可能性を強く示唆\n' +
        '⑤ 捨て牌に2mが出ており、3m4m5mを使った面子が確定的\n\n' +
        '実際の手牌：西西西（ポン）+ 456p（チー）+ 888s（ポン）+ 3m4m5m（面子）+ 6m（単騎待ち）\n' +
        '西ポン（役牌）確定で役あり。6m単騎が成功すれば、ドラを活用した効率的な副露テンパイです。',
    },
  },

  {
    id: 't009',
    title: '手出し連続・高打点リーチの絞り込み',
    category: 'kifu',
    sourceType: 'mahjongsoul',
    rankTier: '魂天',
    sourceMeta: {
      round: '東2局',
      honba: 1,
      kyotaku: 0,
      seatWind: '東',
      roundWind: '東',
    },
    difficulty: 'advanced',
    tags: ['両面待ち', 'リーチ', '手出し読み', 'タンヤオ', 'ドラ'],
    visibleInfo: {
      discards: [
        { tile: '2z', tsumokiri: false },
        { tile: '4z', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '1m', tsumokiri: false },
        { tile: '5p', tsumokiri: false },
        { tile: '8p', tsumokiri: false }, // リーチ宣言牌
        { tile: '1p', tsumokiri: true },
        { tile: '9p', tsumokiri: true },
        { tile: '4m', tsumokiri: true },
      ],
      melds: [],
      riichiState: true,
      riichiTurn: 7,
      turn: 10,
      doraIndicators: ['6s'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '9m', tsumokiri: false },
            { tile: '3z', tsumokiri: false },
            { tile: '7p', tsumokiri: false },
            { tile: '1p', tsumokiri: false },
            { tile: '8m', tsumokiri: true },
            { tile: '3m', tsumokiri: true },
          ],
          melds: [],
          riichiState: true,
          riichiTurn: 6,
        },
        {
          seat: '対面',
          discards: [
            { tile: '5z', tsumokiri: false },
            { tile: '4z', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '9p', tsumokiri: true },
            { tile: '8p', tsumokiri: false },
            { tile: '7m', tsumokiri: true },
            { tile: '3s', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
        {
          seat: '下家',
          discards: [
            { tile: '7z', tsumokiri: false },
            { tile: '2z', tsumokiri: false },
            { tile: '6z', tsumokiri: false },
            { tile: '1s', tsumokiri: false },
            { tile: '9s', tsumokiri: true },
            { tile: '2p', tsumokiri: true },
            { tile: '5m', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['3s', '6s'],
      hand: ['2m', '3m', '4m', '5m', '6m', '7m', '2p', '3p', '4p', '4s', '5s', '7s', '7s'],
      explanation:
        '4s・5sの両面待ちです。3sで3s-4s-5s、6sで4s-5s-6sの順子が完成します。\n\n' +
        '【読みのポイント】\n' +
        '① 最初に字牌（2z・4z）を手出し切り → 役牌不使用のタンヤオ系を推測\n' +
        '② 老頭牌（9m・1m）を手出し切り → 端牌不要の中張手が確実\n' +
        '③ 5pを手出し切り → ピンズ5番が不要。2p3p4pが既に面子として完成しておりピンズ5は余剰と推測\n' +
        '④ 8pを手出しでリーチ宣言 → 8pが余剰になった = 2p3p4pが面子、6p7p8pは不完全形として排除済み\n' +
        '⑤ リーチ後のツモ切り（1p・9p・4m）はテンパイ手に合わない端牌・ピンズ → テンパイ形の確認に使えない\n\n' +
        '実際の手牌：2m3m4m + 5m6m7m + 2p3p4p + 4s5s（待ち）+ 7s7s（雀頭）\n' +
        'ドラ表示牌6s → ドラ7s。7s7sが雀頭 = ドラ対子！リーチ+タンヤオ+ドラ2 = 跳満以上の超高打点です。',
    },
  },

  {
    id: 't010',
    title: 'オーラスの三面張をどこで読む',
    category: 'kifu',
    sourceType: 'tenhou',
    rankTier: '天鳳位',
    sourceMeta: {
      round: '南4局',
      honba: 0,
      kyotaku: 2,
      seatWind: '北',
      roundWind: '南',
    },
    difficulty: 'advanced',
    tags: ['三面張', '多面張', 'リーチ', 'オーラス', '供託'],
    visibleInfo: {
      discards: [
        { tile: '1z', tsumokiri: false },
        { tile: '7z', tsumokiri: false },
        { tile: '5z', tsumokiri: false },
        { tile: '6z', tsumokiri: false },
        { tile: '9m', tsumokiri: false },
        { tile: '9p', tsumokiri: false },
        { tile: '1p', tsumokiri: false },
        { tile: '2p', tsumokiri: false }, // リーチ宣言牌
        { tile: '5m', tsumokiri: true },
        { tile: '8m', tsumokiri: true },
      ],
      melds: [],
      riichiState: true,
      riichiTurn: 9,
      turn: 11,
      doraIndicators: ['6m'],
      players: [
        {
          seat: '上家',
          discards: [
            { tile: '3z', tsumokiri: false },
            { tile: '4z', tsumokiri: false },
            { tile: '9m', tsumokiri: false },
            { tile: '1s', tsumokiri: false },
            { tile: '6m', tsumokiri: false },
            { tile: '2p', tsumokiri: true },
            { tile: '8p', tsumokiri: true },
            { tile: '5p', tsumokiri: true },
          ],
          melds: [],
          riichiState: true,
          riichiTurn: 6,
        },
        {
          seat: '対面',
          discards: [
            { tile: '1z', tsumokiri: false },
            { tile: '7z', tsumokiri: false },
            { tile: '5z', tsumokiri: false },
            { tile: '4m', tsumokiri: false },
            { tile: '8m', tsumokiri: false },
            { tile: '3p', tsumokiri: true },
            { tile: '7p', tsumokiri: true },
            { tile: '1p', tsumokiri: true },
          ],
          melds: [],
          riichiState: true,
          riichiTurn: 6,
        },
        {
          seat: '下家',
          discards: [
            { tile: '2z', tsumokiri: false },
            { tile: '6z', tsumokiri: false },
            { tile: '9p', tsumokiri: false },
            { tile: '1m', tsumokiri: false },
            { tile: '8s', tsumokiri: true },
            { tile: '3s', tsumokiri: false },
            { tile: '4p', tsumokiri: true },
            { tile: '5m', tsumokiri: false },
          ],
          melds: [],
          riichiState: false,
        },
      ],
    },
    answer: {
      waits: ['3s', '6s', '9s'],
      hand: ['1m', '2m', '3m', '5m', '6m', '7m', '8m', '8m', '4s', '5s', '6s', '7s', '8s'],
      explanation:
        '4s・5s・6s・7s・8sの5連形による三面張（サンメンタン）です。3s・6s・9sの3種が待ち牌です。\n\n' +
        '3通りの解体パターン：\n' +
        '① 3sが来る → 3s4s5s + 6s7s8s の2面子完成\n' +
        '② 6sが来る → 4s5s6s + 6s7s8s の2面子完成\n' +
        '③ 9sが来る → 4s5s6s + 7s8s9s の2面子完成\n\n' +
        '【読みのポイント】\n' +
        '① 全字牌（1z・7z・5z・6z）を全て手出し切り → 字牌完全排除\n' +
        '② 老頭牌（9m・9p・1p）を手出し切り → 端牌完全排除\n' +
        '③ 2pを手出しでリーチ宣言 → ピンズが不要になった = ピンズ面子完成\n' +
        '④ 捨て牌に索子が1枚も出ていない → ソーズに複数牌が残っている！多面張の可能性大\n' +
        '⑤ リーチ後ツモ切り（5m・8m）はマンズ中上端 → 手牌にマンズ123・567が面子として確定\n\n' +
        '実際の手牌：1m2m3m + 5m6m7m + 8m8m（雀頭）+ 4s5s6s7s8s（三面張）\n' +
        'ドラ表示牌6m → ドラ7m。7mが手牌に含まれており、リーチ+ドラ1+三面張 = 最大打点の局面。\n' +
        '供託2本（8000点）もあり、オーラスの逆転に向けた天鳳位らしい鋭い一打です。',
    },
  },
]
