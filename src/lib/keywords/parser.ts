// Keyword text parser — parses tab/newline-separated keyword lists

export type ParsedKeyword = {
  keyword: string
  volume: number | null
  kd: number | null
}

export function parseKeywordText(text: string): ParsedKeyword[] {
  const lines = text.trim().split(/\r?\n/)
  const results: ParsedKeyword[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split(/\t|,/)
    const keyword = parts[0]?.trim()
    if (!keyword) continue

    const volume = parts[1] ? parseInt(parts[1].trim(), 10) || null : null
    const kd = parts[2] ? parseInt(parts[2].trim(), 10) || null : null

    results.push({ keyword, volume, kd })
  }

  return results
}
