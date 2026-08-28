# AnglerLog MVP — ローカル検証記録

Epic: epic-anglerlog-mvp-local-firs（local-first 釣行記録 MVP）
検証日: 2026-06-06
検証者: Claude（Factory Dispatch / dispatchMode=manual_copy）

## DoneCriteria 充足状況

| # | 条件 | 状態 | 根拠 |
|---|---|---|---|
| 1 | 魚種静的JSON選択＋釣果記録（サイズ/天候/仕掛け/写真）がローカル永続化 | ✅ | `lib/fish-species.ts`（静的 JSON 21 種）/ `components/CatchForm.tsx`（魚種select・サイズ・重量・天候・仕掛け・写真・メモ）/ `lib/storage.ts`（localStorage key `anglerlog.catches.v1`）/ `lib/image.ts`（写真は Canvas で縮小し DataURL 化して保存） |
| 2 | 場所の匿名化保存がローカル永続化 | ✅ | `lib/location.ts`：座標を 0.1°（約11km）に丸め、areaLabel を 40 字に切り詰め。外部ジオコーディング不使用。CatchRecord.location として localStorage に保存 |
| 3 | 統計（魚種別・月別・自己記録）がローカル動作 | ✅ | `lib/stats.ts`（statsBySpecies / statsByMonth / personalRecords / totals）/ `components/StatsView.tsx` |
| 4 | 釣行カレンダーがローカル動作 | ✅ | `components/CalendarView.tsx`（月送り・日別釣果数・日選択で当日記録表示） |
| 5 | build / typecheck / lint のいずれか実行・記録 | ✅ | 3 種すべて実行・PASS（下記） |
| 6 | オフライン（ネットワーク遮断）でMVP主要機能が動作する記録 | ✅ | 静的プリレンダ + 全アセット same-origin + ソース内ネットワーク呼び出しゼロ（下記） |

## 検証コマンド結果

- `npm run typecheck`（tsc --noEmit）: PASS（エラー 0）
- `npm run lint`（next lint）: PASS（warning/error 0）
- `npm run build`（next build）: PASS。`/` は `○ (Static)` としてプリレンダ。First Load JS 93.4 kB

## オフライン動作の根拠

- データ永続化はすべて `localStorage`（外部 DB・サーバ API なし）
- 写真は `FileReader` + Canvas でクライアント内処理（アップロードなし）
- 場所は手入力座標をクライアントで丸めるのみ（geolocation/geocoding API 不使用）
- ソース（app / lib / components）に `fetch` / `axios` / `XMLHttpRequest` / 外部 `https://` / 外部フォント / CDN 参照なし
- プリレンダ済み `.next/server/app/index.html` のリソース参照はすべて same-origin（`/_next/static/...`）。外部 URL ゼロ
  → ネットワーク遮断状態でも初回ロード後のアセットは同一オリジン配信のみで完結し、機能（記録・一覧・カレンダー・統計）は localStorage で動作する

## 収益化導線（プレースホルダ）

- `components/MonetizationSlots.tsx`：`AdSlot`（広告枠プレースホルダ）/ `SubscriptionCard`（AnglerLog Pro サブスク導線、disabled）。課金実装なし（別 Epic）

## スコープ外（別 Epic = ユーザー作業）

- 公開作業 / 課金実装 / 外部API / サーバDB / ストア申請
