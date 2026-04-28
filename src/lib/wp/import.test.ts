import { describe, it, expect, vi } from 'vitest'
import { fetchAllWpContent } from './import'

describe('fetchAllWpContent', () => {
  it('tek sayfalık response — tüm item döner', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: (h: string) => h === 'X-WP-TotalPages' ? '1' : null },
      json: async () => [
        {
          id: 1,
          title: { rendered: 'Sayfa 1' },
          link: 'https://ex.com/page-1',
          slug: 'page-1',
          parent: 0,
          date: '2025-01-01T00:00:00',
          modified: '2025-01-01T00:00:00',
          status: 'publish',
          menu_order: 0,
        },
      ],
    } as unknown as Response)
    const result = await fetchAllWpContent('https://ex.com', 'user:pass_base64', 'pages')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('iki sayfalık response — tüm item döner (pagination loop)', async () => {
    const page1Item = {
      id: 1,
      title: { rendered: 'P1' },
      link: 'https://ex.com/p1',
      slug: 'p1',
      parent: 0,
      date: '2025-01-01T00:00:00',
      modified: '2025-01-01T00:00:00',
      status: 'publish',
      menu_order: 0,
    }
    const page2Item = {
      id: 2,
      title: { rendered: 'P2' },
      link: 'https://ex.com/p2',
      slug: 'p2',
      parent: 0,
      date: '2025-01-01T00:00:00',
      modified: '2025-01-01T00:00:00',
      status: 'publish',
      menu_order: 0,
    }
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => h === 'X-WP-TotalPages' ? '2' : null },
        json: async () => [page1Item],
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => [page2Item],
      } as unknown as Response)
    const result = await fetchAllWpContent('https://ex.com', 'user:pass_base64', 'pages')
    expect(result).toHaveLength(2)
  })

  it('WP API 4xx → hata fırlatır', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as unknown as Response)
    await expect(
      fetchAllWpContent('https://ex.com', 'bad_creds', 'pages')
    ).rejects.toThrow()
  })

  it('WP API 500 → hata fırlatır', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as unknown as Response)
    await expect(
      fetchAllWpContent('https://ex.com', 'user:pass_base64', 'pages')
    ).rejects.toThrow()
  })
})
