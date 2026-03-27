import { QuizQuestion } from '@/lib/types'

export const basicQuestions: QuizQuestion[] = [
  // ─── 初級 ───────────────────────────────────────────────────────────────

  {
    id: 'q001',
    title: '教科書的な両面待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    hand: ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','1p','3s','4s'],
    discards: ['9p','8p','7z','4z','3z'],
    melds: [],
    turn: 8,
    doraIndicators: ['3p'],
    riichiState: true,
    waits: ['2s', '5s'],
    difficulty: 'beginner',
    tags: ['両面待ち', 'リーチ', '清一色まがい'],
    explanation:
      '3s・4sの両面（リャンメン）待ちです。2sが来れば2s-3s-4sの順子、5sが来れば3s-4s-5sの順子が完成します。\n\n' +
      '1m〜9mで3面子（123m・456m・789m）、1p・1pが雀頭として揃っており、待ちは純粋な両面テンパイです。' +
      '有効牌は2sと5sの計最大8枚（実際は場にある牌を引いた枚数）。\n\n' +
      'リーチ後は流局まで変更できないため、テンパイ形を正確に把握することが重要です。',
  },

  {
    id: 'q002',
    title: '字牌雀頭の両面待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '六段〜天鳳位想定',
    hand: ['2p','3p','4p','5p','6p','7p','8p','9p','1s','2s','3s','7z','7z'],
    discards: ['1m','9m','4z','2z','6m'],
    melds: [],
    turn: 10,
    doraIndicators: ['5p'],
    riichiState: false,
    waits: ['1p', '4p'],
    difficulty: 'beginner',
    tags: ['両面待ち', '字牌雀頭'],
    explanation:
      '2p・3pの両面待ちです。1pが来れば1p-2p-3pの順子、4pが来れば2p-3p-4pの順子が完成します。\n\n' +
      '4p・5p・6pと7p・8p・9pで2面子、1s・2s・3sで1面子、7z・7zが雀頭として確定しています。' +
      'ドラが6pのため（ドラ表示牌が5p→ドラは6p）、この手はドラ1がついています。\n\n' +
      '字牌を雀頭にすることで、数牌の受け入れを最大化するのは上位層でよく見られる手組みです。',
  },

  {
    id: 'q003',
    title: 'ペンチャン待ちの見分け方',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '五段〜八段想定',
    hand: ['1m','2m','4m','5m','6m','7m','8m','9m','2p','3p','4p','5s','5s'],
    discards: ['1z','2z','3z','9p','8p'],
    melds: [],
    turn: 9,
    doraIndicators: ['2s'],
    riichiState: true,
    waits: ['3m'],
    difficulty: 'beginner',
    tags: ['ペンチャン待ち', 'リーチ', '端牌'],
    explanation:
      '1m・2mのペンチャン（辺張）待ちで、3mのみが待ち牌です。\n\n' +
      '「1-2」という形は、1の下（0）が存在しないため片面にしか待てません。3mが来ることで1m-2m-3mが完成します。' +
      '「両面待ちは3m・6m」と思いがちですが、1mが端牌のため6mは当たりません。\n\n' +
      '456m・789mで2面子、234pで1面子、5s・5sが雀頭。' +
      'ペンチャン待ちは有効牌が最大4枚と少ないですが、高打点の場合はリーチが有効なことも多いです。',
  },

  // ─── 中級 ───────────────────────────────────────────────────────────────

  {
    id: 'q004',
    title: '間に挟まったカンチャン待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '六段〜天鳳位想定',
    hand: ['1m','1m','2m','4m','5m','6m','7m','1p','2p','3p','4p','5p','6p'],
    discards: ['9s','8s','7s','4z','1z'],
    melds: [],
    turn: 7,
    doraIndicators: ['9m'],
    riichiState: true,
    waits: ['3m'],
    difficulty: 'intermediate',
    tags: ['カンチャン待ち', 'リーチ', '中間牌'],
    explanation:
      '2m・4mのカンチャン（嵌張）待ちで、間の3mが来て2m-3m-4mが完成します。\n\n' +
      '1m・1mが雀頭、5m・6m・7mで1面子、123p・456pで2面子として確定。' +
      '残った2m・4mの「嵌め」が待ちとなります。\n\n' +
      'カンチャンの3mは中間牌であり、他家からも比較的切られやすい牌です。' +
      '上位局ではカンチャンでも高打点・有利な状況なら即リーチが優秀な選択肢になります。' +
      '有効牌は3mのみの最大4枚。',
  },

  {
    id: 'q005',
    title: '役牌シャンポン待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    hand: ['1m','2m','3m','4m','5m','6m','7m','8m','9m','3z','3z','7z','7z'],
    discards: ['9p','8p','9s','8s','1p'],
    melds: [],
    turn: 11,
    doraIndicators: ['4p'],
    riichiState: false,
    waits: ['3z', '7z'],
    difficulty: 'intermediate',
    tags: ['シャンポン待ち', '役牌', '選択'],
    explanation:
      '3z（西）と7z（中）のシャンポン（双碰）待ちです。どちらの牌が来ても、一方が雀頭・他方が刻子となり上がれます。\n\n' +
      '1m〜9mで3面子（123m・456m・789m）が確定しており、3z・3zと7z・7zの対子が残っています。\n\n' +
      '7z（中）は役牌なので、中で上がればチュンの役（役牌：中）がつきます。西家であれば3z（西）にも役がつきます。' +
      'シャンポン待ちは両方の牌が当たるため有効牌が最大8枚ですが、' +
      'どちらで上がるかによって手役・打点が変わる点が上位局での判断を難しくします。',
  },

  {
    id: 'q006',
    title: '4面子完成の単騎待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '六段〜天鳳位想定',
    hand: ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','9p'],
    discards: ['7z','6z','5z','4z','2z'],
    melds: [],
    turn: 12,
    doraIndicators: ['8p'],
    riichiState: false,
    waits: ['9p'],
    difficulty: 'intermediate',
    tags: ['単騎待ち', '端牌', 'タンピン'],
    explanation:
      '4面子（123m・456m・789m・123s）がすでに完成しており、9pの対子待ち（単騎＝孤独な1枚待ち）です。\n\n' +
      '9pが来ることで9p・9pの雀頭が完成し上がれます。' +
      '9pはヤオ九牌（端牌）なので、他家が重ねずに切ることが多く、比較的出やすい牌です。\n\n' +
      '有効牌は9pのみ（最大3枚）。タンヤオがつかないなどのデメリットもありますが、' +
      'テンパイの形が整っており、リーチをかけることで裏ドラ・一発も狙えます。',
  },

  {
    id: 'q007',
    title: 'ノベタン待ちの基本形',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    hand: ['1m','2m','3m','4m','5p','6p','7p','2s','3s','4s','6s','7s','8s'],
    discards: ['1z','9m','8m','7m','9p'],
    melds: [],
    turn: 9,
    doraIndicators: ['3m'],
    riichiState: true,
    waits: ['1m', '4m'],
    difficulty: 'intermediate',
    tags: ['ノベタン待ち', 'リーチ', '2面待ち'],
    explanation:
      '1m・2m・3m・4mの4連形（ノベタン）です。両端の1mと4mが待ち牌です。\n\n' +
      '1mが来ると「1m1m（雀頭）＋2m3m4m（順子）」、4mが来ると「1m2m3m（順子）＋4m4m（雀頭）」という' +
      '2通りの完成形があります。頭の位置が変わるのがノベタンの特徴です。\n\n' +
      '567p・234s・678sで3面子が確定。ドラ表示牌が3mのためドラは4m。' +
      '4m待ちで上がれば、ドラ1がつきます。有効牌は1m・4m合わせて最大8枚（実際は場の状況次第）。',
  },

  // ─── 上級 ───────────────────────────────────────────────────────────────

  {
    id: 'q008',
    title: '5連形の三面張',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '八段〜天鳳位想定',
    hand: ['3m','4m','5m','6m','7m','1p','2p','3p','4p','5p','6p','9s','9s'],
    discards: ['1z','2z','3z','9m','8m'],
    melds: [],
    turn: 8,
    doraIndicators: ['6m'],
    riichiState: true,
    waits: ['2m', '5m', '8m'],
    difficulty: 'advanced',
    tags: ['三面張', '多面張', '5連形'],
    explanation:
      '3m・4m・5m・6m・7mの5連形から生まれる三面張（サンメンタン）です。\n\n' +
      '解体パターンは3通りあります：\n' +
      '① 2mが来る→「2m3m4m（順子）＋5m6m7m（順子）」\n' +
      '② 5mが来る→「3m4m5m（順子）＋5m6m7m（順子）」\n' +
      '③ 8mが来る→「3m4m5m（順子）＋6m7m8m（順子）」\n\n' +
      '123p・456pで2面子、9s・9sが雀頭。ドラが7m（表示牌6m→ドラ7m）なので、' +
      '三面張の中でも7mを含む形で上がれると高打点になります。' +
      '中間牌の5mは2パターンにまたがるため最も見落としやすく、上級者を識別する典型問題です。',
  },

  {
    id: 'q009',
    title: '七対子の単騎待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '七段〜天鳳位想定',
    hand: ['2m','2m','4m','4m','6m','6m','8m','8m','2p','2p','4p','4p','6p'],
    discards: ['9s','7s','5s','3s','1s'],
    melds: [],
    turn: 13,
    doraIndicators: ['5m'],
    riichiState: false,
    waits: ['6p'],
    difficulty: 'advanced',
    tags: ['七対子', '単騎待ち', '特殊役'],
    explanation:
      '6対子（2m・4m・6m・8m・2p・4p）が完成しており、7枚目の対子である6pの単騎待ちです。\n\n' +
      '七対子（チートイツ）は7組の対子で構成される特殊な役。6pが来ることで7対子が完成します。\n\n' +
      'この手牌が通常の4面子1雀頭では上がれないことを確認しましょう。' +
      '全て異なる対子（2m2m・4m4m・6m6m・8m8m・2p2p・4p4p）で構成されているため、' +
      '刻子には変換できず、順子も組めません。純粋な七対子テンパイです。\n\n' +
      '七対子はハネ満（跳満）になる場合もあり、上位局でも強力な手役の一つです。',
  },

  {
    id: 'q010',
    title: '暗刻含みの複合待ち',
    category: 'basic',
    sourceType: 'manual',
    rankTier: '八段〜天鳳位想定',
    hand: ['1m','1m','2m','3m','4m','6p','7p','8p','2s','3s','4s','9z','9z'],
    discards: ['5m','6m','7m','8m','9m'],
    melds: [],
    turn: 10,
    doraIndicators: ['3s'],
    riichiState: false,
    waits: ['1m', '9z'],
    difficulty: 'advanced',
    tags: ['複合待ち', '暗刻', 'シャンポン変形', '見落とし注意'],
    explanation:
      '一見「1m1m（雀頭）＋2m3m4m（順子）＋678p＋234s＋9z9z待ち」に見えますが、実は1mも待ち牌です。\n\n' +
      '2通りの完成形があります：\n' +
      '① 9zが来る→「1m1m（雀頭）＋2m3m4m（順子）＋678p＋234s＋9z9z9z（暗刻）」\n' +
      '② 1mが来る→「1m1m1m（暗刻）＋2m3m4m（順子）＋678p＋234s＋9z9z（雀頭）」\n\n' +
      '1mと9zでシャンポンのように雀頭と暗刻の役割が入れ替わります。' +
      'ドラは4s（表示牌3s→ドラ4s）。9z（北）は役牌になる可能性もあります。' +
      'このような対子＋順子から暗刻が生まれる複合待ちは、' +
      '上位局でも見落とされることがある難問です。',
  },
]
