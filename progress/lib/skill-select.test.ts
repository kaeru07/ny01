import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { selectSkillForEpic } from './skill-select.ts'

async function withDataDir<T>(files: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-skill-select-'))
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

function skill(id: string, enabled = true, version = 1) {
  return {
    id,
    name: id,
    inputs: [],
    outputs: [],
    riskFlags: [],
    version,
    enabled,
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z',
  }
}

test('selectSkillForEpic: goal-app scaffold は progress target より優先される', async () => {
  const selected = await withDataDir({
    'skills.json': {
      skills: [
        skill('skill-progress-feature', true, 2),
        skill('skill-store-app-scaffold', true, 4),
      ],
      updatedAt: '2026-07-03T00:00:00.000Z',
    },
  }, () => selectSkillForEpic({
    epicId: 'epic-goalstep-goal-app-demo',
    goalId: 'goal-app-demo',
    targetApp: 'progress',
  }))

  assert.equal(selected?.skill.id, 'skill-store-app-scaffold')
  assert.equal(selected?.version, 4)
})

test('selectSkillForEpic: disabled の Skill は返さない', async () => {
  const selected = await withDataDir({
    'skills.json': {
      skills: [skill('skill-progress-feature', false, 3)],
      updatedAt: '2026-07-03T00:00:00.000Z',
    },
  }, () => selectSkillForEpic({
    epicId: 'epic-progress',
    targetApp: 'progress',
  }))

  assert.equal(selected, null)
})

test('selectSkillForEpic: fixRequested は通常選択より優先される', async () => {
  const selected = await withDataDir({
    'skills.json': {
      skills: [
        skill('skill-progress-feature', true, 2),
        skill('skill-fix-followup', true, 1),
      ],
      updatedAt: '2026-07-03T00:00:00.000Z',
    },
  }, () => selectSkillForEpic({
    epicId: 'epic-progress',
    targetApp: 'progress',
  }, { fixRequested: true }))

  assert.equal(selected?.skill.id, 'skill-fix-followup')
  assert.equal(selected?.version, 1)
})

test('selectSkillForEpic: 非progress対象アプリは app-change を返す', async () => {
  const selected = await withDataDir({
    'skills.json': {
      skills: [
        skill('skill-progress-feature', true, 2),
        skill('skill-app-change', true, 1),
      ],
      updatedAt: '2026-07-03T00:00:00.000Z',
    },
  }, () => selectSkillForEpic({
    epicId: 'epic-news-app',
    targetApps: ['news-app'],
  }))

  assert.equal(selected?.skill.id, 'skill-app-change')
  assert.equal(selected?.version, 1)
})
