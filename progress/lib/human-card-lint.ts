export interface MachineTextIssue {
  rule: string
  sample: string
}

const JAPANESE_RE = /[ぁ-んァ-ン一-龯]/
const URL_RE = /https?:\/\/\S+/i

function sample(value: string): string {
  return value.trim().slice(0, 120)
}

function withoutQuotedText(line: string): string {
  return line.replace(/『[^』]*』/g, '').replace(/「[^」]*」/g, '')
}

function pushIssue(issues: MachineTextIssue[], seen: Set<string>, rule: string, value: string): void {
  const key = `${rule}:${value}`
  if (seen.has(key)) return
  seen.add(key)
  issues.push({ rule, sample: sample(value) })
}

export function findMachineTextIssues(text: string): MachineTextIssue[] {
  const issues: MachineTextIssue[] = []
  const seen = new Set<string>()

  const iso = text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/)
  if (iso) pushIssue(issues, seen, 'iso_datetime', iso[0])

  const internalId = text.match(/\b(?:appr-\d+(?:-\d+)?|\d{8}-\d{6}|goal-[a-z0-9-]+|epic-[a-z0-9-]+|know-\d+)\b/i)
  if (internalId) pushIssue(issues, seen, 'internal_id', internalId[0])

  const internalEnum = text.match(/\bblock\d+\b/i)
  if (internalEnum) pushIssue(issues, seen, 'internal_enum', internalEnum[0])

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const unquoted = withoutQuotedText(trimmed)
    if (URL_RE.test(unquoted)) continue

    if (unquoted.includes('{"') || /"\s*:/.test(unquoted)) {
      pushIssue(issues, seen, 'json_fragment', trimmed)
    }

    const keyValueMatches = unquoted.match(/\b[A-Za-z][A-Za-z0-9_.-]*=[^/\s]+(?:\s*\/\s*[A-Za-z][A-Za-z0-9_.-]*=[^/\s]+)+/)
    if (keyValueMatches) pushIssue(issues, seen, 'key_value_chain', keyValueMatches[0])

    const hash = unquoted.match(/(?<![#/])\b[0-9a-f]{7,40}\b(?![-/])/i)
    if (hash) pushIssue(issues, seen, 'raw_hash', hash[0])

    const letters = unquoted.replace(/[`'".,!?()[\]{}:;=/_-]/g, '').trim()
    if (
      unquoted.length >= 20 &&
      !JAPANESE_RE.test(unquoted) &&
      /[A-Za-z]/.test(unquoted) &&
      /^[\x20-\x7E]+$/.test(unquoted) &&
      letters.length >= 12
    ) {
      pushIssue(issues, seen, 'english_only_line', trimmed)
    }
  }

  return issues
}
