# グアム地図なぞり Goal — 実装スペック提案（Decision-ready / 承認判断用）

- goalId: `goal-mqq28l9d-8h86j`
- title: グアムアプリに、イベントごとの移動経路を地図でなぞって表示できるようにする
- epicId(dispatch): `epic-goalstep-goal-mqq28l9d-8h86j`
- 作成: 2026-07-07 / 前提レビュー: [`guam-map-route-goal-blockers.md`](./guam-map-route-goal-blockers.md)
- 位置付け: このドキュメントは**方針を確定しない**。B2（仕様記入）と B3（API 承認）を人間が判断できるよう、選択肢・データモデル・完了条件を **decision-ready な下書き**として提示する。

---

## 0. このステップで前進させたこと（前回との差分）

前回の blockers インベントリは「仕様が空・承認が必要」を**抽象的に**指摘して止まった。本ステップの具体的前進は次の1点:

> **「地図でなぞる」は2フェーズに分割でき、Phase 1 は課金・外部承認なしで実装可能。**

- **Phase 1（承認不要）**: イベントの座標列を **直線ポリライン**でつないで地図に描画する。無料の OSM タイル + Leaflet/MapLibre で完結し、**ルーティング/Directions API を使わない → 課金ゼロ・API キー不要 → B3 承認の対象外**。
- **Phase 2（承認必須）**: ポリラインを**実道路に沿わせる**（road-snapped routing）。ここで初めて Directions/Routing API が必要になり、課金・キー管理が発生する（B3 承認対象）。

この分割により、Goal の状態は「何も着手できない」から「**Phase 1 はリポジトリアクセス(B1)さえ得られれば即着手可**」に変わる。B3 承認は Phase 2 まで遅延できる。

---

## 1. データモデル案（B2 の一部・下書き）

イベント → 移動経路を表現する最小スキーマ。既存 Guam アプリのイベント型に `route` を追加する想定（フィールド名は実装時に既存規約へ合わせる）。

```ts
// 1 イベントが持つ移動経路
interface EventRoute {
  eventId: string;
  // 経路を構成する経由地（順序付き）。最低2点。
  waypoints: RouteWaypoint[];
  // Phase 1 は "straight"（直線接続）。Phase 2 で "road"（道路沿い）を追加。
  mode: "straight" | "road";
  // Phase 2 のみ: Directions API が返した実道路ジオメトリのキャッシュ（任意）
  encodedPolyline?: string;
}

interface RouteWaypoint {
  order: number;      // 訪問順（0,1,2,...）
  label?: string;     // 「ホテル」「タモン」等の表示名（任意）
  lat: number;
  lng: number;
}
```

- Phase 1 は `waypoints` と `mode:"straight"` だけで描画可能。`encodedPolyline` は不要。
- Phase 2 移行時も `waypoints` はそのまま。`mode` を `"road"` に切替え、`encodedPolyline` を追加するだけで後方互換。
- データ供給元は「イベント定義に座標を持たせる」か「地名 → 座標のジオコーディング済みマスタを持つ」の2択。**Phase 1 は座標直書きを推奨**（ジオコーディング API も課金対象になり得るため後回し）。

---

## 2. Phase 1 完了条件（B2 の一部・下書き / 承認不要で実装可）

Guam アプリのリポジトリで以下を満たせば Phase 1 完了とする（実装は B1 解消後）:

- [ ] イベント詳細画面に地図が表示される（OSM タイル + Leaflet か MapLibre、無料枠）
- [ ] そのイベントの `waypoints` を順序どおり直線ポリラインでつなぎ、地図上に描画する
- [ ] 各 waypoint にマーカー（+ 任意で label）を表示する
- [ ] 地図の初期表示範囲が全 waypoint を含むよう自動フィットする
- [ ] `npm run build` / 型チェックが通る
- [ ] ブラウザのモバイル幅で経路が破綻なく表示される

検証: `build` + 型チェック + ブラウザ実表示（Guam リポジトリ内で実施）。**課金・キー・外部公開いずれも発生しない。**

---

## 3. Phase 2 ルーティング API 比較（B3 承認判断用・確定しない）

Phase 2（道路沿いなぞり）に進む場合のプロバイダ選択肢。**採用は人間承認事項（課金・外部 API）**なので、ここでは比較のみ提示する。

| 選択肢 | 課金 | キー管理 | 精度/品質 | 備考 |
|---|---|---|---|---|
| **OSRM（公開デモ）** | 無料 | 不要 | 中 | 商用/高負荷は規約上不可。PoC 向き。self-host なら運用コスト発生 |
| **OSRM セルフホスト** | サーバ費のみ | 不要 | 中〜高 | 課金 API 回避可。運用（VPS/更新）コストと引き換え |
| **Mapbox Directions** | 無料枠あり→従量 | 要（キー） | 高 | 無料枠内なら実質無償。超過で課金 |
| **Google Directions** | 従量（無料枠小） | 要（キー） | 最高 | 品質最高だが課金発生しやすい。要 billing 承認 |

- **推奨（提案・未確定）**: PoC/初期は **OSRM 公開デモ**で挙動確認 → 本番採用時に **OSRM セルフホスト or Mapbox 無料枠**を選ぶ。Google は品質要件が出てから。
- いずれも「Phase 1 が動いてから」で十分。Phase 2 着手前に本表で human 承認を取る。

---

## 4. 人間の承認・判断待ち（明確化）

| 項目 | 内容 | 種別 |
|---|---|---|
| B1 | Guam アプリ repo を executor 作業ディレクトリで読み書き可能にする（URL + branch）。または Guam 側で作業する dispatch に切替 | 環境準備 |
| B2 | 本ドキュメントのデータモデル・Phase 1 完了条件を Goal（`taskPrompt`/`doneCriteria`）に確定記入 | 仕様確定（人間 or 承認後 Claude） |
| B3 | **Phase 2 のみ**: ルーティング API プロバイダ + キー供給 + 課金受容の承認 | 承認必須（課金） |

**重要**: Phase 1 は B3 に依存しない。**B1 が解消され B2 が確定すれば、Phase 1 は autonomous で着手可能**。

---

## 5. 推奨する次アクション順

1. （人間）B1: Guam repo を作業可能にする、または Guam 側 dispatch に切替
2. （人間 or 承認後 Claude）B2: 本 Phase 1 スペックを Goal に確定記入
3. （Claude）Phase 1 実装 → build/型/表示検証 → ExecutionRun
4. （人間）B3: Phase 2 の API 承認（§3 の表で判断）
5. （Claude）Phase 2 実装（road-snapped）

Phase 1 まではこのスコープで課金・承認ブロッカーを踏まずに Goal を 0% → 実質着手可能へ前進させられる。
