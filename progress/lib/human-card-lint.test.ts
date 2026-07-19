import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMachineTextIssues } from './human-card-lint.ts'

test('findMachineTextIssues: detects old danger approval machine text', () => {
  const issues = findMachineTextIssues([
    '判断が必要: 認証の生存確認+ログアウト追加 / 暇潰しをステージ制+ランキング化',
    '認証・秘密情報関連の作業（危険キーワード検知）。人間の確認を推奨。',
    '内部ID: appr-1783746027900-1',
    '元の作業履歴: 20260711-010027',
  ].join('\n'))

  assert.ok(issues.some((issue) => issue.rule === 'internal_id'))
})

test('findMachineTextIssues: detects old ios build candidate machine text', () => {
  const issues = findMachineTextIssues([
    'reason: 未反映コミットあり',
    '直近ビルド: finished / workflow=ios-appstore / branch=master / finishedAt=2026-07-18T08:16:11.000Z / commit=899f7cfc',
    'local HEAD: aabbccddeeff',
  ].join('\n'))

  assert.ok(issues.some((issue) => issue.rule === 'iso_datetime'))
  assert.ok(issues.some((issue) => issue.rule === 'key_value_chain'))
  assert.ok(issues.some((issue) => issue.rule === 'raw_hash'))
})

test('findMachineTextIssues: accepts revised human ios build wording', () => {
  const issues = findMachineTextIssues([
    '前回のTestFlight配信（7/18 17:16）のあとに新しい変更が2件あり、まだiPhoneで試せる状態になっていません。',
    '配信されていない変更:',
    '- 『ログアウト導線を追加』（7/18 18:04）',
    '- 『ステージ制の文言を調整』（7/18 18:01）',
    'ビルドの中身:',
    '- CodemagicでiOS App Store向けにビルドし、成功するとTestFlightへ自動アップロードされます。',
  ].join('\n'))

  assert.deepEqual(issues, [])
})

test('findMachineTextIssues: accepts revised danger confirmation wording', () => {
  const issues = findMachineTextIssues([
    '完了作業の確認: 「暇潰し！」の作業に認証・秘密情報まわりの変更が含まれています',
    '作業内容に「認証」、「ログアウト」など人間の確認が必要な語が含まれるため、意図した変更かを確認してください。作業自体は完了済みです。',
    'この作業でやったこと:',
    '- ログアウト導線を追加し、認証の生存確認を画面に反映しました。',
  ].join('\n'))

  assert.deepEqual(issues, [])
})

test('findMachineTextIssues: ignores URLs and quoted commit subjects', () => {
  const issues = findMachineTextIssues([
    '確認URL: https://example.com/path/abcdef1234567890',
    '- 『fix auth token refresh handling』',
  ].join('\n'))

  assert.deepEqual(issues, [])
})
