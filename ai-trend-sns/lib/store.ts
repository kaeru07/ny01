import { promises as fs } from 'fs'
import path from 'path'
import type { ContentIdea, NewsItem, PostLog, SnsData } from '@/types/sns'

const dataDir = path.join(process.cwd(), 'data')

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(path.join(dataDir, fileName), 'utf-8')
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

async function writeJson<T>(fileName: string, data: T): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(data, null, 2), 'utf-8')
}

export async function readNews(): Promise<NewsItem[]> {
  return readJson<NewsItem[]>('news.json', [])
}

export async function readIdeas(): Promise<ContentIdea[]> {
  return readJson<ContentIdea[]>('ideas.json', [])
}

export async function readPosts(): Promise<PostLog[]> {
  return readJson<PostLog[]>('posts.json', [])
}

export async function readAllData(): Promise<SnsData> {
  const [news, ideas, posts] = await Promise.all([readNews(), readIdeas(), readPosts()])
  return { news, ideas, posts }
}

export async function addNews(item: NewsItem): Promise<NewsItem> {
  const news = await readNews()
  const next = [item, ...news]
  await writeJson('news.json', next)
  return item
}

export async function addIdeas(items: ContentIdea[]): Promise<ContentIdea[]> {
  const ideas = await readIdeas()
  const next = [...items, ...ideas]
  await writeJson('ideas.json', next)
  return items
}

export async function addPost(item: PostLog): Promise<PostLog> {
  const posts = await readPosts()
  const next = [item, ...posts]
  await writeJson('posts.json', next)
  return item
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
