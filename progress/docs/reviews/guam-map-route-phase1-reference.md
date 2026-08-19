# グアム地図なぞり Goal — Phase 1 ドロップイン実装リファレンス（検証済みコア付き）

- goalId: `goal-mqq28l9d-8h86j`
- epicId(dispatch): `epic-goalstep-goal-mqq28l9d-8h86j`
- 作成: 2026-07-08
- 前提: [`guam-map-route-goal-blockers.md`](./guam-map-route-goal-blockers.md) / [`guam-map-route-goal-spec-proposal.md`](./guam-map-route-goal-spec-proposal.md)
- 位置付け: このドキュメントは **Guam アプリ側のソースを書き換えるものではない**。company 原則「アプリごとの作業はそのアプリのリポジトリ内で完結」を守り、progress リポジトリ内には **コピペ可能なリファレンス実装 + 検証済みコアロジック** のみを置く。B1（Guam repo アクセス）解消後、これを Guam リポジトリへ貼り付ければ Phase 1 は機械的な配線だけで完成する。

---

## 0. このステップで前進させたこと（前回との差分）

前回まで（blockers インベントリ → spec 提案 → Goal への B2 記入）は「何を作るか」を **文章で** 確定した。本ステップの具体的前進は:

> **Phase 1 の唯一の非自明ロジック（waypoint 並べ替え + 全点フィットの bounds 計算）を、地図ライブラリ非依存の純粋関数として実装し、このサンドボックス内で実行検証した（5/5 pass）。**

残る Phase 1 作業は「純粋関数の呼び出し + マーカー/ポリラインの描画 API 呼び出し」という機械的配線のみに縮小した。B1 が解消されれば、下記コードを貼り付けて `npm run build` を通すだけで doneCriteria を満たせる状態にした。

---

## 1. 検証済みコアロジック（ライブラリ非依存・そのまま流用可）

以下 2 関数が Phase 1 で唯一テストすべきロジック。地図ライブラリ（Leaflet / MapLibre どちらでも）に依存しないため、Guam リポジトリの型規約に合わせて `lib/` などに配置し、ユニットテストを付ければよい。

```ts
// types
export interface RouteWaypoint {
  order: number;   // 訪問順（0,1,2,...）
  label?: string;  // 「ホテル」「タモン」等（任意）
  lat: number;
  lng: number;
}
export interface EventRoute {
  eventId: string;
  waypoints: RouteWaypoint[];
  mode: "straight" | "road";   // Phase 1 は "straight" のみ
  encodedPolyline?: string;    // Phase 2 用（未使用）
}

/** 訪問順にソートした [lat,lng] のポリライン用パスを返す（入力は破壊しない）。 */
export function orderedPath(waypoints: RouteWaypoint[]): [number, number][] {
  return [...waypoints]
    .sort((a, b) => a.order - b.order)
    .map((w) => [w.lat, w.lng]);
}

/**
 * 全 waypoint を含む Leaflet 形式の bounds [[minLat,minLng],[maxLat,maxLng]] を返す。
 * 空なら null。単一点なら min==max（Leaflet fitBounds は maxZoom で処理）。
 */
export function computeBounds(
  waypoints: RouteWaypoint[]
): [[number, number], [number, number]] | null {
  if (!waypoints || waypoints.length === 0) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const w of waypoints) {
    if (w.lat < minLat) minLat = w.lat;
    if (w.lat > maxLat) maxLat = w.lat;
    if (w.lng < minLng) minLng = w.lng;
    if (w.lng > maxLng) maxLng = w.lng;
  }
  return [[minLat, minLng], [maxLat, maxLng]];
}
```

### 検証結果（2026-07-08 / node 実行）

`/tmp/guam-phase1-verify.mjs` を実行し以下を確認（このリポジトリには残さない一時スクリプト）:

```
  ok  orderedPath sorts by order
  ok  computeBounds covers all points
  ok  computeBounds single point is degenerate but valid
  ok  computeBounds empty -> null
  ok  orderedPath does not mutate input (still original order)

5 passed, 0 failed
```

