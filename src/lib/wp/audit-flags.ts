/**
 * Audit flag hesaplama — pure function.
 * RESEARCH.md Pattern: aggregation.ts isDecayed flag mantığı analog.
 * Pitfall 6: duplicate_intent (Faz B) ayrı fonksiyonda — AI enrichment sonrası çağrılır.
 */

export interface AuditFlagInput {
  gsc_clicks: number | null
  gsc_avg_position: number | null
  wp_modified_at: string | null
  parent_wp_id: number | null
  flag_orphan_deleted: boolean  // WP'de artık yok (re-import'ta saptanır)
  yoast_title: string | null
  yoast_description: string | null
  native_title: string | null
  native_excerpt: string | null
  project_keywords: string[]    // keywords tablosundan — missing_keyword için
  page_link: string | null
}

export interface AuditFlagOutput {
  flag_orphan: boolean
  flag_weak_page: boolean | null  // null = GSC verisi yok (D-10)
  flag_outdated: boolean
  flag_missing_metadata: boolean
  flag_missing_keyword: boolean
}

/**
 * Faz A flag hesaplama — AI enrichment gerekmez.
 * D-10: weak_page = gsc_clicks < 10 AND avg_position > 20 (son 28 gün)
 * D-11: outdated = wp_modified_at < now() - 12 months
 * D-12: orphan = WP'de silindi (flag_orphan_deleted) VEYA parent_wp_id=null AND menu_order=0
 * D-13: missing_metadata = yoast eksik VE native title/excerpt eksik
 * A5: missing_keyword = page_link URL'de hiçbir keyword geçmiyor (exact slug match)
 */
export function computeAuditFlags(input: AuditFlagInput): AuditFlagOutput {
  // weak_page (D-10)
  let flag_weak_page: boolean | null = null
  if (input.gsc_clicks !== null && input.gsc_avg_position !== null) {
    flag_weak_page = input.gsc_clicks < 10 && input.gsc_avg_position > 20
  }

  // outdated (D-11) — 12 ay = 365 gün
  let flag_outdated = false
  if (input.wp_modified_at) {
    const modified = new Date(input.wp_modified_at)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
    flag_outdated = modified < twelveMonthsAgo
  }

  // orphan (D-12) — WP'de silindi veya parent_wp_id=null (potansiyel orphan)
  // Basit kural: flag_orphan_deleted=true → kesin orphan
  const flag_orphan = input.flag_orphan_deleted

  // missing_metadata (D-13, RESEARCH.md Pitfall 3)
  // 1. Yoast title veya description varsa → false
  // 2. Native title.rendered ve excerpt.rendered her ikisi de eksikse → true
  const hasYoast = Boolean(input.yoast_title?.trim() || input.yoast_description?.trim())
  const hasNative = Boolean(input.native_title?.trim() || input.native_excerpt?.trim())
  const flag_missing_metadata = !hasYoast && !hasNative

  // missing_keyword (A5 — exact URL segment match)
  let flag_missing_keyword = false
  if (input.project_keywords.length > 0 && input.page_link) {
    const linkLower = input.page_link.toLowerCase()
    const hasKeyword = input.project_keywords.some(kw => {
      const slug = kw.toLowerCase().replace(/\s+/g, '-')
      return linkLower.includes(slug) || linkLower.includes(kw.toLowerCase())
    })
    flag_missing_keyword = !hasKeyword
  }

  return { flag_orphan, flag_weak_page, flag_outdated, flag_missing_metadata, flag_missing_keyword }
}

/**
 * Faz B — AI enrichment tamamlandıktan sonra çağrılır.
 * D-13: duplicate_intent = aynı project'te aynı primary_intent'e sahip 2+ sayfa.
 * RESEARCH.md Pitfall 6: Bu fonksiyon AI enrichment DB'ye yazıldıktan SONRA çağrılır.
 * @param pages project_imported_pages dizisi — primary_intent dolu olmalı
 * @returns wp_id → flag_duplicate_intent map
 */
export function computeDuplicateIntentFlags(
  pages: Array<{ wp_id: number; primary_intent: string | null }>
): Map<number, boolean> {
  const intentCount = new Map<string, number>()
  for (const page of pages) {
    if (page.primary_intent) {
      intentCount.set(page.primary_intent, (intentCount.get(page.primary_intent) ?? 0) + 1)
    }
  }

  const result = new Map<number, boolean>()
  for (const page of pages) {
    const count = page.primary_intent ? (intentCount.get(page.primary_intent) ?? 0) : 0
    result.set(page.wp_id, count > 1)
  }
  return result
}
