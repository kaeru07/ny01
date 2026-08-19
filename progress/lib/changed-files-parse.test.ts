import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseChangedFilesFromOutput } from './executors/shell.ts'

test('parseChangedFilesFromOutput: ログ由来トークン(IP/HTTP/.env)をchangedFilesに混ぜない', () => {
  const output = [
    '## 変更ファイル',
    '- lib/foo.ts',
    '- 127.0.0.1 に接続',
    '- HTTP/1.1 200 OK',
    '- .env.local を参照',
  ].join('\n')
  assert.deepEqual(parseChangedFilesFromOutput(output), ['lib/foo.ts'])
})

test('parseChangedFilesFromOutput: 通常の変更ファイルは拾う', () => {
  const output = [
    '変更ファイル:',
    '- app/api/execution-runs/route.ts',
    '- data/real/goals.json',
    '- README.md',
  ].join('\n')
  assert.deepEqual(parseChangedFilesFromOutput(output), [
    'app/api/execution-runs/route.ts',
    'data/real/goals.json',
    'README.md',
  ])
})

test('parseChangedFilesFromOutput: rawReportのchangedFiles配列から補完できる', () => {
  const output = [
    'summary: API登録時に補完',
    'changedFiles: ["progress/app/api/execution-runs/route.ts", "a/lib/executors/shell.ts", "b/lib/changed-files-parse.test.ts"]',
  ].join('\n')
  assert.deepEqual(parseChangedFilesFromOutput(output), [
    'app/api/execution-runs/route.ts',
    'lib/executors/shell.ts',
    'lib/changed-files-parse.test.ts',
  ])
})

test('parseChangedFilesFromOutput: プロパティ名やバージョン文字列をchangedFilesに混ぜない', () => {
  const output = [
    '## 変更ファイル',
    '- lib/factory-runner.ts',
    '- rec.history',
    '- epic.goalId',
    '- v0.142.5',
    '- newArray.length',
    '検証結果:',
    '- npm run build OK',
  ].join('\n')
  assert.deepEqual(parseChangedFilesFromOutput(output), ['lib/factory-runner.ts'])
})
