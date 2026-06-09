# 市場調査ビュー（/research）の Vault 同期・運用メモ

news-app の市場調査ビューが参照するデータの出所と、Vault 最新日次を本番（Vercel）へ
反映するための同期の仕組みをまとめる。

## データ参照先（lib/research/vault.ts `resolveResearchRoot()`）

優先順位:

1. 環境変数 `VAULT_RESEARCH_ROOT`（明示指定があればそれ）
2. **VPS / ローカル**: Vault 本体 `/root/company/obsidian-vault/06_research` が存在すればそれを直読み
   → 日次更新が即反映される（同梱コピー待ち不要）
3. **Vercel など Vault 本体が無い環境**: news-app 同梱の `content/research`（リポジトリにコミットされた copy）

> [!important] Vercel は Vault 本体を読まない
> Vercel のビルド・実行環境には `/root/company/obsidian-vault` が存在しない。
> したがって **Vercel 本番は必ず同梱 `content/research` を読む**。
> 本番の鮮度は「`content/research` がどこまでコミット・push されているか」で決まる。
> `content/research` が古いと、Vault が最新でも本番だけ古い日付で止まって見える
> （実際に 2026-05-27 で停止する不具合が発生した）。

`/research` 画面は `export const dynamic = "force-dynamic"` のため、各環境で参照先を
リクエスト毎に再スキャンする。スキャン状態（参照ルート種別 / 最新日付 / 件数 / partial 件数 /
更新ステータス / 最終スキャン時刻）は画面上部のステータスバーに表示され、`RescanButton`
（`/api/research/rescan`）で手動再スキャンできる。

## 同期スクリプト

| スクリプト | 役割 |
|---|---|
| `scripts/sync-research-content.mjs` | Vault(06_research) → 同梱 `content/research` を同期（破壊削除なし / `--dry-run` 可）。`npm run sync:research` / `prebuild` から呼ばれる |
| `scripts/auto-sync-research.sh` | 上記同期を実行し、`content/research` に差分があれば **ny01 リポジトリへ commit & push**（→ Vercel 自動再デプロイ）。機密スキャン・想定外パス検知・ログ付き |

手動同期:

```bash
cd /root/company/apps/ny01/news-app
npm run sync:research          # 同梱コピーのみ更新（commit はしない）
bash scripts/auto-sync-research.sh   # 同期 + 差分があれば commit/push
```

## 自動実行（朝の日次フロー連携）

毎朝 07:00 の `hermes-market-research.timer`（systemd）→ `run-market-research.sh` が
日次調査を生成し Vault を更新する。その末尾で本 news-app 同期がチェーンされる:

```
hermes 日次生成 (06_research/daily-*)
  → index 更新
  → ob sync（iPhone Obsidian）
  → sync-market-research-to-git-vault.sh（obsidian-vault へ push）
  → auto-sync-research.sh（news-app content/research を同期し ny01 へ push）   ← 追加
       → Vercel 自動再デプロイ → 本番 /research が最新日付に追いつく
```

- **差分がある場合のみ** commit/push する（no-diff は no-op で正常終了）
- 失敗しても朝フロー全体は成功扱い（次回 07:00 で追いつく）
- ログ: `/root/company/logs/news-app-research-sync.log`（成功・失敗とも記録）

## トラブルシュート

- 本番だけ日付が古い → `news-app-research-sync.log` を確認。push 失敗が無いか、`content/research`
  に差分が出ているかを見る。手動で `bash scripts/auto-sync-research.sh` を実行
- 同期は走るが Vercel が古い → `vercel ls`（プロジェクト `ny1/news-app`）で最新デプロイの
  Status=Ready と Age を確認。本番エイリアスは `news-app-delta-lake.vercel.app`
- VPS ローカルサーバーは Vault 本体を直読みするため、同梱コピーが古くても VPS 側は最新に見える。
  本番鮮度は必ず Vercel 本番 URL で確認する
