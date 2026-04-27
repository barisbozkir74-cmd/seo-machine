import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { fetchSearchAnalytics } from '../search-analytics'

afterEach(() => vi.unstubAllGlobals())

describe('fetchSearchAnalytics', () => {
  it('rows parse: keys[0]=pageUrl, keys[1]=keyword', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        rows: [
          { keys: ['https://example.com/blog', 'seo ipuçları'], clicks: 10, impressions: 100, position: 3.7 },
        ],
      }),
    }))

    const rows = await fetchSearchAnalytics('token', 'https://example.com/', '2026-04-01', '2026-04-27')
    expect(rows).toHaveLength(1)
    expect(rows[0].pageUrl).toBe('https://example.com/blog')
    expect(rows[0].keyword).toBe('seo ipuçları')
    expect(rows[0].clicks).toBe(10)
    expect(rows[0].impressions).toBe(100)
    expect(rows[0].avgPosition).toBe(3.7)
  })

  it('boş rows → []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}), // rows yok
    }))

    const rows = await fetchSearchAnalytics('token', 'https://example.com/', '2026-04-01', '2026-04-27')
    expect(rows).toEqual([])
  })

  it('res.ok false → []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const rows = await fetchSearchAnalytics('token', 'https://example.com/', '2026-04-01', '2026-04-27')
    expect(rows).toEqual([])
  })
})
