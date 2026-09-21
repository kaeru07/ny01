# 実戦向け何切るトレーナー（独立開発ブランチ）

再提出中の `kaeru07/mahjong-analyzer` および既存の `mahjong-trainer` は変更しません。このフォルダだけが新アプリ用です。現在は**固定1問のiPhone縦画面UI検証版**であり、問題の自動生成・iOSアプリ化・配布・公開は未実装です。

## 計算エンジンの流用と仕様

`src/analyzer-core.cjs` は `kaeru07/mahjong-analyzer` の commit `6ddbba0a2985be261e37eec02d2b379aa5ab370c` の `lib/mahjong/analyzer.ts` / `adapter/kobalab.ts` から、向聴数・有効牌列挙・14枚控除済み受け入れ計算だけ抽出。元アプリの役・点数・UI・牌種数による同点判定は使わず、依存する `@kobalab/majiang-core` は 1.4.1 に固定。

`scoreSituation({hand,publicTiles})` の `hand` は物理ID付き14枚、`publicTiles` は物理IDと公開場所付きの捨て牌・副露・ドラ表示牌などで構成。河から副露へ移った牌は新しい場所に一度だけ登録し、見えない相手手牌・裏ドラ・山牌は渡さない。牌種ごとに `4 − 元の手牌14枚 − 公開牌` を計算し、候補ごとの有効牌に限って合計。最小向聴を優先し、その中で補正後の受け入れ枚数最大が正解。同点は複数正解。誤データ（物理ID重複・同牌5枚等）はエラー。赤5は物理上は同じ5の4枚枠。山に確実に存在する枚数ではなく、**見えていない受け入れ枚数**と表示。

初期対応は自分の門前・打牌のみ。役・打点・フリテン・押し引きは採点に含まない。全候補0枚の問題は出題側で拒否。

## UI・牌素材

- `app/page.jsx` / `app/globals.css`：iPhone縦画面の上下いっぱいを使う4人卓、上下左右の河、相手の裏向き手牌・左家の公開チー・ドラ表示牌、自分の14枚の手牌タップ式回答。問題中は正解を非表示、回答後に選んだ牌・正解・手牌のみ→公開牌補正後・有効牌ごとの内訳を表示。
- `src/problem.cjs`：画面に表示する河・副露・ドラ表示牌を、実際に `scoreSituation` に渡す公開牌と同じ物理ID集合から構築。3筒3枚公開で正解が7筒切りから3筒切りに逆転する固定問題。
- `public/tiles/`：既存 `mahjong-trainer/public/tiles/` の**同一ファイル内容**を複製。FluffyStuff/riichi-mahjong-tiles Regular variant, commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`。数牌30（赤5×3込み）・字牌7・牌表裏2、計39 SVG。`SOURCE.md` と `FLUFFYSTUFF_LICENSE.md`（CC0 1.0）を同梱。牌の絵柄は生成しない。牌本体 front.svg と絵柄を重ねる。
- 14枚は通常横一列。横幅375pt程度では1枚44ptのタップ領域を確保できないため、任意の「手牌を拡大」で7枚×2段へ切替可能。どちらも手牌1回タップで回答。解説は開閉可、同じ問題の再挑戦のみ（次問題ボタンなし）。

## 実行・検証

```bash
cd mahjong-visible-ukeire
npm install --no-audit --no-fund --ignore-scripts
npm test                 # 全Nodeテスト＋Next.js本番ビルド。依存不足なら失敗（スキップしない）
npm run dev              # ローカルの画面確認。デプロイしない
```

既存テスト13件に加え、局面の物理整合性・画面と採点が共有する公開牌・正解逆転・SVG39枚＋CC0同梱を検証する。GitHub Actionsで `npm test` を実行する。**画面の実機タップ試験・375/390/430ptのスクリーンショット目視は別途必要で、ビルド成功だけで実機合格とはしない。**

禁止範囲：既存アプリ変更、`main` 統合、ルートCI変更、iOS公開設定変更、デプロイ・App Store提出。
