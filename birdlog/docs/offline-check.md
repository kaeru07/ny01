# オフライン動作確認記録 — BirdLog MVP

- 確認日: 2026-06-12
- 確認者: Claude（Factory Dispatch / epic-birdlog-mvp-local-first-）
- 対象: BirdLog MVP（local-first / 外部 API なし）

## 検証コマンドと結果

| 項目 | コマンド | 結果 |
|---|---|---|
| typecheck | `npm run typecheck`（tsc --noEmit） | ✅ エラー 0 |
| build | `npm run build`（next build） | ✅ 成功・全 8 ルート Static prerender |
| lint | `npm run lint`（next lint） | ✅ No ESLint warnings or errors |
| 起動スモーク | `next start -p 3017` + curl | ✅ `/` `/observations` `/dex` `/map` `/stats` すべて HTTP 200 |

## オフライン動作の根拠（コード／ビルド確認）

1. **全ルートが Static prerender**: `next build` の出力で全 8 ルートが `○ (Static)`。サーバーサイドのデータ取得なし。
2. **外部リソース参照ゼロ**: レンダリング済み HTML に外部 URL（CDN / フォント / タイルサーバー）が一切含まれないことを curl + grep で確認。`next/font` 不使用、Google Fonts 等の読み込みなし。
3. **データ永続化は localStorage のみ**（`lib/storage.ts`、キー `birdlog.observations.v1`）。外部 DB・API への fetch はコードベースに存在しない。
4. **野鳥マスタは静的同梱**（`lib/birds.ts`、60 種・和名/英名/科/生息環境）。種選択（`SpeciesPicker`）は同梱データのみで動作。
5. **目撃マップはオフラインタイル**（`lib/geo.ts`）: OSM 等の外部タイルサーバーを使わず、日本の概略 bbox を手続き生成グリッドタイルとして SVG 描画。座標は 0.1 度（約 11km）に丸めて匿名化（`lib/location.ts`）。
6. **写真は端末内処理**（`lib/image.ts`）: Canvas API で縮小し DataURL として localStorage に保存。アップロードなし。
7. **統計は端末内集計**（`lib/stats.ts`）: 月別・種別・全体サマリーを localStorage の記録のみから計算。

## 結論

初回ロード後（および静的ファイル配信下で）、MVP 主要機能（種選択 / 観察記録 CRUD / 図鑑コレクション / 目撃マップ / 統計）はネットワーク通信なしで動作する。通信を必要とするコードパスは存在しない。

## 残課題（MVP 外）

- Service Worker / PWA manifest 未導入のため、「ブラウザ完全オフライン起動（キャッシュからのロード）」は未対応。現状は配信元に到達できる環境での初回ロードが必要。PWA 化は次フェーズ候補。
