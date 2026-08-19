import './test-alias.cjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECT_ID_REQUIRED_MESSAGE,
  requireGoalProjectId,
  validateGoalImport,
} from './goal-writer.ts'

test('新規Goal取込はprojectId未指定をプロジェクト追加案内付きで拒否する', () => {
  const result = validateGoalImport({ goalTitle: '新しいゴール' }, [])

  assert.equal(result.ok, false)
  assert.ok(result.errors.includes(PROJECT_ID_REQUIRED_MESSAGE))
})

test('新規Goal取込は存在しないprojectIdを拒否する', () => {
  const result = validateGoalImport({ projectId: 'missing', goalTitle: '新しいゴール' }, [])

  assert.equal(result.ok, false)
  assert.match(result.errors[0], /先にプロジェクトを追加してください/)
})

test('upsert系の共通検証は既存projectIdの引き継ぎを許可する', () => {
  assert.equal(requireGoalProjectId(undefined, 'company-mgmt'), 'company-mgmt')
  assert.throws(() => requireGoalProjectId(undefined), new RegExp(PROJECT_ID_REQUIRED_MESSAGE))
})
