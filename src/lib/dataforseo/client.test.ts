import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRelatedKeywords, type RelatedKeywordItem } from './client'

const credentials = { login: 'test_user', password: 'test_pass' }

describe('fetchRelatedKeywords', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('boş keywords array için fetch çağrılmadan [] döner', async () => {
    const result = await fetchRelatedKeywords([], credentials)
    expect(result).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('200 yanıtı için RelatedKeywordItem[] parse eder', async () => {
    const mockBody = {
      tasks: [
        {
          result: [
            {
              items: [
                { keyword_data: { keyword: 'türk kahvesi tarifi', keyword_info: { search_volume: 1200, cpc: 0.4 } }, depth: 1 },
                { keyword_data: { keyword: 'soğuk kahve tarifi', keyword_info: { search_volume: 800, cpc: 0.3 } }, depth: 1 },
              ],
            },
          ],
        },
      ],
    }
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }))

    const items: RelatedKeywordItem[] = await fetchRelatedKeywords(['kahve'], credentials)
    expect(items).toHaveLength(2)
    expect(items[0].keyword_data?.keyword).toBe('türk kahvesi tarifi')
    expect(items[1].keyword_data?.keyword_info?.search_volume).toBe(800)
    // Endpoint URL doğrulaması
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('500 yanıtı için "DataForSEO Related Keywords API hatası: 500" mesajıyla throw eder', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('Server error', { status: 500 }))
    await expect(fetchRelatedKeywords(['kahve'], credentials)).rejects.toThrow(/DataForSEO Related Keywords API hatası: 500/)
  })

  it('depth ve limit options body içine geçer', async () => {
    const mockBody = { tasks: [{ result: [{ items: [] }] }] }
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(mockBody), { status: 200 }))

    await fetchRelatedKeywords(['kahve'], credentials, { locationCode: 2792, languageCode: 'tr' }, { depth: 2, limit: 50 })

    const call = fetchSpy.mock.calls[0]
    const body = JSON.parse(call[1]?.body as string)
    expect(body[0].depth).toBe(2)
    expect(body[0].limit).toBe(50)
    expect(body[0].include_seed_keyword).toBe(false)
  })
})
