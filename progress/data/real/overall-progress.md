# Overall Progress Summary

Updated: 2026-05-12T11:40:00+09:00

## Summary

ny01/progress の JSON取り込み画面のテンプレートコピーボタンに3段フォールバックを実装。navigator.clipboard 不可環境でも execCommand で動作し、両方失敗時は手動コピーUIを表示。work-queue は空。

## Claude が今すぐ着手できるタスク

現在なし（work-queue が空）

次の Claude 作業候補（未承認 or backlog のため要追加）:
- memo: シナリオデータ追加（assignee=claude・優先度 medium）
- ny01/mahjong-trainer: ロン判定・RIICHI 完全実装（assignee=claude・任意）

## ユーザー操作待ちタスク

- shogi-kakoi-trainer: Mac で pod install → Xcode ビルド → Bundle ID 変更 → App Store 提出
- mahjong: git push origin main → Vercel 自動デプロイ
- ny-ai: Vercel 管理画面で URL 確認 または git push

## Completed

- ny01/progress: JSON取り込み画面テンプレートコピーボタン3段フォールバック実装（2026-05-12）
  - lib/clipboard.ts 新設
  - JsonImportManager.tsx の copyToClipboard をユーティリティ経由に変更
  - tsc/build 成功 / runId: 20260512-205138
- shogi-kakoi-trainer: App Store公開向け整備（2026-05-07）
  - output:export 化・全ルート静的生成（generateStaticParams）
  - Capacitor インストール・cap add ios・cap sync 済み
  - PWA manifest / icon.svg / icon-192.png / icon-512.png 生成
  - 1024x1024 AppIcon・2732x2732 Splash 生成（sharp）
  - LaunchScreen をベージュ背景・アイコン中央配置に更新
  - Info.plist 縦向き専用に変更
  - マイページを設定・情報画面に刷新（進捗・プライバシー・免責）
  - commit: a5d9480, f2d147f
- map (NetScope): 全機能確認済み・DB実データ5215件
- note (Scrape Lab): スクレイピング実動作確認完了
- ny01/mahjong-quiz: クイズフロー全確認済み
- ny01/news-app: Vercelデプロイ済み・本番稼働中
- shogi-kakoi-trainer: v1実装・学習記録機能・Vercelデプロイ済み（2026-04-26〜28）
- company-mgmt: progress app連携設計・ダークモード・日別進捗ページ・レビュー反映

## In Progress

- memo: full-stack確認済み（85%）→ シナリオデータ追加 or デプロイ方針決定
- ny01/mahjong-trainer: engine/domain確認済み（75%）→ 任意でロン実装 or デプロイ

## Blockers

- ny-note / copy-repo / claude-dev-studio: Supabase URL / ANON_KEY 未入手（ユーザー手元）

## Next Action

1. ユーザー操作: shogi-kakoi-trainer → Mac で pod install → Xcode → App Store 提出
2. ユーザー操作: mahjong / ny-ai のデプロイ確認
3. Claude: memo シナリオデータ追加（任意・medium）
