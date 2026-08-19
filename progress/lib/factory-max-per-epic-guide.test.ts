import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('利用ガイド: 深掘り回数1が複数Epicのローテーション設定だと説明する', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/guide/page.tsx'),
    'utf-8',
  )

  assert.match(source, /1サイクルで複数の作業を回すには？/)
  assert.match(source, /「自動化」（\/automation）/)
  assert.match(source, /「1サイクルの深掘り回数」を1回/)
  assert.match(source, /1回実行すると次のEpicへ進む/)
  assert.match(source, /2〜3回にすると、同じEpicをその回数まで続けて深掘り/)
  assert.match(source, /1サイクル全体の実行件数ではなく/)
})
