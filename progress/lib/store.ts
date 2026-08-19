import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { getDataPath } from './progress-reader'

// data/real（PROGRESS_DATA_PATH）配下の JSON / NDJSON を読み書きする汎用ヘルパー。
// operations-store などの新規ストアはこの薄いラッパー経由で永続化を行う。

function resolve(filename: string): string {
  return path.join(getDataPath(), filename)
}

export async function readJson<T>(filename: string, fallback: T): Promise<T> {
  const filePath = resolve(filename)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw new Error(`Failed to read JSON store ${filename}: ${(err as Error).message}`)
  }
}

async function fsyncFile(filePath: string): Promise<void> {
  const handle = await fs.open(filePath, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function fsyncDir(dirPath: string): Promise<void> {
  try {
    const handle = await fs.open(dirPath, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Directory fsync is not available on every filesystem. The file fsync + rename
    // still prevents partial JSON replacement on the common failure path.
  }
}

const writeQueues = new Map<string, Promise<void>>()

export async function writeJson<T>(filename: string, data: T): Promise<void> {
  const filePath = resolve(filename)
  const previous = writeQueues.get(filePath) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(async () => {
    const dirPath = path.dirname(filePath)
    await fs.mkdir(dirPath, { recursive: true })
    const tmpPath = path.join(dirPath, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`)
    try {
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
      await fsyncFile(tmpPath)
      await fs.rename(tmpPath, filePath)
      await fsyncDir(dirPath)
    } catch (err) {
      await fs.unlink(tmpPath).catch(() => undefined)
      throw err
    }
  })
  writeQueues.set(filePath, next)
  try {
    await next
  } finally {
    if (writeQueues.get(filePath) === next) writeQueues.delete(filePath)
  }
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
