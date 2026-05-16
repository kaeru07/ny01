'use client'

import { useState } from 'react'

const SNS_TREND_REVIEW_TEXT = `# AIトレンドSNS運用メモ

前提:
ニュースメモ・過去バズ投稿・宣伝URLは未提供のため、2026年5月5日時点の公開情報と、直近の開発ログ「将棋囲いトレーナーの各モードを対局開始時の駒配置から始める修正」を元に作成。

## 1. 今日投稿すべきトピックTOP5

1. GPT-5.5がCodex/ChatGPTに展開
個人開発者には「AIに丸投げ」ではなく、実装から検証まで任せる粒度をどう設計するかが重要。
出典: https://openai.com/index/introducing-gpt-5-5/

2. Anthropicが企業向けAIサービス会社を設立
Claudeは単体ツールから、業務に入り込む実装支援へ。個人開発でも「業務フローにAIを組み込む設計」が差別化になりそう。
出典: https://www.anthropic.com/news/enterprise-ai-services-company

3. Google I/O 2026はGemini・agentic codingが焦点
5月19〜20日に向けて、Android/Chrome/Cloud連携のAI開発ネタを追う価値あり。
出典: https://developer.android.com/blog/posts/get-ready-for-google-io-may

4. Microsoft Build 2026はAI実装ワークフロー寄り
「実コード・実システム・実ワークフロー」を強調。個人開発者も“デモAI”より“運用できるAI”がテーマ。
出典: https://developer.microsoft.com/en-us

5. AI×セキュリティが開発者の必須テーマに
AIで脆弱性発見が速くなる一方、悪用リスクも増える。AIコーディング時のレビュー・権限設計が重要。
出典: https://blogs.microsoft.com/on-the-issues/2026/05/01/from-capability-to-responsibility-securing-our-global-digital-ecosystem-with-next-generation-ai/

## 2. X投稿案10本

1.
GPT-5.5の話で個人開発者が見るべき点は「賢くなった」より、Codexで長めの実装・検証を任せやすくなっている点だと思う。
ただし任せるほど、仕様・テスト・差分確認の書き方が重要になる。AI時代の開発力は、指示力より運用設計力に寄っていきそう。
出典: https://openai.com/index/introducing-gpt-5-5/

2.
最近のAIコーディングは「1ファイル修正」から「作業ログを読んで、続きから実装して、lint/buildして、pushする」方向に進んでいる。
個人開発では、AIに渡す前提情報をREADMEや開発ログに残すだけで継続作業の精度がかなり変わる。地味だけど効く。

3.
ClaudeやCodexを使う時、最初に整えるべきなのはプロンプトより「作業の終わりの定義」かもしれない。
例: 変更範囲、テスト、ビルド、push有無、触ってはいけないファイル。
ここが曖昧だと、AIが賢くても最後の詰めで事故りやすい。

4.
Anthropicが企業向けAIサービス会社を作る流れを見ると、AIはチャット画面から業務フローの中に入っていく段階に見える。
個人開発者にも関係あって、単発AI機能より「ユーザーの作業を最後まで進めるAI導線」を作れる人が強くなりそう。
出典: https://www.anthropic.com/news/enterprise-ai-services-company

5.
Google I/O 2026ではGeminiやagentic codingが焦点になりそう。
個人開発者としては、新モデルの性能比較だけでなく「Android/Chrome/CloudのどこにAI導線が標準搭載されるか」を見たい。
API単体より、OSやブラウザに入るAIの方がアプリ設計に影響しやすい。
出典: https://developer.android.com/blog/posts/get-ready-for-google-io-may

6.
AIコーディングで最近強く感じるのは、AIに「実装して」だけ投げるより、「既存差分を壊さず、検証して、失敗理由も残して」と頼む方が実務に近いこと。
速さだけを見ると危ないけど、レビュー可能な単位に分ければ個人開発の継続力はかなり上がる。

7.
今日の開発ログ: 将棋囲いトレーナーで、誘導モード・テストモードの開始盤面を「対局開始時の駒配置」に揃えた。
こういう小さな体験差はAI機能より地味だけど、学習アプリではかなり大事。ユーザーが迷う場所を消すのも立派な改善。

8.
AI×セキュリティの話は、個人開発者にも他人事ではない。
AIにコード修正を任せるほど、権限・環境変数・外部コマンド・依存追加の扱いを決めておく必要がある。
「AIが便利」なほど、レビュー観点もアップデートした方がよさそう。
出典: https://blogs.microsoft.com/on-the-issues/2026/05/01/from-capability-to-responsibility-securing-our-global-digital-ecosystem-with-next-generation-ai/

9.
Microsoft Build 2026の打ち出しは「real code, real systems, real workflows」。
これはAI開発でも同じで、見栄えのするデモより、既存プロジェクトで動いて、テストできて、運用に乗るものが価値になる。
個人開発でも“完成後の運用”まで作る意識が大事。
出典: https://developer.microsoft.com/en-us

10.
AIコーディングの投稿で伸びやすいのは、新機能紹介より「自分の作業がどう変わったか」。
例: 途中で止まったClaude Code実装をCodexで引き継ぎ、lint/buildしてpushまで完了。
ニュースを自分の開発ログに接続すると、個人開発者向けの価値が出しやすい。

## 3. 優先投稿3本

優先1: 投稿案1
GPT-5.5 × Codexで今日性があり、個人開発者への示唆も強い。

優先2: 投稿案7
自分の開発ログ由来で独自性がある。ニュース投稿ばかりより信頼が出る。

優先3: 投稿案4
Anthropicの企業AIサービス化を、個人開発の設計論に落とせる。

## 4. YouTube Shorts台本

タイトル: AIコーディングで差がつくのは「指示」より「終わりの定義」

0〜3秒
「Claude CodeやCodex、便利だけど途中で止まった経験ありませんか？」

4〜15秒
「最近のAIは、実装だけじゃなく、差分確認、lint、build、pushまで任せやすくなっています。GPT-5.5も、長めのコーディング作業が強化されたと発表されています。」

16〜35秒
「でも大事なのは“実装して”と投げることではなく、終わりの定義です。どのファイルを触るか。テストは何を通すか。pushするか。触ってはいけない変更は何か。」

36〜50秒
「今日、自分の将棋囲いトレーナーでも、途中で止まった修正を引き継いで、開始盤面を対局開始時の駒配置に揃え、lint/build/pushまで完了しました。」

51〜60秒
「AI時代の個人開発は、速く書く力より、AIが安全に最後まで進める作業設計が効いてきそうです。」

出典表示:
https://openai.com/index/introducing-gpt-5-5/

## 5. note/blog記事に伸ばせる案

タイトル案:
Claude Code / Codexに途中実装を引き継がせる時の実践メモ

構成:
- なぜ途中実装はAIにとって難しいのか
- 最初に確認させるもの: git status、差分、関連ファイル、過去ログ
- 依頼文に入れるべき項目: 目的、変更範囲、完了条件、検証、push有無
- 実例: 将棋囲いトレーナーの開始盤面修正
- AIに任せてよい作業、任せる前に人間が決めるべき作業
- まとめ: プロンプトより「開発運用」が効く

## 6. 投稿時の注意点

- GPT-5.5やClaude関連は「できる」と断定しすぎず、「任せやすくなっている」「方向に見える」に留める。
- 企業向けニュースを個人開発者向けに言い換える時は、元記事にない効果を盛らない。
- 自分の開発ログ投稿は、宣伝より「具体的に何を直したか」を先に出す。
- 出典URLはスレッド末尾かリプに残す。
- 未確認のリーク・噂は優先度を下げる。使う場合は「報道ベース」「未発表情報」と明記する。`

export default function SnsTrendReviewPanel() {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copyText() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SNS_TREND_REVIEW_TEXT)
      } else {
        const ta = document.createElement('textarea')
        ta.value = SNS_TREND_REVIEW_TEXT
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyState('copied')
    } catch {
      setCopyState('error')
    } finally {
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-sky-100 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-sky-600 dark:text-sky-300">SNS運用レビュー</p>
          <h2 className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100">AIトレンド投稿案</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            前回作成したAIトレンドSNS運用案です。投稿文・Shorts台本・note案をまとめてコピーできます。
          </p>
        </div>
        <button
          onClick={copyText}
          className={`flex-shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            copyState === 'copied'
              ? 'bg-green-600 text-white'
              : copyState === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-sky-600 text-white hover:bg-sky-700'
          }`}
        >
          {copyState === 'copied' ? 'コピー済み ✓' : copyState === 'error' ? 'コピー失敗' : '全文コピー'}
        </button>
      </div>

      <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-white/70 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
        <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 dark:text-gray-200">
          {SNS_TREND_REVIEW_TEXT}
        </pre>
      </div>
    </section>
  )
}
