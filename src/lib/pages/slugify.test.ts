import { describe, it, expect } from 'vitest'
import { slugify } from './slugify'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Conservatory Blinds')).toBe('conservatory-blinds')
  })
  it('normalizes Turkish chars ç ş ö', () => {
    expect(slugify('Çatı Şemsiyesi Örtüleri')).toBe('cati-semsiyesi-ortuleri')
  })
  it('normalizes ü ı İ ğ', () => {
    expect(slugify('Ürün İğne Ğüzel')).toBe('urun-igne-guzel')
  })
  it('strips special chars and collapses hyphens', () => {
    expect(slugify('Hello! World@2024 #test')).toBe('hello-world2024-test')
  })
  it('enforces 60-char max length', () => {
    expect(slugify('a'.repeat(80)).length).toBe(60)
  })
  it('appends -2 when slug taken', () => {
    expect(slugify('test', ['test'])).toBe('test-2')
  })
  it('appends -3 when -2 also taken', () => {
    expect(slugify('test', ['test', 'test-2'])).toBe('test-3')
  })
  it('appends -4 when -3 also taken', () => {
    expect(slugify('test', ['test', 'test-2', 'test-3'])).toBe('test-4')
  })
  it('trims leading/trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello')
  })
  it('falls back to "page" when input empty after normalize', () => {
    expect(slugify('   ')).toBe('page')
    expect(slugify('!!!')).toBe('page')
  })
})
