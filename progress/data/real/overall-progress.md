# Overall Progress Summary

Updated: 2026-04-28T10:05:00+09:00

## Summary

progress 正本運用レビュー反映完了（assignee 導入・done 段階拡張・nextAction 原子更新・stale status 解消）。shogi-kakoi-trainer / mahjong / ny-ai は全 Claude タスク完了、ユーザー操作待ちステータスに移行。company-mgmt は全タスク完了。

## Claude が今すぐ着手できるタスク

現在なし（全 Claude 担当タスク完了）

次の Claude 作業候補:
- memo: シナリオデータ追加（assignee=claude・優先度 medium）
- ny01/mahjong-trainer: ロン判定・RIICHI 完全実装（assignee=claude・任意）

## ユーザー操作待ちタスク

- shogi-kakoi-trainer: 本番確認 → https://shogi-kakoi-trainer.vercel.app/records
- mahjong: git push origin main → Vercel 自動デプロイ
- ny-ai: Vercel 管理画面で URL 確認 または git push

## Completed

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

1. ユーザー操作: shogi-kakoi-trainer / mahjong / ny-ai のデプロイ確認
2. Claude: memo シナリオデータ追加（任意・medium）
3. Claude: ny01/mahjong-trainer ロン実装（任意・low）
