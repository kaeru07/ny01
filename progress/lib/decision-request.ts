export interface DecisionRequest {
  question: string
  options: string[]
  recommended?: string
}

const MARKER = '[判断要求]'
const RECOMMENDED_PREFIX = '推奨:'
const MAX_REQUESTS = 3

export function parseDecisionRequests(text: string): DecisionRequest[] {
  const requests: DecisionRequest[] = []

  for (const line of text.split(/\r?\n/)) {
    if (requests.length >= MAX_REQUESTS) break
    const trimmed = line.trim()
    if (!trimmed.startsWith(MARKER)) continue

    const body = trimmed.slice(MARKER.length).trim()
    const parts = body.split(' | ').map((part) => part.trim()).filter(Boolean)
    const question = parts[0] ?? ''
    if (!question) continue

    let recommended: string | undefined
    const options: string[] = []
    for (const part of parts.slice(1)) {
      if (part.startsWith(RECOMMENDED_PREFIX)) {
        const value = part.slice(RECOMMENDED_PREFIX.length).trim()
        if (value) recommended = value
      } else {
        options.push(part)
      }
    }

    if (options.length < 2 || options.length > 4) continue
    requests.push({ question, options, recommended })
  }

  return requests
}
