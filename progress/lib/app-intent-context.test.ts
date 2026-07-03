import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildAppIntentContext, formatAppIntentContext } from './app-intent-context.ts'

async function withDataDir<T>(files: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-app-intent-'))
  const previous = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
  try {
    await Promise.all(Object.entries(files).map(([name, data]) => (
      fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2), 'utf-8')
    )))
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previous
    await fs.rm(dir, { recursive: true, force: true })
  }
}

test('buildAppIntentContext: goal-app以外は空', async () => {
  assert.equal(await buildAppIntentContext('goal-progress'), '')
  assert.equal(await buildAppIntentContext(undefined), '')
})

test('formatAppIntentContext: 承認済み仕様ブロックを整形する', () => {
  const text = formatAppIntentContext({
    purpose: '習慣を短時間で記録する',
    mvpScope: '記録、一覧、統計',
    spec: 'ローカル保存で広告なし',
    screens: [
      { name: 'ホーム', rows: ['今日の記録', '連続日数', '追加', '設定'] },
      { name: '統計', rows: ['週次', '月次'] },
    ],
    initialGoalDraft: 'ExpoでMVPを作る',
    notes: '片手操作を重視',
  })

  assert.match(text, /^## アプリ仕様/)
  assert.match(text, /目的: 習慣を短時間で記録する/)
  assert.match(text, /MVP範囲: 記録、一覧、統計/)
  assert.match(text, /仕様: ローカル保存で広告なし/)
  assert.match(text, /ホーム: 今日の記録 \/ 連続日数 \/ 追加/)
  assert.doesNotMatch(text, /設定/)
  assert.match(text, /初期実装計画: ExpoでMVPを作る/)
  assert.match(text, /ユーザーの意図メモ: 片手操作を重視/)
})

test('buildAppIntentContext: sourceProjectId一致で候補を特定しGoal notesを含める', async () => {
  const text = await withDataDir({
    'app-factory-candidates.json': {
      epicId: 'epic-a5r7n4',
      description: '',
      updatedAt: '2026-07-04T00:00:00.000Z',
      candidates: [
        {
          id: 'candidate-habit',
          title: 'Habit Mini',
          sourceProjectId: 'habit-mini',
          purpose: '習慣を短時間で記録する',
          monetizationHypothesis: '買い切り',
          spec: '端末内保存',
          mvpScope: '記録と一覧',
          screens: [{ name: 'ホーム', rows: ['今日', '追加', '履歴'] }],
          initialGoalDraft: '最小画面から実装',
          priority: 'high',
          status: 'ready',
          nextAction: 'build',
          factorySafe: true,
        },
      ],
    },
    'goals.json': {
      mainGoalId: 'goal-app-habit-mini',
      updatedAt: '2026-07-04T00:00:00.000Z',
      goals: [
        {
          id: 'goal-app-habit-mini',
          projectId: 'habit-mini',
          title: 'Habit Miniを作る',
          summary: '習慣を短時間で記録する',
          notes: '広告なし',
          status: 'active',
          priority: 'high',
          monetizationImpact: 'high',
          phases: [],
          todos: [],
          createdAt: '2026-07-04T00:00:00.000Z',
          updatedAt: '2026-07-04T00:00:00.000Z',
        },
      ],
    },
  }, () => buildAppIntentContext('goal-app-habit-mini'))

  assert.match(text, /目的: 習慣を短時間で記録する/)
  assert.match(text, /MVP範囲: 記録と一覧/)
  assert.match(text, /仕様: 端末内保存/)
  assert.match(text, /ホーム: 今日 \/ 追加 \/ 履歴/)
  assert.match(text, /初期実装計画: 最小画面から実装/)
  assert.match(text, /ユーザーの意図メモ: 広告なし/)
})
