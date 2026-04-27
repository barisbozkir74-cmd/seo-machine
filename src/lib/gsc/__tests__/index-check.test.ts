import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { checkUrlIndexStatus } from '../index-check'

function mockFetchWithVerdict(verdict: string | undefined, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(
      verdict !== undefined
        ? { inspectionResult: { indexStatusResult: { verdict } } }
        : {}
    ),
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('checkUrlIndexStatus', () => {
  it('PASS → indexed', async () => {
    mockFetchWithVerdict('PASS')
    const result = await checkUrlIndexStatus('token', 'https://example.com/page', 'https://example.com/')
    expect(result).toBe('indexed')
  })

  it('FAIL → not_indexed', async () => {
    mockFetchWithVerdict('FAIL')
    const result = await checkUrlIndexStatus('token', 'https://example.com/page', 'https://example.com/')
    expect(result).toBe('not_indexed')
  })

  it('NEUTRAL → crawled_not_indexed', async () => {
    mockFetchWithVerdict('NEUTRAL')
    const result = await checkUrlIndexStatus('token', 'https://example.com/page', 'https://example.com/')
    expect(result).toBe('crawled_not_indexed')
  })

  it('bilinmeyen verdict → unknown', async () => {
    mockFetchWithVerdict('SOMETHING_ELSE')
    const result = await checkUrlIndexStatus('token', 'https://example.com/page', 'https://example.com/')
    expect(result).toBe('unknown')
  })

  it('res.ok false → unknown', async () => {
    mockFetchWithVerdict('PASS', false)
    const result = await checkUrlIndexStatus('token', 'https://example.com/page', 'https://example.com/')
    expect(result).toBe('unknown')
  })
})
