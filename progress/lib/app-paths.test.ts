import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { GENERATED_APPS_ROOT, resolveAppCwd } from './app-paths.ts'

test('resolveAppCwd: resolves an existing generated app directory for unknown safe target', () => {
  const originalExistsSync = fs.existsSync
  const originalStatSync = fs.statSync
  const expectedPath = `${GENERATED_APPS_ROOT}/new-safe-app`

  Object.defineProperty(fs, 'existsSync', {
    configurable: true,
    value: ((target: fs.PathLike) => String(target) === expectedPath) as typeof fs.existsSync,
  })
  Object.defineProperty(fs, 'statSync', {
    configurable: true,
    value: ((target: fs.PathLike) => {
    assert.equal(String(target), expectedPath)
    return { isDirectory: () => true }
    }) as typeof fs.statSync,
  })

  try {
    assert.equal(resolveAppCwd('new-safe-app'), expectedPath)
  } finally {
    Object.defineProperty(fs, 'existsSync', { configurable: true, value: originalExistsSync })
    Object.defineProperty(fs, 'statSync', { configurable: true, value: originalStatSync })
  }
})

test('resolveAppCwd: rejects unsafe generated app target names', () => {
  assert.equal(resolveAppCwd('../new-safe-app'), null)
  assert.equal(resolveAppCwd('new_safe_app'), null)
})
