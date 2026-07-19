import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveCandidate, formatJstShortDateTime, formatUnshippedCommitLines } from './ios-builds.ts'
import type { IosCodemagicBuild, IosLocalGit } from '../types/ios-builds.ts'

const localGit: IosLocalGit = {
  head: 'abc1234',
  lastCommitAt: '2026-07-18T10:00:00.000Z',
  subject: 'latest local work',
}

function build(patch: Partial<IosCodemagicBuild>): IosCodemagicBuild {
  return {
    buildId: 'build-1',
    status: 'finished',
    workflowId: 'ios-appstore',
    branch: 'main',
    startedAt: '2026-07-18T09:00:00.000Z',
    finishedAt: '2026-07-18T09:10:00.000Z',
    commitHash: 'abc1234ffff',
    ...patch,
  }
}

test('deriveCandidate: build history missing is a candidate', () => {
  assert.deepEqual(deriveCandidate({ localGit }, [], localGit), {
    isCandidate: true,
    reason: '未ビルド',
  })
})

test('deriveCandidate: latest failed build is a candidate', () => {
  assert.deepEqual(deriveCandidate({ localGit }, [build({ status: 'failed' })], localGit), {
    isCandidate: true,
    reason: '最新ビルド失敗',
  })
})

test('deriveCandidate: local HEAD mismatch from latest success is a candidate', () => {
  const result = deriveCandidate({ localGit }, [build({ commitHash: 'def9999aaaa' })], localGit)

  assert.deepEqual(result, {
    isCandidate: true,
    reason: '未反映コミットあり',
  })
})

test('deriveCandidate: matching short and long hashes are not a candidate', () => {
  assert.deepEqual(deriveCandidate({ localGit }, [build({ commitHash: 'abc1234ffff' })], localGit), {
    isCandidate: false,
  })
})

test('deriveCandidate: local commit time is used when build commit hash is missing', () => {
  const result = deriveCandidate(
    { localGit: { ...localGit, head: null } },
    [build({ commitHash: null, finishedAt: '2026-07-18T09:00:00.000Z' })],
    { ...localGit, head: null },
  )

  assert.deepEqual(result, {
    isCandidate: true,
    reason: '未反映コミットあり',
  })
})

test('formatJstShortDateTime: formats ISO time in JST', () => {
  assert.equal(formatJstShortDateTime('2026-07-18T08:16:11.000Z'), '7/18 17:16')
})

test('formatUnshippedCommitLines: lists five commits and summarizes the rest', () => {
  const lines = formatUnshippedCommitLines({
    total: 7,
    baseFinishedAt: '2026-07-18T08:16:11.000Z',
    baseSubject: 'last delivered change',
    commits: [
      { subject: 'change 1', committedAt: '2026-07-18T09:00:00.000Z' },
      { subject: 'change 2', committedAt: '2026-07-18T09:01:00.000Z' },
      { subject: 'change 3', committedAt: '2026-07-18T09:02:00.000Z' },
      { subject: 'change 4', committedAt: '2026-07-18T09:03:00.000Z' },
      { subject: 'change 5', committedAt: '2026-07-18T09:04:00.000Z' },
    ],
  })

  assert.deepEqual(lines, [
    '- 『change 1』（7/18 18:00）',
    '- 『change 2』（7/18 18:01）',
    '- 『change 3』（7/18 18:02）',
    '- 『change 4』（7/18 18:03）',
    '- 『change 5』（7/18 18:04）',
    '- ほか2件',
  ])
})
