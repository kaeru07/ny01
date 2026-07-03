import fs from 'fs/promises'
import path from 'path'

const RESEARCH_PATH =
  process.env.RESEARCH_CONTENT_PATH || path.join(process.cwd(), '..', 'news-app', 'content', 'research')

export interface MarketResearchSeed {
  date: string
  genres: string[]
  monetizationHints: string[]
}

export interface AiNewsSeed {
  date: string
  highlights: string[]
}

async function listRecentFiles(category: string, days: number): Promise<Array<{ date: string; path: string }>> {
  const dir = path.join(RESEARCH_PATH, category)
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  return names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, days)
    .map((n) => ({ date: n.replace(/\.md$/, ''), path: path.join(dir, n) }))
}

async function readLatestMarkdown(category: string, maxDays: number): Promise<{ date: string; markdown: string } | null> {
  const files = await listRecentFiles(category, maxDays)
  const latest = files[0]
  if (!latest) return null
  try {
    return { date: latest.date, markdown: await fs.readFile(latest.path, 'utf-8') }
  } catch {
    return null
  }
}

function sectionBulletLines(markdown: string, headingPattern: RegExp): string[] {
  const lines = markdown.split('\n')
  const out: string[] = []
  let inSection = false
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = headingPattern.test(line)
      continue
    }
    if (!inSection) continue
    if (!line.startsWith('- ')) continue
    const item = line.slice(2).trim()
    if (item) out.push(item)
  }
  return out
}

export async function readMarketResearchSeed(maxDays = 3): Promise<MarketResearchSeed | null> {
  try {
    const latest = await readLatestMarkdown('daily-market-research', maxDays)
    if (!latest) return null
    return {
      date: latest.date,
      genres: sectionBulletLines(latest.markdown, /注目ジャンル/).slice(0, 5),
      monetizationHints: sectionBulletLines(latest.markdown, /収益化ヒント/).slice(0, 5),
    }
  } catch {
    return null
  }
}

export async function readAiNewsSeed(maxDays = 3): Promise<AiNewsSeed | null> {
  try {
    const latest = await readLatestMarkdown('daily-ai-news', maxDays)
    if (!latest) return null
    const bullets = sectionBulletLines(latest.markdown, /今日重要だったニュース/)
    const highImpact = bullets.filter((line) => /影響度[:：]\s*高/.test(line))
    return {
      date: latest.date,
      highlights: (highImpact.length > 0 ? highImpact.slice(0, 5) : bullets.slice(0, 3)),
    }
  } catch {
    return null
  }
}
