import { promises as fs } from 'fs'
import path from 'path'

// ─────────────────────────────────────────────────────────────
// 麻雀問題ビルダー（UIから問題集アプリ apps/mahjong へ問題を追加する）
//
// progress は同一VPS上で apps/mahjong の data/questions.json を直接編集できる。
// UI(/mahjong-builder)で「自分の手牌 + 全プレイヤーの捨て牌 + 設問」を入力し、
// ここで questions.json へ追記する。追記後、apps/mahjong を commit/push して
// TestFlight ビルドすれば反映される（ビルドはユーザー指示時に実施）。
// ─────────────────────────────────────────────────────────────

const QUESTIONS_PATH = '/root/company/apps/mahjong/data/questions.json'

export type Seat = 'self' | 'shimocha' | 'toimen' | 'kamicha'
export const SEATS: Seat[] = ['self', 'shimocha', 'toimen', 'kamicha']
export const SEAT_LABEL: Record<Seat, string> = {
  self: '自分', shimocha: '下家', toimen: '対面', kamicha: '上家',
}
export const SEAT_WIND: Record<Seat, string> = {
  self: '東', shimocha: '南', toimen: '西', kamicha: '北',
}

// 入力可能な牌（赤5は扱わない。questions.json は素の牌文字列）
export const TILE_GROUPS: { name: string; tiles: string[] }[] = [
  { name: '萬子', tiles: ['1萬', '2萬', '3萬', '4萬', '5萬', '6萬', '7萬', '8萬', '9萬'] },
  { name: '筒子', tiles: ['1筒', '2筒', '3筒', '4筒', '5筒', '6筒', '7筒', '8筒', '9筒'] },
  { name: '索子', tiles: ['1索', '2索', '3索', '4索', '5索', '6索', '7索', '8索', '9索'] },
  { name: '字牌', tiles: ['東', '南', '西', '北', '白', '発', '中'] },
]
const ALL_TILES = new Set(TILE_GROUPS.flatMap((g) => g.tiles))

export interface BuilderInput {
  title: string
  question: string
  explanation: string
  choices: { key: string; label: string }[]
  answer: string
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
  bakaze?: string
  kyoku?: number
  dora?: string[]
  hand: string[]                        // 自分の手牌
  discards: Record<Seat, string[]>      // 各家の捨て牌（切った順）
  notes?: string
}

interface Question {
  id: string
  title: string
  question: string
  choices: { key: string; label: string }[]
  answer: string
  explanation: string
  tags?: string[]
  difficulty?: string
  situation?: unknown
  createdVia?: string
  notes?: string
}

async function readQuestions(): Promise<Question[]> {
  const raw = await fs.readFile(QUESTIONS_PATH, 'utf-8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('questions.json is not an array')
  return data as Question[]
}

export async function countQuestions(): Promise<number> {
  try {
    return (await readQuestions()).length
  } catch {
    return 0
  }
}

function nextId(existing: Question[]): string {
  let max = 0
  for (const q of existing) {
    const m = String(q.id ?? '').match(/^q(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `q${String(max + 1).padStart(3, '0')}`
}

export function validateInput(input: BuilderInput): string[] {
  const errors: string[] = []
  if (!input.title?.trim()) errors.push('タイトルが必要です')
  if (!input.question?.trim()) errors.push('問題文が必要です')
  if (!input.explanation?.trim()) errors.push('解説が必要です')

  const choices = (input.choices ?? []).filter((c) => c.label?.trim())
  if (choices.length < 2) errors.push('選択肢は2つ以上必要です')
  if (!input.answer?.trim()) errors.push('正解を選んでください')
  else if (!choices.some((c) => c.key === input.answer)) errors.push('正解が選択肢に含まれていません')

  const hand = input.hand ?? []
  if (hand.length < 1) errors.push('自分の手牌を入力してください')
  if (hand.length > 14) errors.push('手牌が多すぎます（最大14枚）')
  for (const t of hand) if (!ALL_TILES.has(t)) errors.push(`不正な牌: ${t}`)

  for (const seat of SEATS) {
    for (const t of input.discards?.[seat] ?? []) {
      if (!ALL_TILES.has(t)) errors.push(`不正な捨て牌(${SEAT_LABEL[seat]}): ${t}`)
    }
  }
  for (const t of input.dora ?? []) if (!ALL_TILES.has(t)) errors.push(`不正なドラ: ${t}`)
  return errors
}

function buildSituation(input: BuilderInput) {
  const mkDiscards = (tiles: string[]) =>
    tiles.map((tile, i) => ({ tile, type: 'tedashi' as const, turn: i + 1 }))

  const players: Record<string, unknown> = {}
  for (const seat of SEATS) {
    const p: Record<string, unknown> = {
      seat: SEAT_WIND[seat],
      discards: mkDiscards(input.discards?.[seat] ?? []),
      melds: [],
      riichi: false,
    }
    if (seat === 'self') p.hand = [...input.hand]
    players[seat] = p
  }

  return {
    round: { bakaze: input.bakaze || '東', kyoku: input.kyoku || 1, honba: 0, kyotaku: 0 },
    dora: input.dora ?? [],
    turn: Math.max(...SEATS.map((s) => (input.discards?.[s]?.length ?? 0)), 1),
    scores: { self: 25000, shimocha: 25000, toimen: 25000, kamicha: 25000 },
    players,
  }
}

export async function appendQuestion(input: BuilderInput): Promise<{ id: string; total: number }> {
  const errors = validateInput(input)
  if (errors.length) throw new Error(errors.join(' / '))

  const existing = await readQuestions()
  const id = nextId(existing)
  const q: Question = {
    id,
    title: input.title.trim(),
    question: input.question.trim(),
    choices: input.choices.filter((c) => c.label?.trim()).map((c) => ({ key: c.key, label: c.label.trim() })),
    answer: input.answer.trim(),
    explanation: input.explanation.trim(),
    ...(input.tags?.length ? { tags: input.tags } : {}),
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
    situation: buildSituation(input),
    createdVia: 'ui-builder',
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  }

  const updated = [...existing, q]
  // 原子的書き込み（tmp→rename）
  const tmp = QUESTIONS_PATH + `.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
  await fs.rename(tmp, QUESTIONS_PATH)
  return { id, total: updated.length }
}
