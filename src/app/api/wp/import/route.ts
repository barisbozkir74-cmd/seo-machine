import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getWordPressCredentials } from '@/lib/supabase/vault'
import { fetchAllWpContent } from '@/lib/wp/import'
import { normalizeWpPage, type ImportedPage } from '@/lib/wp/normalize'
import { computeAuditFlags, computeDuplicateIntentFlags } from '@/lib/wp/audit-flags'
import { matchGscData, enrichWithGscMetrics } from '@/lib/wp/gsc-match'
import { normalizeUrl } from '@/lib/wp/url-normalize'
import { enrichImportedPages } from '@/lib/wp/enrichment'

// Service role client — RLS bypass, uzun-süreli pipeline için
// RESEARCH.md Pitfall 1: Server Action 60s timeout → Route Handler'a taşındı
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  // Body parse
  let body: { projectId?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, userId } = body
  if (!projectId || !userId) {
    return NextResponse.json({ error: 'projectId and userId required' }, { status: 400 })
  }

  const serviceClient = getServiceClient()

  // T-15.5-06-01: IDOR koruması — userId ownership check
  const { data: project } = await serviceClient
    .from('projects')
    .select('id, name, gsc_property_url')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // WP credentials — vault'tan al
  const creds = await getWordPressCredentials(projectId)
  if (!creds) {
    return NextResponse.json({ error: 'WordPress credentials bulunamadı' }, { status: 400 })
  }
  // T-15.5-06-02: appPassword ASLA console.log/error'a yazılmaz
  const authHeader = 'Basic ' + Buffer.from(`${creds.username}:${creds.appPassword}`).toString('base64')

  // Pipeline başladı — import_status = 'running'
  await serviceClient
    .from('projects')
    .update({ import_status: 'running', import_current: 0, import_total: 0 })
    .eq('id', projectId)

  try {
    // D-08: Endpoint sırası: pages → posts → categories → tags
    const endpoints = ['pages', 'posts', 'categories', 'tags'] as const
    const allPages: ImportedPage[] = []
    const importedWpIds = new Set<number>()
    let totalFetched = 0

    for (const endpoint of endpoints) {
      const wpType =
        endpoint === 'pages'
          ? 'page'
          : endpoint === 'posts'
            ? 'post'
            : endpoint === 'categories'
              ? 'category'
              : 'tag'

      const items = await fetchAllWpContent(creds.wpUrl, authHeader, endpoint)
      const normalized = items.map(item => normalizeWpPage(item, projectId, wpType))

      for (const page of normalized) {
        allPages.push(page)
        importedWpIds.add(page.wp_id)
      }
      totalFetched += normalized.length

      // Progress güncelle — her endpoint sonrası
      await serviceClient
        .from('projects')
        .update({ import_current: totalFetched, import_total: totalFetched })
        .eq('id', projectId)
    }

    // Toplu upsert — D-09: onConflict='project_id,wp_id' (re-import safe)
    if (allPages.length > 0) {
      const UPSERT_BATCH = 200
      for (let i = 0; i < allPages.length; i += UPSERT_BATCH) {
        const batch = allPages.slice(i, i + UPSERT_BATCH)
        await serviceClient
          .from('project_imported_pages')
          .upsert(batch, { onConflict: 'project_id,wp_id', ignoreDuplicates: false })
      }
    }

    // RESEARCH.md Pitfall 7 + D-09: WP'de silinen sayfalar → flag_orphan=true
    const { data: existingPages } = await serviceClient
      .from('project_imported_pages')
      .select('wp_id')
      .eq('project_id', projectId)

    if (existingPages && existingPages.length > 0) {
      const deletedWpIds = existingPages
        .map(p => p.wp_id as number)
        .filter(wpId => !importedWpIds.has(wpId))

      if (deletedWpIds.length > 0) {
        // Batch halinde orphan işaretleme — büyük sitelerde tek update yetersiz kalabilir
        const ORPHAN_BATCH = 500
        for (let i = 0; i < deletedWpIds.length; i += ORPHAN_BATCH) {
          const batch = deletedWpIds.slice(i, i + ORPHAN_BATCH)
          await serviceClient
            .from('project_imported_pages')
            .update({ flag_orphan: true, updated_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .in('wp_id', batch)
        }
      }
    }

    // IMP-03: GSC URL matching — userId matchGscData'ya iletiliyor
    const gscPropertyUrl = project.gsc_property_url
    console.log(`[wp/import] GSC property: ${gscPropertyUrl ?? 'bağlı değil'}`)

    const gscMap = await matchGscData(projectId, gscPropertyUrl, userId)

    if (!gscMap) {
      console.log('[wp/import] gscMap null — GSC bağlı değil, sc-domain property, veya token hatası')
    } else {
      console.log(`[wp/import] GSC map: ${gscMap.size} URL yüklendi`)

      // URL eşleştirme teşhis logu — ilk 3 WP linki ve karşılık gelen GSC anahtarı
      const samplePages = allPages.filter(p => p.link).slice(0, 3)
      for (const p of samplePages) {
        const norm = normalizeUrl(p.link!)
        const hit = gscMap.has(norm)
        console.log(`[wp/import] WP link: ${p.link} → norm: ${norm} → GSC hit: ${hit}`)
      }
      if (gscMap.size > 0) {
        const firstKey = [...gscMap.keys()][0]
        console.log(`[wp/import] GSC örnek URL: ${firstKey}`)
      }

      const gscEnriched = enrichWithGscMetrics(allPages, gscMap)
      let matchCount = 0
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i]
        const gsc = gscEnriched[i]
        if (gsc.gsc_clicks !== null || gsc.gsc_impressions !== null) {
          matchCount++
          await serviceClient
            .from('project_imported_pages')
            .update({ ...gsc, updated_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .eq('wp_id', page.wp_id)
        }
      }
      console.log(`[wp/import] GSC eşleşme: ${matchCount}/${allPages.length} sayfa`)
    }

    // IMP-05 Faz A: Audit flags hesaplama — AI enrichment öncesi
    // Proje keyword'lerini çek (missing_keyword flag için)
    const { data: keywordsData } = await serviceClient
      .from('keywords')
      .select('keyword')
      .eq('project_id', projectId)
    const projectKeywords = (keywordsData ?? []).map(k => k.keyword as string)

    // DB'deki güncel GSC verisiyle audit flags hesapla
    const { data: upsertedPages } = await serviceClient
      .from('project_imported_pages')
      .select('wp_id, link, parent_wp_id, wp_modified_at, gsc_clicks, gsc_avg_position')
      .eq('project_id', projectId)

    if (upsertedPages) {
      const pageMap = new Map(allPages.map(p => [p.wp_id, p]))

      for (const dbPage of upsertedPages) {
        const originalPage = pageMap.get(dbPage.wp_id as number)
        const flags = computeAuditFlags({
          gsc_clicks: dbPage.gsc_clicks as number | null,
          gsc_avg_position: dbPage.gsc_avg_position as number | null,
          wp_modified_at: dbPage.wp_modified_at as string | null,
          parent_wp_id: dbPage.parent_wp_id as number | null,
          flag_orphan_deleted: false,  // orphan yukarıda ayrıca işlendi
          yoast_title: originalPage?.yoast_title ?? null,
          yoast_description: originalPage?.yoast_description ?? null,
          native_title: originalPage?.title ?? null,
          native_excerpt: null,  // excerpt normalize'da tutulmuyor
          project_keywords: projectKeywords,
          page_link: dbPage.link as string | null,
        })

        await serviceClient
          .from('project_imported_pages')
          .update({
            flag_weak_page: flags.flag_weak_page,
            flag_outdated: flags.flag_outdated,
            flag_missing_metadata: flags.flag_missing_metadata,
            flag_missing_keyword: flags.flag_missing_keyword,
            updated_at: new Date().toISOString(),
          })
          .eq('project_id', projectId)
          .eq('wp_id', dbPage.wp_id)
      }
    }

    // AI enrichment başlıyor — import_status = 'enriching'
    await serviceClient
      .from('projects')
      .update({ import_status: 'enriching' })
      .eq('id', projectId)

    // IMP-04: AI enrichment (toplu claude-haiku-4-5)
    const pagesToEnrich = allPages.map(p => ({
      wp_id: p.wp_id,
      title: p.title,
      link: p.link,
      slug: p.slug,
    }))
    await enrichImportedPages(pagesToEnrich, serviceClient, projectId)

    // Faz B: computeDuplicateIntentFlags — AI enrichment DB'ye yazıldıktan SONRA
    const { data: enrichedPages } = await serviceClient
      .from('project_imported_pages')
      .select('wp_id, primary_intent')
      .eq('project_id', projectId)

    if (enrichedPages && enrichedPages.length > 0) {
      const dupFlags = computeDuplicateIntentFlags(
        enrichedPages.map(p => ({
          wp_id: p.wp_id as number,
          primary_intent: p.primary_intent as string | null,
        }))
      )

      for (const [wpId, isDuplicate] of dupFlags) {
        if (isDuplicate) {
          await serviceClient
            .from('project_imported_pages')
            .update({ flag_duplicate_intent: true, updated_at: new Date().toISOString() })
            .eq('project_id', projectId)
            .eq('wp_id', wpId)
        }
      }
    }

    // Pipeline tamamlandı
    await serviceClient
      .from('projects')
      .update({
        import_status: 'complete',
        import_total: totalFetched,
        import_completed_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    return NextResponse.json({ success: true, total: totalFetched })
  } catch (err) {
    // T-15.5-06-02: hata loglarında creds nesnesi bulunmuyor
    console.error('[wp/import] Pipeline error:', err)
    await serviceClient
      .from('projects')
      .update({ import_status: 'error' })
      .eq('id', projectId)
    return NextResponse.json({ error: 'Import pipeline failed' }, { status: 500 })
  }
}
