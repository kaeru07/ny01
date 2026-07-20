import assert from 'node:assert/strict'
import test from 'node:test'

import { getIosSigningGuideApps } from './ios-signing-guide'

test('iOS審査準備に公開済みのプライバシーURLとサポートURLを表示する', () => {
  const apps = getIosSigningGuideApps()
  const mahjong = apps.find((app) => app.bundleId === 'com.kaeru07.mahjong')

  assert.ok(mahjong)
  assert.equal(mahjong.privacyPolicyUrl, 'https://kaeru07.github.io/privacy/mahjong.html')
  assert.equal(mahjong.supportUrl, 'https://kaeru07.github.io/support/mahjong.html')
  assert.match(mahjong.copyText, /Privacy Policy URL: https:\/\/kaeru07\.github\.io\/privacy\/mahjong\.html/)
  assert.match(mahjong.copyText, /Support URL: https:\/\/kaeru07\.github\.io\/support\/mahjong\.html/)
})
