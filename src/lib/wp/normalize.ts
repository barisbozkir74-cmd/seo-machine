/**
 * WP REST API response objesini project_imported_pages DB shape'ine normalize eder.
 * D-08: pages, posts, categories, tags için aynı normalize fonksiyonu.
 */

export interface ImportedPage {
  project_id: string
  wp_id: number
  wp_type: 'page' | 'post' | 'category' | 'tag'
  title: string
  slug: string | null
  link: string | null
  parent_wp_id: number | null  // WP parent=0 → null (kök sayfa D-12)
  wp_created_at: string | null
  wp_modified_at: string | null
  // Yoast SEO metadata (missing_metadata flag için)
  yoast_title: string | null
  yoast_description: string | null
  // AI enrichment alanları (sonradan doldurulur)
  content_summary: string | null
  primary_intent: string | null
  // GSC (sonradan doldurulur)
  gsc_clicks: number | null
  gsc_impressions: number | null
  gsc_avg_position: number | null
  gsc_index_status: string | null
  // Audit flags (computeAuditFlags ile doldurulur)
  flag_orphan: boolean
  flag_weak_page: boolean | null  // GSC öncesi null
  flag_outdated: boolean
  flag_missing_metadata: boolean
  flag_missing_keyword: boolean
  flag_duplicate_intent: boolean
}

export interface ImportedPageWithDepth extends ImportedPage {
  depth: number
}

// WP REST API raw item shape — categories/tags use `name` instead of `title.rendered`
interface WpItem {
  id: number
  title?: { rendered?: string }
  name?: string          // categories & tags
  link?: string
  slug?: string
  parent?: number
  date?: string
  modified?: string
  status?: string
  menu_order?: number
  yoast_head_json?: { title?: string; description?: string } | null
  excerpt?: { rendered?: string } | null
}

/**
 * WP item → ImportedPage. Audit flag'leri başlangıçta false/null.
 * computeAuditFlags() ayrıca çağrılarak flag'ler güncellenir.
 */
export function normalizeWpPage(
  item: WpItem,
  projectId: string,
  wpType: 'page' | 'post' | 'category' | 'tag'
): ImportedPage {
  // HTML entity decode — WP title.rendered bazen &#8220; gibi entity içerir
  const decodeHtml = (str: string) =>
    str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, c: string) => String.fromCharCode(parseInt(c, 10)))

  return {
    project_id: projectId,
    wp_id: item.id,
    wp_type: wpType,
    title: decodeHtml(item.title?.rendered ?? item.name ?? ''),
    slug: item.slug ?? null,
    link: item.link ?? null,
    parent_wp_id: item.parent && item.parent > 0 ? item.parent : null,
    wp_created_at: item.date ?? null,
    wp_modified_at: item.modified ?? null,
    yoast_title: item.yoast_head_json?.title ?? null,
    yoast_description: item.yoast_head_json?.description ?? null,
    content_summary: null,
    primary_intent: null,
    gsc_clicks: null,
    gsc_impressions: null,
    gsc_avg_position: null,
    gsc_index_status: null,
    flag_orphan: false,
    flag_weak_page: null,
    flag_outdated: false,
    flag_missing_metadata: false,
    flag_missing_keyword: false,
    flag_duplicate_intent: false,
  }
}

/**
 * Düz ImportedPage dizisini parent/child ilişkisine göre depth'li listeye çevirir.
 * RESEARCH.md Pattern 4 — site-blueprint/page.tsx flattenTree() EXACT analog.
 * parent_wp_id null veya 0 → kök sayfa (__root__).
 */
export function flattenImportedTree(pages: ImportedPage[]): ImportedPageWithDepth[] {
  const childrenMap: Record<string, ImportedPage[]> = {}
  for (const page of pages) {
    const key = page.parent_wp_id ? page.parent_wp_id.toString() : '__root__'
    if (!childrenMap[key]) childrenMap[key] = []
    childrenMap[key].push(page)
  }

  function walk(parentKey: string, depth: number): ImportedPageWithDepth[] {
    const children = (childrenMap[parentKey] ?? []).sort((a, b) => a.wp_id - b.wp_id)
    return children.flatMap(child => [
      { ...child, depth },
      ...walk(child.wp_id.toString(), depth + 1),
    ])
  }

  return walk('__root__', 0)
}
