import './test-alias.cjs'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { readGoals } from './goal-reader.ts'
import { writeGoals } from './goal-writer.ts'
import type { GoalsData } from '@/types/goal'

let dir: string
let prevDataPath: string | undefined

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'goal-store-test-'))
  prevDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
})

afterEach(async () => {
  if (prevDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = prevDataPath
  await fs.rm(dir, { recursive: true, force: true })
})

test('readGoals: goals.json 未作成なら readError なしの空データを返す', async () => {
  const data = await readGoals()
  assert.equal(data.goals.length, 0)
  assert.equal(data.readError, undefined)
})

test('readGoals: goals.json がパース不能なら readError を立てる', async () => {
  await fs.writeFile(path.join(dir, 'goals.json'), '{ broken json', 'utf-8')
  const data = await readGoals()
  assert.equal(data.goals.length, 0)
  assert.ok(data.readError?.includes('parse failed'))
})

test('writeGoals: readError 付きデータは書き込みを拒否し既存ファイルを保護する', async () => {
  const original = '{ broken json'
  const filePath = path.join(dir, 'goals.json')
  await fs.writeFile(filePath, original, 'utf-8')
  const data = await readGoals()
  await assert.rejects(() => writeGoals(data), /writeGoals refused/)
  assert.equal(await fs.readFile(filePath, 'utf-8'), original)
})

test('writeGoals: 正常データは tmp 経由で書き込まれ tmp が残らない', async () => {
  const data: GoalsData = { goals: [], mainGoalId: undefined, updatedAt: '' }
  await writeGoals(data)
  const written = JSON.parse(await fs.readFile(path.join(dir, 'goals.json'), 'utf-8'))
  assert.ok(Array.isArray(written.goals))
  assert.ok(written.updatedAt)
  const leftovers = (await fs.readdir(dir)).filter((f) => f.endsWith('.tmp'))
  assert.deepEqual(leftovers, [])
})

test('readGoals → writeGoals: 正常な goals.json は往復で保持される', async () => {
  const filePath = path.join(dir, 'goals.json')
  await fs.writeFile(filePath, JSON.stringify({
    goals: [{ id: 'goal-1', title: 'テストゴール', status: 'active' }],
    mainGoalId: 'goal-1',
    updatedAt: '2026-07-05T00:00:00.000Z',
  }), 'utf-8')
  const data = await readGoals()
  assert.equal(data.readError, undefined)
  await writeGoals(data)
  const written = JSON.parse(await fs.readFile(filePath, 'utf-8'))
  assert.equal(written.goals.length, 1)
  assert.equal(written.goals[0].id, 'goal-1')
  assert.equal(written.mainGoalId, 'goal-1')
})