- 使用サンプル: Guam 実座標帯（Tumon 13.51°N / Hagåtña 13.47°N, 144.75–144.80°E）。順序を意図的にシャッフルした入力で並べ替え・bounds を確認。
- 境界ケース（単一点 / 空配列 / 入力非破壊）を網羅。

---

## 2. 地図描画コンポーネント（Leaflet + react-leaflet 版・ドロップイン）

Guam アプリが Next.js/React の場合の最小実装。無料の OSM タイルのみ使用（**課金ゼロ・API キー不要**）。`mode:"straight"` の直線ポリライン描画に限定。

```tsx
"use client";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import { orderedPath, computeBounds, type RouteWaypoint } from "@/lib/event-route";

function FitBounds({ waypoints }: { waypoints: RouteWaypoint[] }) {
  const map = useMap();
  useEffect(() => {
    const b = computeBounds(waypoints);
    if (b) map.fitBounds(b, { padding: [24, 24], maxZoom: 15 });
  }, [map, waypoints]);
  return null;
}

export function EventRouteMap({ waypoints }: { waypoints: RouteWaypoint[] }) {
  if (!waypoints || waypoints.length === 0) return null;
  const path = orderedPath(waypoints);
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);
  return (
    <div style={{ width: "100%", height: "60vh", minHeight: 280 }}>
      <MapContainer style={{ width: "100%", height: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <Polyline positions={path} />
        {ordered.map((w, i) => (
          <Marker key={i} position={[w.lat, w.lng]}>
            {w.label && <Popup>{`${i + 1}. ${w.label}`}</Popup>}
          </Marker>
        ))}
        <FitBounds waypoints={waypoints} />
      </MapContainer>
    </div>
  );
}
```

補足:
- `react-leaflet` は SSR 非対応のため、呼び出し側で `next/dynamic` の `{ ssr: false }` で読み込むこと。
- Leaflet の CSS（`leaflet/dist/leaflet.css`）を import 済みにする。マーカーアイコン欠けは Leaflet の既知問題（`L.Icon.Default` の画像パス設定）で対処。
- MapLibre を既存採用しているなら、`Polyline`→GeoJSON `LineString`、`fitBounds`→`map.fitBounds(LngLatBounds)` に置換（コアの `orderedPath`/`computeBounds` はそのまま流用可。ただし MapLibre は `[lng,lat]` 順なので `.map(([la,ln])=>[ln,la])` の反転が必要）。

---

## 3. 残タスク（B1 解消後の機械的配線のみ）

- [ ] Guam repo の型規約に合わせ `orderedPath`/`computeBounds` を `lib/` に配置 + ユニットテスト移植（本 doc の 5 ケース）
- [ ] イベント型に `waypoints`（座標直書き）を追加、サンプル 1 イベントに Guam 実座標を投入
- [ ] `EventRouteMap` をイベント詳細画面へ組み込み（`next/dynamic` ssr:false）
- [ ] `npm run build` / 型チェック / モバイル幅ブラウザ表示確認
- [ ] （変更なし）Phase 2 = road-snapped は **B3 承認必須**。Phase 1 完了後に判断

---

## 4. 承認・判断待ち（変更なし）

| 項目 | 状態 |
|---|---|
| B1: Guam repo を executor 作業ディレクトリでアクセス可 or Guam 側 dispatch | **未解消（本サンドボックス外）** |
| B2: Phase 1 スペック（データモデル/完了条件） | **確定済み**（Goal に記入 + 本 doc に実装まで） |
| B3: Phase 2 ルーティング API 承認（課金） | Phase 1 完了後に判断（未着手で正） |

**結論**: B2 は「仕様」から「検証済み実装リファレンス」まで前進。実 repo への配線は B1 が唯一のブロッカー。B1 は人間側の環境準備（repo アクセス付与 or Guam 側 dispatch 切替）待ち。
