'use client'

import { useState } from 'react'

const SECTIONS = [
  {
    title: 'このアプリの目的',
    body: 'Claude Codeに作業を渡し、作業結果を回収し、次のToDoや進捗に反映するためのローカル開発支援アプリです。',
  },
  {
    title: '基本フロー',
    body: `1. ホーム（/）で緊急の問題と今日やることを確認する
2. 今日の判断（/decide）で必要な判断だけタップで答える
3. あとはAI工場が定時（朝夜問わず）に自動で作業を進める
4. 結果はレポート（/report）や実行履歴（/logs）で確認する`,
  },
  {
    title: '各ページの役割',
    body: `ホーム(/): 緊急の問題・次回自動実行予定・今日やること・全体の状況を見る
ToDo管理: 着手判定、通常ToDo、今日の作業、完了アーカイブをまとめて管理する
キュー(今日の順番): OK済みToDoの作業プロンプトをコピーしてClaude Codeに渡す
案件: 案件ごとの進捗・blockers・nextActionを管理する
ログ: イベントログ・実行履歴・レビュー待ち・日別進捗を確認する`,
  },
  {
    title: 'ToDoの作り方',
    body: `【1件ずつ追加する場合】
1. 下部ナビの「ToDo」を押して ToDo管理画面 (/tasks) を開く
2. 画面上部の「+ ToDo追加」ボタンを押す
3. タスク名（必須）・対象アプリ・優先度・リスクを入力する
4. 作業内容欄に何をやるかを書く
5. 必要なら「詳細項目」を開いて taskPrompt・完了条件・許可/禁止事項を入力する
6. 「追加」を押すと一覧に反映される

【複数件まとめて追加する場合】
1. 画面上部の「↑ JSON取り込み」ボタンを押す
2. JSON取得用プロンプトをコピーし、ChatGPT/Claudeに渡す
3. 返ってきたJSONを貼り付けてプレビューし、一括保存する

※ ToDo追加フォームは1件ずつの単体追加専用です`,
  },
  {
    title: '着手判定の使い方',
    body: `着手判定はToDo管理（/tasks）の中に統合されています。「着手判定」セクションに承認待ちToDoが表示されます。

基本の流れ:
1. 下部ナビの「ToDo」を押す
2. 「着手判定」セクションの承認待ちToDoを確認する
3. 必要なら「作業指示プロンプトをコピー」で内容を確認する
4. 「今日の作業に追加」を押す（今日の順番に追加される）
5. 後回しにする場合はステータスを backlog / blocked などに編集する

カードのバッジ:
・承認待ち: ユーザー確認が必要なToDo
・優先度: high / medium / low
・担当: Claude / ユーザー / 両者
・完了条件 N件: doneCriteria が設定済み

risk high について:
・priority高でも risk high のタスクは作業前に影響範囲を確認してください
・不安な場合はステータスを blocked にして理由を残してください

フィルターの使い方:
・キーワード検索でタイトル・案件名・メモを絞り込める
・status / priority / 担当 / 案件で絞り込める
・完了済みは「完了アーカイブ」に分かれます`,
  },
  {
    title: '作業指示プロンプト（taskPrompt）の使い方',
    body: `作業指示プロンプト（taskPrompt）は、このToDo専用でClaude Codeに渡したい特別な指示です。

作業内容とtaskPromptの違い:
・作業内容（memo）: このToDoとして「何をやるか」を記録する欄
・taskPrompt: Claude Codeに「どう進めてほしいか」「どの点に注意してほしいか」を伝える欄

taskPromptの設定方法:
1. ToDo一覧を開く
2. 対象タスクの「編集」を押す
3. 「詳細フィールドを展開」を押す
4. 「作業指示プロンプト」欄に入力する
5. 「保存」を押す

taskPromptが設定されているタスクは:
・タスクカードに「📋 作業指示プロンプトをコピー」ボタンが表示される
・ToDo管理の「作業指示プロンプトをコピー」にも反映される
・今日の順番（キュー）の一括プロンプトにも含まれる`,
  },
  {
    title: 'Claude Codeへのプロンプト貼り付け',
    body: `1. 今日の順番（キュー）を開く
2. 対象ToDoのプロンプトをコピーする
3. Claude Codeのチャットに貼り付けて送信する
4. Claude Codeが作業を開始する
5. 作業中は status を in_progress にしておくと分かりやすい`,
  },
  {
    title: 'Claude Code完了報告の受け取り方',
    body: `1. Claude Codeが「実装完了報告」を出力する
2. 内容を確認する（変更ファイル・build結果・動作確認）
3. 問題なければ該当ToDoのstatusを done に変更する
4. 不備があれば status を todo に戻し、メモに追加作業内容を書く
5. blockedになった場合は blocked理由と解除方法を編集して記録する`,
  },
  {
    title: 'statusの意味',
    body: `todo: 未着手（着手判定の対象）
in_progress: Claude Code作業中
impl_done: 実装完了・検証未完了
local_done: ローカル確認済み・本番未確認
blocked: 判断待ち・エラー・環境問題で停止中
done: 完了
backlog: ストック（すぐ着手しない）`,
  },
  {
    title: 'ToDo編集方法',
    body: `1. ToDo一覧を開く
2. タスクカードの「編集」ボタンを押す
3. タイトル・ステータス・優先度・担当・メモを修正する
4. 「詳細フィールドを展開」を押すと完了条件・許可事項・禁止事項・リスク・blocked理由なども編集できる
5. 「保存」を押す
6. 「保存しました」が表示されれば完了`,
  },
  {
    title: 'JSON一括取り込み',
    body: `ChatGPTやClaudeに複数のToDo候補をJSONで作らせ、そのJSONを貼り付けると、まとめてToDoとして取り込めます。

基本手順:
1. ToDo一覧の「↑ JSON取り込み」を押して取り込み画面を開く
2. 「JSON取得用プロンプトをコピー」ボタンを押す
3. ChatGPTまたはClaudeにプロンプトを貼り付けて送信する
4. 返ってきたJSONを取り込み画面のテキストエリアに貼り付ける
5. 「プレビューを生成」ボタンを押す
6. プレビューで内容を確認し、必要なToDoだけチェックする
7. 保存先案件を選択して「保存する」を押す

注意:
・titleは必須（空のToDoは取り込まれません）
・既存ToDoは削除されません（追記のみ）
・保存前に必ずプレビューで内容を確認してください
・大きすぎる作業は小さいToDoに分けることをおすすめします
・priority / risk の不正値は自動でmediumに補正されます`,
  },
  {
    title: '実行履歴の登録方法（Claude Code向け）',
    body: `作業完了後、以下のエンドポイントに結果を登録してください。
登録するとログ画面の「実行履歴」タブに表示され、ChatGPTレビューへ渡せます。

エンドポイント: POST http://localhost:3010/api/execution-runs

必須フィールド:
・targetApp: 対象アプリ名 (例: ny01/progress)
・targetTodoTitle: 作業したToDoのタイトル
・runStatus: completed / failed / partial
・summary: 実施内容の概要
・rawReport: 完了報告の全文

任意フィールド:
・targetTodoId: ToDoのID
・changedFiles: [{file, change}] 変更ファイルと内容
・checks: {build, typescript, lint, mainScreen, mobileLayout}
・warnings: 未対応・注意点の配列
・nextActions: 次にやるべきことの配列

テンプレートのコピー方法:
ログ画面 → 「実行履歴」タブ → 「📬 実行履歴を登録する」を展開
→ 「JSONテンプレートをコピー」または「curlサンプルをコピー」

curlサンプル:
curl -X POST http://localhost:3010/api/execution-runs \\
  -H "Content-Type: application/json" \\
  -d '{"targetApp":"ny01/progress","targetTodoTitle":"ToDoタイトル","runStatus":"completed","summary":"実施内容","changedFiles":[{"file":"app/tasks/page.tsx","change":"修正"}],"checks":{"build":"OK","typescript":"OK"},"warnings":[],"nextActions":[],"rawReport":"完了報告"}'`,
  },
  {
    title: '困ったときの確認ポイント',
    body: `・着手判定に候補がない → ToDo管理でステータス「承認待ち」のToDoを確認する
・ToDoが見つからない → フィルターをリセットして全件表示する
・保存できない → タイトルが空になっていないか確認する
・トップに戻れない → 下部ナビの「ホーム」を押す（ダッシュボードは「/」）
・データがおかしい → /root/company/apps/ny01/progress/data/real/ 内のJSONを直接確認する`,
  },
]

export default function HelpModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="ヘルプを開く"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-bold"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">使い方ガイド</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {SECTIONS.map((s) => (
                <section key={s.title}>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{s.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{s.body}</p>
                </section>
              ))}
            </div>
            <div className="px-5 pb-6 pt-3 flex-shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
