# 麻雀AI育成の土台（src/ai）

麻雀トレーナーの対局エンジン（`src/engine/gameEngine.ts` の reducer と
`src/domain/mahjong` のシャンテン/牌ロジック）を**そのまま流用**した、
ヘッドレスの自己対戦＋学習の土台です。UI を介さず高速に大量対戦できます。

## 現状の環境（簡易麻雀）

現行エンジンの制約に合わせた簡易ルールで動きます。AI 育成の出発点として十分で、
あとから段階的に拡張できます。

- 4人・配牌13枚・ツモ切り/手出しあり
- **鳴きなし・ロンなし・ツモ和了のみ・役なし（形だけで和了）・点数計算なし**
- 山切れで流局

## 構成

| ファイル | 役割 |
|---|---|
| `rng.ts` | シード付き乱数。配牌を決定的にして再現性を確保 |
| `types.ts` | `Agent` インターフェース / 観測 `Observation` / 結果型 |
| `features.ts` | 打牌後の手牌を数値特徴に変換（向聴・待ち数・ドラ・孤立・対子） |
| `agents.ts` | `RandomAgent` / `ShantenAgent`(既存CPU流用) / `WeightedAgent`(学習対象) |
| `env.ts` | `gameReducer` を駆動して1局を完走させるヘッドレス環境 |
| `selfplay.ts` | N局まわして席別成績を集計 / 適応度評価 |
| `train.ts` | (1+1)進化戦略で `WeightedAgent` の重みを育てる |
| `cli-*.ts` | CLI エントリ |
| `ai.test.ts` | 決定性・環境・エージェント強さの回帰テスト |

## 使い方

```bash
# 自己対戦の成績（席0=ランダム / 席1,2=向聴 / 席3=学習重み）
npm run ai:selfplay -- 500 1      # 500局, seed=1

# 重みを育成（学習前後の和了率を比較）
npm run ai:train -- 30 300        # 30世代, 1個体あたり300局で評価

# テスト
npm test
```

### 動作例（400局・seed=1）

```
席  エージェント          和了率   最終平均向聴  テンパイ率
0   random               0.0%       3.62     0.0%
1   shanten             10.0%       0.69    49.0%
3   weighted(tuned)     17.5%       0.36    67.3%
```

学習エージェントが素の向聴AI・ランダムAIを上回ることを確認済み。

## エージェントの作り方

`Agent` を実装するだけで対戦に参加できます。

```ts
import type { Agent, Observation } from '@/ai/types'

export class MyAgent implements Agent {
  readonly name = 'my'
  selectDiscard(obs: Observation): TileIndex {
    // obs.fullHand（14枚）から打牌する1枚を返す
    return obs.fullHand[0]
  }
}
```

## 今後の拡張候補

1. **環境の高度化**: 鳴き（ポン/チー）・ロン・役判定・点数計算を engine に追加
2. **学習の高度化**: 方策勾配 / self-play で相手も同時に強くする / 経験再生
3. **特徴量の拡充**: 他家の河・危険度（放銃回避）・ドラ表現の強化
4. **評価**: 平均順位・放銃率など多面的な適応度

> シャンテン計算がホットパスなので、大規模学習ではメモ化や近似が有効。
