// Node 組み込みテスト用の軽量ローダー。
// - `@/x` を `src/x` に解決する（tsconfig paths の代替）
// - 拡張子なしのローカル import に `.ts` を補う
// 型は Node の --experimental-strip-types で除去する（型チェックはしない）。
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = pathToFileURL(path.resolve(process.cwd(), 'src') + '/').href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    const SRC = ${JSON.stringify(SRC)};
    export async function resolve(specifier, context, next) {
      let s = specifier;
      if (s.startsWith('@/')) s = new URL(s.slice(2), SRC).href;
      const local = s.startsWith('.') || s.startsWith('file:');
      if (local && !/\\.[cm]?[jt]s$/.test(s) && !/\\.json$/.test(s)) s = s + '.ts';
      return next(s, context);
    }
  `),
  import.meta.url
);
