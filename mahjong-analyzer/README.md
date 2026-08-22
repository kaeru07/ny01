# mahjong-analyzer（このディレクトリは正本ではありません）

**麻雀手牌解析AI（`com.kaeru07.mahjonganalyzer`）の正本は `/root/company/apps/mahjong-analyzer`（GitHub: `kaeru07/mahjong-analyzer`）です。**
このディレクトリでは作業しないでください。

## 経緯（2026-08-22）

同名のアプリが2箇所に存在し、両方が更新される状態になっていました。

- `apps/mahjong-analyzer` — 独立リポジトリ。解析エンジンV2（`@kobalab/majiang-core` を正本計算に採用）、
  `codemagic.yaml`、`fastlane`（ストア用メタデータ・スクリーンショット）、`ios/`、アプリアイコンを持ち、
  **TestFlight まで到達済み**。progress の「審査提出準備」タブ（`/app-review-fields`）が参照するのもこちら
- `apps/ny01/mahjong-analyzer`（ここ） — AI工場が作業していたコピー。ストア提出用の設定を持たない

取り違え事故を防ぐため、**正本を `apps/mahjong-analyzer` に一本化**し、このディレクトリの中身は削除しました。

## ここにあった作業の行き先

エンジンV2と競合しない改善は、すべて正本側へ移植済みです（`kaeru07/mahjong-analyzer` の commit `b7317bd`）。

- 入力途中の下書き保存・復元（handDraft）
- パーサーの入力検証強化（全角のNFKC正規化 / 実行時の型ガード / 赤ドラ・枚数の検証）
- スクリーンリーダー向けの日本語牌名と読み上げラベル
- 役の出入り表示（出る役 / 消える役）
- 打牌候補カードの順位バッジ・簡易ラベル・有効牌なしの明示
- error / global-error / not-found / manifest、PWA・iOSメタデータ、safe-area
- `docs/store-readiness.md`

移植しなかったもの:

- **Expo (React Native) 版の試作** — Capacitor + Codemagic 継続の判断により不採用
- **テキスト入力UI** — 牌タップ入力へ一本化する判断のため
- handDraft の非同期ストレージAPI — Expo 専用のため

## 削除前の状態を見たい場合

削除前のファイルは ny01 の履歴に残しています。

```bash
git show b14ee68 --stat -- mahjong-analyzer   # 削除前のチェックポイント
git checkout b14ee68 -- mahjong-analyzer      # 必要なら復元
```
