import { describe, it, expect } from 'vitest'
import { computeAuditFlags } from './audit-flags'

// ImportedPageInput type — audit-flags.ts henüz yok, testler import edince fail eder (Wave 0)
describe('computeAuditFlags', () => {
  const baseInput = {
    gsc_clicks: null,
    gsc_avg_position: null,
    wp_modified_at: new Date().toISOString(),
    parent_wp_id: null,
    flag_orphan_deleted: false,
    yoast_title: 'Test Title',
    yoast_description: 'Test Desc',
    native_title: 'Test Title',
    native_excerpt: 'Excerpt',
    project_keywords: ['test'],
    page_link: 'https://example.com/test',
  }

  it('weak_page null döner — GSC verisi yok (D-10)', () => {
    const flags = computeAuditFlags({ ...baseInput })
    expect(flags.flag_weak_page).toBeNull()
  })

  it('weak_page true — clicks<10 AND pos>20 (D-10)', () => {
    const flags = computeAuditFlags({ ...baseInput, gsc_clicks: 5, gsc_avg_position: 25 })
    expect(flags.flag_weak_page).toBe(true)
  })

  it('weak_page false — clicks>=10 (D-10)', () => {
    const flags = computeAuditFlags({ ...baseInput, gsc_clicks: 15, gsc_avg_position: 25 })
    expect(flags.flag_weak_page).toBe(false)
  })

  it('weak_page false — clicks<10 ama pos<=20 (D-10 AND koşulu)', () => {
    const flags = computeAuditFlags({ ...baseInput, gsc_clicks: 5, gsc_avg_position: 15 })
    expect(flags.flag_weak_page).toBe(false)
  })

  it('outdated true — 13 ay önce güncellendi (D-11)', () => {
    const thirteenMonthsAgo = new Date()
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)
    const flags = computeAuditFlags({ ...baseInput, wp_modified_at: thirteenMonthsAgo.toISOString() })
    expect(flags.flag_outdated).toBe(true)
  })

  it('outdated false — 11 ay önce güncellendi (D-11)', () => {
    const elevenMonthsAgo = new Date()
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)
    const flags = computeAuditFlags({ ...baseInput, wp_modified_at: elevenMonthsAgo.toISOString() })
    expect(flags.flag_outdated).toBe(false)
  })

  it('orphan true — parent_wp_id null ve WP\'de silinmiş (D-12)', () => {
    const flags = computeAuditFlags({ ...baseInput, parent_wp_id: null, flag_orphan_deleted: true })
    expect(flags.flag_orphan).toBe(true)
  })

  it('orphan false — parent_wp_id mevcut (D-12)', () => {
    const flags = computeAuditFlags({ ...baseInput, parent_wp_id: 5, flag_orphan_deleted: false })
    expect(flags.flag_orphan).toBe(false)
  })

  it('missing_metadata true — Yoast ve native title/excerpt eksik (D-13)', () => {
    const flags = computeAuditFlags({
      ...baseInput,
      yoast_title: null,
      yoast_description: null,
      native_title: null,
      native_excerpt: null,
    })
    expect(flags.flag_missing_metadata).toBe(true)
  })

  it('missing_metadata false — Yoast title mevcut (D-13)', () => {
    const flags = computeAuditFlags({ ...baseInput, yoast_title: 'SEO Başlık' })
    expect(flags.flag_missing_metadata).toBe(false)
  })

  it('missing_metadata false — Yoast yok ama native title mevcut (D-13 fallback)', () => {
    const flags = computeAuditFlags({
      ...baseInput,
      yoast_title: null,
      yoast_description: null,
      native_title: 'Sayfa Başlığı',
      native_excerpt: 'Excerpt',
    })
    expect(flags.flag_missing_metadata).toBe(false)
  })
})
