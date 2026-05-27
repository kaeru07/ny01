---
title: 市場調査方針
type: research-policy
created: 2026-05-26
updated: 2026-05-26
status: active（毎日 Codex が自己レビューで軽微更新する正本）
tags: [market-research, policy, hermes, codex]
related:
  - "[[hermes-agent-codex-組み込み検討]]"
---

# 市場調査方針

> 毎日 07:00 / VPS 起動直後に hermes-market-research（systemd timer）が本ファイルを読み、Codex に渡して市場調査・AI ニュース・AI ツール・収益化分析・自己レビューを実行する。
> Codex は本ファイルの軽微な更新（情報源の入替・優先順位の微調整）のみ自動適用してよい。大きな方針変更は `market-research-method-review/YYYY-MM-DD.md` に提案のみ。

## 目的
個人開発・AI 開発工場・収益化に役立つ市場変化を毎日収集し、Vault へ蓄積する。

## 優先順位
1. 収益化しやすい
2. 短期リリース可能
3. Claude Code / Codex で量産しやすい
4. 動画化しやすい
5. AI エージェント化しやすい
6. 日本 / 海外両方で需要がある

## 毎日見る対象
- App Store
- Google Play
- AI ニュース
- AI ツール
- MCP
- AI Agent
- 個人開発市場
- Shorts / TikTok
- 麻雀
- 将棋
- 学習アプリ
- AI 自動化
- 広告収益系

## 自己レビュー観点
- 収益化に近かったか
- 情報源が偏っていないか
- 同じテーマばかり見ていないか
- 実装可能性があるか
- Claude Code / Codex 活用余地があるか
- 動画化余地があるか
- 次回改善点は何か

## 方針変更ルール
- 小さな改善は自動反映可（本ファイル末尾の「変更履歴」に 1 行追記する）
- 大きな変更は `market-research-method-review/YYYY-MM-DD.md` に提案のみ（本ファイルは触らない）
- 調査対象を広げすぎない（13 対象を上限とし、追加するなら入替）
- 収益化から遠い話題へ逸れない
- progress app には登録しない

## Codex への制約（毎回プロンプトに含める）
- Vault 配下の 06_research/daily-* と market-research-method-review/ のみ書き込み可
- progress JSON / data/ / 本番コード / .env / .git / 認証情報には触らない
- 外部公開・push・課金設定はしない
- API キー実値・SSH 鍵・本番 DB 接続文字列を出力しない
- 出力は本日付の Markdown 4 ファイル（市場調査 / AI ニュース / AI ツール / 自己レビュー）
- 本ファイル `market-research-method.md` は末尾「変更履歴」への 1 行追記のみ可（大きな変更は review 側へ）

## 変更履歴（軽微更新は Codex が 1 行ずつ追記）
- 2026-05-26 init: 初期方針作成（hermes-market-research v1 / systemd timer 起動）
