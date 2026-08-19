// node --test (sucrase/register) で tsconfig の "@/" パスエイリアスを解決するためのフック。
// 実行時に "@/lib/..." を require するモジュールをテストする場合、テストファイルの先頭でこれを import する。
const Module = require('module')
const path = require('path')

const orig = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    return orig.call(this, path.join(__dirname, '..', request.slice(2)), ...args)
  }
  return orig.call(this, request, ...args)
}
