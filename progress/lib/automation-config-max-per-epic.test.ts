import './test-alias.cjs'
import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getAutomationConfig, getOperationalDecisions, updateAutomationConfig } from './operations-store.ts'
import { POST } from '../app/api/operations/automation-config/route.ts'

let dataDir: string
let previousDataPath: string | undefined

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'automation-config-max-per-epic-'))
  previousDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dataDir
})

afterEach(async () => {
  if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = previousDataPath
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('factoryMaxPerEpic: 選択値を保存して次回読込でも維持する', async () => {
  const updated = await updateAutomationConfig({ factoryMaxPerEpic: 1 })
  const reloaded = await getAutomationConfig()

  assert.equal(updated.factoryMaxPerEpic, 1)
  assert.equal(reloaded.factoryMaxPerEpic, 1)
})

test('factoryMaxPerEpic: 旧設定に値がなくても複数Epicを回す既定1を補完する', async () => {
  await fs.writeFile(
    path.join(dataDir, 'automation-config.json'),
    JSON.stringify({ factoryEnabled: true }),
    'utf-8',
  )

  const config = await getAutomationConfig()

  assert.equal(config.factoryMaxPerEpic, 1)
})

test('factoryMaxPerEpic: 旧設定の不正値も複数Epicを回す既定1へ正規化する', async () => {
  await fs.writeFile(
    path.join(dataDir, 'automation-config.json'),
    JSON.stringify({ factoryEnabled: true, factoryMaxPerEpic: 'invalid' }),
    'utf-8',
  )

  const config = await getAutomationConfig()

  assert.equal(config.factoryMaxPerEpic, 1)
})

test('factoryMaxPerEpic: 範囲外の保存値を1〜3へ制限する', async () => {
  assert.equal((await updateAutomationConfig({ factoryMaxPerEpic: 0 })).factoryMaxPerEpic, 1)
  assert.equal((await updateAutomationConfig({ factoryMaxPerEpic: 9 })).factoryMaxPerEpic, 3)
})

test('factoryMaxPerEpic: 小数入力は指定より深掘りしないよう切り捨てる', async () => {
  assert.equal((await updateAutomationConfig({ factoryMaxPerEpic: 2.9 })).factoryMaxPerEpic, 2)
})

test('factoryMaxPerEpic: 実際に値が変わった時だけ旧値と新値を運用判断ログへ残す', async () => {
  await updateAutomationConfig({ factoryMaxPerEpic: 3 })
  await updateAutomationConfig({ factoryMaxPerEpic: 3 })

  const decisions = await getOperationalDecisions()

  assert.equal(decisions.length, 1)
  assert.equal(decisions[0]?.action, 'factory_max_per_epic_change')
  assert.equal(decisions[0]?.topic, 'Factory 同一Epic深掘り上限変更')
  assert.equal(decisions[0]?.decision, 'factoryMaxPerEpic=1→3')
})

test('automation-config API: factoryMaxPerEpicを保存してレスポンスへ返す', async () => {
  const response = await POST(new Request('http://localhost/api/operations/automation-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factoryMaxPerEpic: 1 }),
  }))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.factoryMaxPerEpic, 1)
  assert.equal((await getAutomationConfig()).factoryMaxPerEpic, 1)
})

test('automation-config API: 小数値は指定以上に深掘りしないよう切り捨てて返す', async () => {
  const response = await POST(new Request('http://localhost/api/operations/automation-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factoryMaxPerEpic: 2.9 }),
  }))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.factoryMaxPerEpic, 2)
  assert.equal((await getAutomationConfig()).factoryMaxPerEpic, 2)
})

test('automation-config API: 数値以外では保存済みfactoryMaxPerEpicを変更しない', async () => {
  await updateAutomationConfig({ factoryMaxPerEpic: 2 })

  const response = await POST(new Request('http://localhost/api/operations/automation-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factoryMaxPerEpic: '1' }),
  }))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.factoryMaxPerEpic, 2)
  assert.equal((await getAutomationConfig()).factoryMaxPerEpic, 2)
})

test('Automation設定UI: 深掘り回数の選択状態を支援技術へ伝える', () => {
  const source = fsSync.readFileSync(
    path.join(process.cwd(), 'app/automation/page.tsx'),
    'utf-8',
  )

  assert.match(source, /aria-pressed=\{\(config\?\.factoryMaxPerEpic \?\? 1\) === n\}/)
  assert.match(source, /aria-label=\{`同一Epicの深掘り上限を\$\{n\}回にする`\}/)
  assert.match(source, /role="status" aria-live="polite"/)
  assert.match(source, /現在: 1回ごとに次のEpicへ進みます/)
  assert.match(source, /現在: 同じEpicを最大\$\{config\?\.factoryMaxPerEpic \?\? 1\}回続けます/)
})

test('Automation設定UI: 設定読込前もrunnerと同じ既定1を表示する', () => {
  const source = fsSync.readFileSync(
    path.join(process.cwd(), 'app/automation/page.tsx'),
    'utf-8',
  )

  assert.doesNotMatch(source, /factoryMaxPerEpic \?\? 3/)
  assert.equal(source.match(/factoryMaxPerEpic \?\? 1/g)?.length, 4)
  assert.match(source, /1=毎回ちがうEpicへ（既定） \/ 3=同じEpicを最大3回/)
})

test('Automation設定UI: 許可値1〜3だけを選択肢として保存APIへ渡す', () => {
  const source = fsSync.readFileSync(
    path.join(process.cwd(), 'app/automation/page.tsx'),
    'utf-8',
  )

  assert.match(source, /\{\(\[1, 2, 3\] as const\)\.map\(\(n\) =>/)
  assert.match(source, /onClick=\{\(\) => patchConfig\(\{ factoryMaxPerEpic: n \}\)\}/)
  assert.equal(source.match(/patchConfig\(\{ factoryMaxPerEpic:/g)?.length, 1)
})

test('Automation設定UI: 保存失敗時は現在値を壊さず再試行を案内する', () => {
  const source = fsSync.readFileSync(
    path.join(process.cwd(), 'app/automation/page.tsx'),
    'utf-8',
  )

  assert.match(source, /if \(!res\.ok\) throw new Error/)
  assert.match(source, /setConfig\(updated\)/)
  assert.match(source, /設定を保存しました/)
  assert.match(source, /設定を保存できませんでした。もう一度お試しください/)
})
