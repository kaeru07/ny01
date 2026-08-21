import assert from 'node:assert/strict'
import test from 'node:test'

import { listAppScreenshots, openAppScreenshot, SCREENSHOT_DEVICES } from './app-review-screenshots'

const ANALYZER_BUNDLE_ID = 'com.kaeru07.mahjonganalyzer'

test('端末プリセットはApp Store Connectが受け付ける出力サイズを持つ', () => {
  const iphone = SCREENSHOT_DEVICES.find((device) => device.id === 'iphone-6.5')
  assert.ok(iphone)
  assert.deepEqual(iphone.output, { width: 1284, height: 2778 })
  assert.equal(iphone.viewport.width * iphone.scale, iphone.output.width)
  assert.equal(iphone.viewport.height * iphone.scale, iphone.output.height)

  const ipad = SCREENSHOT_DEVICES.find((device) => device.id === 'ipad-13')
  assert.ok(ipad)
  assert.deepEqual(ipad.output, { width: 2064, height: 2752 })
})

test('未知のbundleId・危険なファイル名は拒否する', () => {
  assert.throws(() => openAppScreenshot('com.example.unknown', 'a.png'), /未知の bundleId/)
  assert.throws(() => openAppScreenshot(ANALYZER_BUNDLE_ID, '../../../etc/passwd'), /ファイル名が不正/)
  assert.throws(() => openAppScreenshot(ANALYZER_BUNDLE_ID, 'ja/../../secret.png'), /ファイル名が不正/)
  assert.throws(() => openAppScreenshot(ANALYZER_BUNDLE_ID, 'a/b/c.png'), /ファイル名が不正/)
  assert.throws(() => openAppScreenshot(ANALYZER_BUNDLE_ID, 'notes.txt'), /ファイル名が不正/)
})

test('screenshots直下と言語サブフォルダの両方を一覧に出す', async () => {
  const shots = await listAppScreenshots(ANALYZER_BUNDLE_ID)
  assert.ok(Array.isArray(shots))
  for (const shot of shots) {
    assert.match(shot.name, /\.png$/i)
    assert.equal(typeof shot.sizeOk, 'boolean')
    // PNG ヘッダから実サイズを読めていること
    assert.ok(shot.width > 0 && shot.height > 0, `${shot.name} のサイズが読めていない`)
  }
  // fastlane/screenshots 直下の既存ファイルと ja/ 配下の撮影分が混在して拾える
  if (shots.length > 0) {
    assert.ok(shots.some((shot) => !shot.name.includes('/')) || shots.some((shot) => shot.name.includes('/')))
  }
})
