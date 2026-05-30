import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'

// data/real（PROGRESS_DATA_PATH）配下の JSON / NDJSON を読み書きする汎用ヘルパー。
// operations-store などの新規ストアはこの薄いラッパー経由で永続化を行う。

function resolve(filename: string): string {
  return path.join(getDataPath(), filename)
}

export async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(resolve(filename), 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return fallback
  }
}

export async function writeJson<T>(filename: string, data: T): Promise<void> {
  const filePath = resolve(filename)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function appendNdjson<T>(filename: string, entry: T): Promise<void> {
  const filePath = resolve(filename)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8')
}

export async function readNdjson<T>(filename: string): Promise<T[]> {
  try {
    const content = await fs.readFile(resolve(filename), 'utf-8')
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as T)
  } catch {
    return []
  }
}
