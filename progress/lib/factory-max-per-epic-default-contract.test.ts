import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8')
}

test('factoryMaxPerEpic: 既定1の契約をstore・runner・UIで一致させる', () => {
  const store = read('lib/operations-store.ts')
  const runner = read('lib/factory-runner.ts')
  const automationUi = read('app/automation/page.tsx')

  assert.match(store, /factoryMaxPerEpic:\s*1,/)
  assert.match(runner, /:\s*1\n\s*return Math\.max\(1, Math\.min\(Math\.floor\(value\), 3\)\)/)
  assert.match(automationUi, /1=毎回ちがうEpicへ（既定）/)

  assert.doesNotMatch(store, /factoryMaxPerEpic:\s*3,/)
  assert.doesNotMatch(runner, /opts\.maxPerEpic\s*\?\?[^\n]*3/)
  assert.doesNotMatch(automationUi, /factoryMaxPerEpic\s*\?\?\s*3/)
})
