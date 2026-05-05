export type NewsCategory =
  | 'model'
  | 'coding'
  | 'product'
  | 'research'
  | 'business'
  | 'security'
  | 'other'

export type IdeaType = 'x' | 'shorts' | 'note'
export type Platform = 'x' | 'youtube' | 'note' | 'blog' | 'other'

export interface NewsItem {
  id: string
  title: string
  sourceUrl: string
  sourceName: string
  summary: string
  category: NewsCategory
  importance: number
  memo: string
  createdAt: string
}

export interface ContentIdea {
  id: string
  type: IdeaType
  title: string
  content: string
  sourceNewsIds: string[]
  createdAt: string
}

export interface PostLog {
  id: string
  postedAt: string
  platform: Platform
  content: string
  impressions: number
  likes: number
  bookmarks: number
  replies: number
  follows: number
  category: NewsCategory
}

export interface SnsData {
  news: NewsItem[]
  ideas: ContentIdea[]
  posts: PostLog[]
}
