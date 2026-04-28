import { describe, it, expect } from 'vitest'
import { normalizeWpPage, flattenImportedTree } from './normalize'

describe('normalizeWpPage', () => {
  const wpPageBase = {
    id: 42,
    title: { rendered: 'Test Sayfası' },
    link: 'https://example.com/test-sayfasi/',
    slug: 'test-sayfasi',
    parent: 0,
    date: '2024-01-15T10:00:00',
    modified: '2024-06-01T12:00:00',
    status: 'publish',
    menu_order: 0,
    yoast_head_json: { title: 'SEO Başlık', description: 'SEO Meta' },
    excerpt: { rendered: '<p>Excerpt</p>' },
  }

  it('WP page object ImportedPage shape\'ine dönüşür', () => {
    const result = normalizeWpPage(wpPageBase, 'proj-123', 'page')
    expect(result.wp_id).toBe(42)
    expect(result.project_id).toBe('proj-123')
    expect(result.title).toBe('Test Sayfası')
    expect(result.wp_type).toBe('page')
  })

  it('parent=0 → parent_wp_id=null (kök sayfa)', () => {
    const result = normalizeWpPage({ ...wpPageBase, parent: 0 }, 'proj-123', 'page')
    expect(result.parent_wp_id).toBeNull()
  })

  it('parent=5 → parent_wp_id=5', () => {
    const result = normalizeWpPage({ ...wpPageBase, parent: 5 }, 'proj-123', 'page')
    expect(result.parent_wp_id).toBe(5)
  })

  it('slug field\'ı korunur', () => {
    const result = normalizeWpPage(wpPageBase, 'proj-123', 'page')
    expect(result.slug).toBe('test-sayfasi')
  })

  it('link (public URL) korunur', () => {
    const result = normalizeWpPage(wpPageBase, 'proj-123', 'page')
    expect(result.link).toBe('https://example.com/test-sayfasi/')
  })

  it('Yoast meta alanları çıkarılır', () => {
    const result = normalizeWpPage(wpPageBase, 'proj-123', 'page')
    expect(result.yoast_title).toBe('SEO Başlık')
    expect(result.yoast_description).toBe('SEO Meta')
  })

  it('Yoast yoksa null döner', () => {
    const result = normalizeWpPage({ ...wpPageBase, yoast_head_json: undefined }, 'proj-123', 'page')
    expect(result.yoast_title).toBeNull()
    expect(result.yoast_description).toBeNull()
  })

  it('wp_type=post için de çalışır', () => {
    const result = normalizeWpPage(wpPageBase, 'proj-123', 'post')
    expect(result.wp_type).toBe('post')
  })
})

describe('flattenImportedTree', () => {
  it('parent önce, child sonra sıralanır', () => {
    const pages = [
      { wp_id: 10, parent_wp_id: null, title: 'Ana', slug: 'ana' },
      { wp_id: 20, parent_wp_id: 10, title: 'Alt', slug: 'alt' },
    ]
    const flat = flattenImportedTree(pages as never)
    expect(flat[0].wp_id).toBe(10)
    expect(flat[0].depth).toBe(0)
    expect(flat[1].wp_id).toBe(20)
    expect(flat[1].depth).toBe(1)
  })

  it('root sayfalar depth=0 alır', () => {
    const pages = [
      { wp_id: 1, parent_wp_id: null, title: 'Anasayfa', slug: 'anasayfa' },
      { wp_id: 2, parent_wp_id: null, title: 'Hakkımızda', slug: 'hakkimizda' },
    ]
    const flat = flattenImportedTree(pages as never)
    expect(flat.every((p) => p.depth === 0)).toBe(true)
  })

  it('üç seviyeli tree — depth doğru artar', () => {
    const pages = [
      { wp_id: 1, parent_wp_id: null, title: 'Kök', slug: 'kok' },
      { wp_id: 2, parent_wp_id: 1, title: 'Çocuk', slug: 'cocuk' },
      { wp_id: 3, parent_wp_id: 2, title: 'Torun', slug: 'torun' },
    ]
    const flat = flattenImportedTree(pages as never)
    const depths = flat.map((p) => p.depth)
    expect(depths).toEqual([0, 1, 2])
  })

  it('boş liste → boş liste döner', () => {
    const flat = flattenImportedTree([])
    expect(flat).toHaveLength(0)
  })
})
