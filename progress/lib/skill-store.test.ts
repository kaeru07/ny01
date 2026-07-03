import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readSkills } from './skill-store.ts'

async function withDataDir<T>(files: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-skill-store-'))
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

test('readSkills: normalize後も全フィールドを落とさない', async () => {
  const skills = await withDataDir({
    'skills.json': {
      skills: [
        {
          id: 'skill-a',
          name: 'Skill A',
          description: 'desc',
          promptTemplate: 'prompt',
          procedure: 'step1',
          preferredExecutor: 'codex',
          inputs: ['input'],
          outputs: ['output'],
          riskFlags: ['deploy'],
          version: 3,
          enabled: false,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-07-02T00:00:00.000Z',
    },
  }, () => readSkills())

  assert.deepEqual(skills[0], {
    id: 'skill-a',
    name: 'Skill A',
    description: 'desc',
    promptTemplate: 'prompt',
    procedure: 'step1',
    preferredExecutor: 'codex',
    inputs: ['input'],
    outputs: ['output'],
    riskFlags: ['deploy'],
    version: 3,
    enabled: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  })
})
