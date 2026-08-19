import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('FactoryRunnerPanel: 保存済みfactoryMaxPerEpicを固定値で上書きしない', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/automation/FactoryRunnerPanel.tsx'),
    'utf-8',
  )

  const requestBody = source.match(/body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/)?.[1]

  assert.ok(requestBody, 'factory-run APIのrequest bodyが見つかること')
  assert.doesNotMatch(requestBody, /maxPerEpic\s*:/)
  assert.match(source, /Automation 設定を使用/)
  assert.match(source, /configuredMaxPerEpic \? `（現在 \$\{configuredMaxPerEpic\}回）` : '（読込中）'/)
  assert.match(source, /深掘り上限 \{report\.maxPerEpic\}回/)
})

test('Automation画面: 保存済み深掘り回数をRunnerパネルへ表示用に渡す', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/automation/page.tsx'),
    'utf-8',
  )

  assert.match(
    source,
    /<FactoryRunnerPanel configuredMaxPerEpic=\{config\?\.factoryMaxPerEpic\} \/>/,
  )
})
