import { describe, it, expect } from 'vitest'
import { normalizeUrl } from './url-normalize'

describe('normalizeUrl', () => {
  it('www prefix kaldırır', () => {
    expect(normalizeUrl('https://www.example.com/page/')).toBe('https://example.com/page')
  })

  it('http → https dönüştürür', () => {
    expect(normalizeUrl('http://example.com/page')).toBe('https://example.com/page')
  })

  it('query string ve fragment kaldırır', () => {
    expect(normalizeUrl('https://example.com/page?q=1#section')).toBe('https://example.com/page')
  })

  it('trailing slash kaldırır', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
  })

  it('temiz URL değiştirmeden döndürür', () => {
    expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path')
  })
})
