import { readJson, writeJson } from '@/lib/store'

// ─────────────────────────────────────────────────────────────
// 【一時ページ】麻雀問題（手牌読みドリル由来）の未確定箇所を人間が確定する
//
// apps/mahjong の data/questions.json へ q037〜 を取り込む際、本の写真から
// 牌の絵柄が判読しきれなかった箇所がある。ここで正しいものを選んでもらい、
// Claude Code が questions.json へ反映して needsReview を外す。
//
// 取り込みが終わったら、このページ・API・lib・データファイルごと削除してよい。
// ─────────────────────────────────────────────────────────────

const FILE = 'mahjong-question-confirmations.json'

export interface ConfirmOption {
  value: string
  label: string
  /** 補足（なぜ迷っているか等） */
  hint?: string
}

export interface ConfirmItem {
  id: string
  questionId: string
  questionTitle: string
  /** 何を決めてほしいか */
  ask: string
  /** 判断に影響する範囲（正解に響くのか、盤面表示だけなのか） */
  impact: string
  options: ConfirmOption[]
  /** 自由記入を許すか */
  allowFreeText: boolean
}

export interface ConfirmAnswer {
  itemId: string
  /** options の value。自由記入のときは '__other__' */
  value: string
  freeText?: string
  answeredAt: string
}

export interface ConfirmStore {
  updatedAt: string
  answers: ConfirmAnswer[]
}

const EMPTY: ConfirmStore = { updatedAt: '', answers: [] }

/** 確定してほしい項目。取り込み完了まではここを直接編集して増やす。 */
export const CONFIRM_ITEMS: ConfirmItem[] = [
  {
    id: 'q037-sou',
    questionId: 'q037',
    questionTitle: '手牌読み① 3→1切りに5は愚形で当たらない',
    ask: '自分手牌の索子の並びはどちらですか？',
    impact: '盤面表示のみ。正解（打5筒）には影響しません',
    options: [
      { value: '1索 3索 5索 8索 9索', label: '1索 3索 5索 8索 9索', hint: '現在この並びで登録済み' },
      { value: '1索 3索 5索 9索 8索', label: '1索 3索 5索 9索 8索', hint: '8索と9索が逆' },
    ],
    allowFreeText: true,
  },
  {
    id: 'q040-sou',
    questionId: 'q040',
    questionTitle: '手牌読み④ 宣言牌前に切られたドラの外側はセーフティ',
    ask: '自分手牌の索子4枚は何ですか？',
    impact: '盤面表示のみ。正解（打一萬）には影響しません',
    options: [
      { value: '2索 3索 4索 5索', label: '2索 3索 4索 5索', hint: '現在この並びで登録済み' },
    ],
    allowFreeText: true,
  },
  {
    id: 'q041-tile',
    questionId: 'q041',
    questionTitle: '手牌読み⑤ チー前の形を戻せば通る牌が見える',
    ask: '正解の牌はどちらですか？',
    impact: '正解の表記に影響します',
    options: [
      { value: '5萬', label: '5萬', hint: '本文の「伍萬」を通常の5萬と解釈' },
      { value: '赤5萬', label: '赤5萬', hint: '「伍萬」が赤ドラ表記の場合' },
    ],
    allowFreeText: true,
  },
  {
    id: 'q044-tile',
    questionId: 'q044',
    questionTitle: '手牌読み⑧ 1→不要牌→2の切り出しは4を持っている',
    ask: '正解の牌は3筒で合っていますか？',
    impact: '正解そのものに影響します',
    options: [
      { value: '3筒', label: '3筒で合っている', hint: '解説の流れとは一致。解答ボックスの牌が小さく未確定' },
    ],
    allowFreeText: true,
  },
  {
    id: 'choices-policy',
    questionId: 'q039,q041,q042,q043,q044',
    questionTitle: '（共通）不正解側の選択肢の扱い',
    ask: '正解以外のダミー選択肢は、こちらで組んだ内容のままでよいですか？',
    impact: '正解の選択肢はすべて確認済みです。ここは不正解側の表記だけの話です',
    options: [
      { value: 'as-is', label: 'そのままでよい' },
      { value: 'fix', label: '直したい（内容を書きます）' },
    ],
    allowFreeText: true,
  },
]

export async function readConfirmStore(): Promise<ConfirmStore> {
  const store = await readJson<ConfirmStore>(FILE, EMPTY)
  return { updatedAt: store.updatedAt ?? '', answers: Array.isArray(store.answers) ? store.answers : [] }
}

export async function saveAnswers(input: Array<{ itemId: string; value: string; freeText?: string }>): Promise<ConfirmStore> {
  const known = new Set(CONFIRM_ITEMS.map((i) => i.id))
  const now = new Date().toISOString()
  const store = await readConfirmStore()
  const byId = new Map(store.answers.map((a) => [a.itemId, a]))

  for (const entry of input) {
    if (!known.has(entry.itemId)) continue
    if (!entry.value?.trim()) {
      byId.delete(entry.itemId)
      continue
    }
    byId.set(entry.itemId, {
      itemId: entry.itemId,
      value: entry.value.trim(),
      freeText: entry.freeText?.trim() || undefined,
      answeredAt: now,
    })
  }

  const next: ConfirmStore = { updatedAt: now, answers: Array.from(byId.values()) }
  await writeJson(FILE, next)
  return next
}
