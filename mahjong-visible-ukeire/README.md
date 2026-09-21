# 実戦向け何切る：可視牌込み受け入れエンジン（開発ブランチ）

再提出対応中の `kaeru07/mahjong-analyzer` は変更しない。新アプリの独立ディレクトリ。

## 出典と流用範囲

`src/analyzer-core.cjs` は `kaeru07/mahjong-analyzer` の commit `6ddbba0a2985be261e37eec02d2b379aa5ab370c` にある `lib/mahjong/analyzer.ts`、`adapter/kobalab.ts` の **向聴数・有効牌列挙・14枚控除済み枚数の計算部分** を抽出して利用する。点数・役・元アプリのUIや元の順位（牌種数タイブレーク）は流用しない。`@kobalab/majiang-core@1.4.1` を同バージョンで固定。

## 入力

`scoreSituation({hand, publicTiles}, optionalOriginalAnalysis)` を使用。`hand` は14要素の `{id, tile}`、`publicTiles` は `{id, tile, zone}` の配列。牌は `{suit:'m'|'p'|'s'|'z', number:1..9/1..7, isRed?:boolean}`。`zone` は `discard` / `meld` / `dora` / `kan` / `other`。IDは物理牌ごとに一意で、河から副露に移した牌は**移動後の場所に一度だけ**登録する。相手の隠された手牌と裏ドラは渡さない。

## 採点

- 既存解析の各候補 `ukeireDetail` は自分の元の14枚を控除済み。選択して切った牌も既知なので、手牌へ戻して数えない。
- `visible[t] = 4 - originalHand[t] - publicTiles[t]` を34種類分確認し、各候補の**有効牌種だけ**合算。無関係な捨て牌はその候補から引かない。
- 最小向聴の候補の中で可視牌補正後の枚数が最大の牌を正解とする。完全同点なら複数正解。赤5は同じ4枚の枠を使用し、打牌IDだけ区別する。
- 物理ID重複・同牌5枚目・元解析の内訳との不一致はエラー。正確に「山にある」とは断定せず「見えていない受け入れ」と表示する。
- 初期範囲は門前の打牌のみ。鳴き手の計算、役・打点・押し引き・フリテンの評価は別仕様。0枚問題の出題除外は呼び出し元で行う。

## 実行

```bash
cd mahjong-visible-ukeire
npm install
npm test
```

依存ライブラリを取得できない環境でも `npm run test:unit` は動作する。`test:integration` は依存ライブラリがなければ失敗する（成功扱いにしない）。**依存導入後、スキップなしで結合テストを通して初めて結合検証完了**とする。

**このブランチの対象外**：既存解析ツール修正、main統合、画面UI、アプリ公開・提出。
