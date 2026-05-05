import type { NewsCategory, PostLog, SnsData } from '@/types/sns'

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getEngagement(post: PostLog): number {
  return post.likes * 2 + post.bookmarks * 3 + post.replies * 4 + post.follows * 6 + Math.round(post.impressions / 500)
}

export function getDashboardStats(data: SnsData) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const weekStart = startOfWeek(now)
  const postedThisWeek = data.posts.filter((p) => new Date(p.postedAt) >= weekStart)
  const todayIdeas = data.ideas.filter((i) => i.createdAt.slice(0, 10) === today)
  const postedContent = new Set(data.posts.map((p) => p.content.trim()))
  const unposted = data.ideas.filter((i) => !postedContent.has(i.content.trim()))

  return {
    todaySchedule: todayIdeas,
    unpostedCount: unposted.length,
    bestPosts: [...data.posts].sort((a, b) => getEngagement(b) - getEngagement(a)).slice(0, 3),
    weeklyPostCount: postedThisWeek.length,
  }
}

export function getWeeklyReport(posts: PostLog[]) {
  const topPosts = [...posts].sort((a, b) => getEngagement(b) - getEngagement(a)).slice(0, 10)
  const categoryScores = posts.reduce<Record<NewsCategory, { count: number; score: number }>>((acc, post) => {
    const current = acc[post.category] ?? { count: 0, score: 0 }
    acc[post.category] = {
      count: current.count + 1,
      score: current.score + getEngagement(post),
    }
    return acc
  }, {} as Record<NewsCategory, { count: number; score: number }>)

  const topCategories = Object.entries(categoryScores)
    .map(([category, value]) => ({
      category: category as NewsCategory,
      count: value.count,
      score: value.score,
      average: value.count > 0 ? Math.round(value.score / value.count) : 0,
    }))
    .sort((a, b) => b.average - a.average)

  const nextThemes = topCategories.slice(0, 3).map((c) => {
    if (c.category === 'coding') return 'Claude Code / Codexの実作業ログを、再現できる手順つきで投稿する'
    if (c.category === 'model') return '新モデルの性能紹介だけでなく、個人開発の使いどころに絞って投稿する'
    if (c.category === 'security') return 'AIコーディング時の権限・レビュー・安全運用をテーマ化する'
    return `${c.category}カテゴリの反応が良い投稿を、開発者向けの実例に寄せて深掘りする`
  })

  return { topPosts, topCategories, nextThemes }
}
