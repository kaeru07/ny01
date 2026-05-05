import type { ContentIdea, NewsItem } from '@/types/sns'
import { createId } from './store'

const categoryLabel: Record<string, string> = {
  model: 'モデル',
  coding: 'AIコーディング',
  product: 'プロダクト',
  research: '研究',
  business: 'ビジネス',
  security: 'セキュリティ',
  other: 'その他',
}

function pickNews(news: NewsItem[]): NewsItem[] {
  return [...news]
    .sort((a, b) => b.importance - a.importance || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
}

function sourceLine(items: NewsItem[]): string {
  return items.map((n) => `${n.sourceName}: ${n.sourceUrl}`).join('\n')
}

export function generateIdeas(news: NewsItem[]): ContentIdea[] {
  const items = pickNews(news)
  const now = new Date().toISOString()
  const main = items[0]

  if (!main) {
    return [
      {
        id: createId('idea'),
        type: 'x',
        title: 'ニュース未登録時の投稿案',
        content: '今日のAIニュースを1件登録してから投稿案を生成してください。個人開発者にどう関係するか、実装や運用の観点まで落とすと投稿にしやすくなります。',
        sourceNewsIds: [],
        createdAt: now,
      },
    ]
  }

  const category = categoryLabel[main.category] ?? main.category
  const sourceIds = items.map((n) => n.id)
  const sources = sourceLine(items)
  const relatedTitles = items.map((n) => `- ${n.title}`).join('\n')

  return [
    {
      id: createId('idea'),
      type: 'x',
      title: `X投稿案: ${main.title}`,
      content: `${main.title} は、単なるAIニュースとして見るより「個人開発の作業設計がどう変わるか」で見ると使いやすい。\n\n特に${category}領域では、個人開発者も新機能紹介だけでなく、実装・検証・運用にどう組み込むかを考えたい。\n\n出典:\n${sources}`,
      sourceNewsIds: sourceIds,
      createdAt: now,
    },
    {
      id: createId('idea'),
      type: 'x',
      title: 'X投稿案: 開発者向け切り口',
      content: `AIトレンドを追う時、個人開発者が見るべきなのは「すごいか」だけではなく「明日の作業がどう変わるか」だと思う。\n\n今日見るならこのあたり:\n${relatedTitles}\n\n仕様づくり、実装、レビュー、投稿運用のどこに効くかまで落とすと使える情報になる。`,
      sourceNewsIds: sourceIds,
      createdAt: now,
    },
    {
      id: createId('idea'),
      type: 'shorts',
      title: 'Shorts台本: AIニュースを個人開発に変える',
      content: `0〜3秒: AIニュース、多すぎて追いきれないですよね。\n\n4〜15秒: でも個人開発者が見るポイントはシンプルです。新機能そのものより、自分の開発フローのどこが短くなるかを見る。\n\n16〜35秒: 今日の注目は「${main.title}」。これは${category}の話ですが、個人開発では実装、検証、運用のどこに置けるかが大事です。\n\n36〜55秒: ニュースをそのまま拡散するより、自分の開発ログと接続すると価値が出ます。\n\n56〜60秒: AIトレンドは、明日の作業に変換してから使いましょう。\n\n出典:\n${sources}`,
      sourceNewsIds: sourceIds,
      createdAt: now,
    },
    {
      id: createId('idea'),
      type: 'note',
      title: 'note記事案: AIトレンドを個人開発に落とす方法',
      content: `タイトル案: AIトレンドを個人開発の作業に変える読み方\n\n構成:\n1. ニュースを丸写ししない理由\n2. 今日の注目ニュース\n${relatedTitles}\n3. 個人開発者に関係する観点: 実装、検証、運用、発信\n4. Claude Code / Codex利用者ならどう使うか\n5. 自分の開発ログとつなげて投稿するテンプレート\n6. 注意点: 断定しすぎない、出典を残す、煽らない\n\n出典:\n${sources}`,
      sourceNewsIds: sourceIds,
      createdAt: now,
    },
  ]
}
