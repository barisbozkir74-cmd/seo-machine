'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchSerpDomains, fetchTopPages, fetchRankedKeywords, fetchBacklinksSummary } from '@/lib/dataforseo/client'
import { resolveLocation } from '@/lib/dataforseo/location-map'
import { extractCategories } from '@/lib/competitors/url-categories'

export type ActionResult =
  | { success: true }
  | { success: false; error: string }

export type DiscoverResult =
  | { success: true; domains: string[] }
  | { success: false; error: string }

// ─── Yardımcı: ownership check ────────────────────────────────────────────────

async function verifyProjectOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return !!data
}

// ─── COMP-01: Manuel rakip ekleme ─────────────────────────────────────────────

export async function addCompetitor(
  projectId: string,
  domain: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // Zod validate edilmiş domain buraya ulaşır — ek normalize (www. strip)
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').trim()

  if (!normalizedDomain) {
    return { success: false, error: 'Geçersiz domain.' }
  }

  const { error } = await supabase.from('competitors').insert({
    user_id: user.id,
    project_id: projectId,
    domain: normalizedDomain,
    source: 'manual',
  })

  if (error) {
    return { success: false, error: 'Rakip eklenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/rakipler`)
  return { success: true }
}

// ─── COMP-02: SERP keşfi (DB'ye yazmaz — sadece domain listesi döner) ─────────

export async function discoverCompetitors(
  projectId: string,
  keywords: string[]
): Promise<DiscoverResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, target_country, target_language')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // Keyword validasyonu: 1-3 arası, her biri max 700 karakter
  if (!keywords.length || keywords.length > 3) {
    return { success: false, error: '1 ile 3 arasında keyword girin.' }
  }
  if (keywords.some((kw) => kw.trim().length === 0 || kw.trim().length > 700)) {
    return { success: false, error: 'Keyword boş olamaz ve 700 karakterden uzun olamaz.' }
  }

  try {
    const credentials = await getDataForSeoCredentials()
    const location = resolveLocation(project.target_country, project.target_language)
    const domains = await fetchSerpDomains(keywords, credentials, location)
    return { success: true, domains }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return { success: false, error: `Rakip keşfi başarısız: ${message}` }
  }
}

// ─── COMP-02: Seçilen rakipleri toplu ekle (SERP keşif onayından sonra) ───────

const MAX_DOMAINS = 20

export async function addCompetitors(
  projectId: string,
  domains: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  if (!domains.length) {
    return { success: false, error: 'En az bir domain seçin.' }
  }

  // CR-02: Maksimum domain sayısı kontrolü
  if (domains.length > MAX_DOMAINS) {
    return { success: false, error: `Maksimum ${MAX_DOMAINS} rakip aynı anda eklenebilir.` }
  }

  const rows = domains
    .filter((d) => d.trim().length > 0 && d.length <= 253) // CR-02: RFC 1035 max
    .map((d) => ({
      user_id: user.id,
      project_id: projectId,
      domain: d.replace(/^www\./, '').trim(),
      source: 'serp' as const,
    }))

  if (!rows.length) {
    return { success: false, error: 'Geçerli domain bulunamadı.' }
  }

  // WR-01: upsert with ignoreDuplicates — aynı domain tekrar eklenirse hata verme
  const { error } = await supabase
    .from('competitors')
    .upsert(rows, { onConflict: 'project_id,domain', ignoreDuplicates: true })

  if (error) {
    return { success: false, error: 'Rakipler eklenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/rakipler`)
  return { success: true }
}

// ─── COMP-03: Rakip top pages + kategori yapısı çek ──────────────────────────

export async function fetchCompetitorData(
  competitorId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // Rakip ownership check — hem project_id hem user_id filtresi (T-04-02)
  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, domain')
    .eq('id', competitorId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!competitor) {
    return { success: false, error: 'Rakip bulunamadı.' }
  }

  const { data: project } = await supabase
    .from('projects')
    .select('target_country, target_language')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  try {
    const credentials = await getDataForSeoCredentials()
    const location = resolveLocation(project?.target_country, project?.target_language)

    // DataForSEO Relevant Pages API — top 10 organik sayfa (D-05)
    const { items: pages, totalCount } = await fetchTopPages(competitor.domain, credentials, location)

    // Top pages — URL + tahmini trafik (title bu endpoint'te gelmiyor — RESEARCH.md Pitfall 1)
    const topPages = {
      total_count: totalCount,
      pages: pages.map((p) => ({
        url: p.page_address,
        etv: p.metrics?.organic?.etv ?? 0,
      })),
    }

    // URL pattern analizi ile kategori çıkarımı (D-05)
    const categoryStructure = extractCategories(pages)

    // COMP-03: content_areas — "Diğer" hariç içerik konu alanları
    const contentAreas: typeof categoryStructure = {}
    for (const [cat, data] of Object.entries(categoryStructure)) {
      if (cat !== 'Diğer') contentAreas[cat] = data
    }

    // competitors tablosuna JSONB UPDATE (D-07)
    const { error } = await supabase
      .from('competitors')
      .update({
        top_pages: topPages,
        category_structure: categoryStructure,
        content_areas: contentAreas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', competitorId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: 'Veri kaydedilemedi. Lütfen tekrar deneyin.' }
    }

    revalidatePath(`/projeler/${projectId}/rakipler`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return { success: false, error: `Veri çekme başarısız: ${message}` }
  }
}

// ─── Rakip silme ──────────────────────────────────────────────────────────────

export async function deleteCompetitor(
  competitorId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', competitorId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Rakip silinemedi.' }

  revalidatePath(`/projeler/${projectId}/rakipler`)
  return { success: true }
}

// ─── SEO detay verisi: ranked keywords + backlinks ───────────────────────────

export async function fetchCompetitorSeoData(
  competitorId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: competitor } = await supabase
    .from('competitors')
    .select('id, domain')
    .eq('id', competitorId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!competitor) return { success: false, error: 'Rakip bulunamadı.' }

  const { data: project } = await supabase
    .from('projects')
    .select('target_country, target_language')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  try {
    const credentials = await getDataForSeoCredentials()
    const location = resolveLocation(project?.target_country, project?.target_language)

    const [keywordsRaw, backlinks] = await Promise.all([
      fetchRankedKeywords(competitor.domain, credentials, 20, location),
      fetchBacklinksSummary(competitor.domain, credentials),
    ])

    const ranked_keywords = keywordsRaw.map((item) => ({
      keyword: item.keyword,
      position: item.ranked_serp_element?.serp_item?.rank_absolute ?? null,
      search_volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
      etv: item.keyword_data?.impressions_info?.etv ?? 0,
      cpc: item.keyword_data?.keyword_info?.cpc ?? 0,
    }))

    const { error } = await supabase
      .from('competitors')
      .update({ ranked_keywords, backlinks_summary: backlinks, updated_at: new Date().toISOString() })
      .eq('id', competitorId)
      .eq('user_id', user.id)

    if (error) return { success: false, error: 'Veri kaydedilemedi.' }

    revalidatePath(`/projeler/${projectId}/rakipler/${competitorId}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return { success: false, error: `SEO verisi çekme başarısız: ${message}` }
  }
}

// ─── D-10: Kullanıcı domain'i için kategori yapısı çek ve DB'ye persist et ────

export async function fetchOwnDomainData(
  projectId: string,
  domain: string
): Promise<Record<string, number> | null> {
  // WR-03: null/boş domain guard
  if (!domain || domain.trim() === '' || domain === 'null') return null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: project } = await supabase
    .from('projects')
    .select('id, target_country, target_language')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return null

  try {
    const credentials = await getDataForSeoCredentials()
    const location = resolveLocation(project.target_country, project.target_language)
    const { items: pages } = await fetchTopPages(domain, credentials, location)
    const categoryStructure = extractCategories(pages)

    const result: Record<string, number> = {}
    for (const [cat, data] of Object.entries(categoryStructure)) {
      result[cat] = data.pageCount
    }

    // CR-01 FIX: Sonucu DB'ye persist et — OwnDomainAnalyzeButton artık no-op değil
    await supabase
      .from('projects')
      .update({ own_category_structure: result })
      .eq('id', projectId)
      .eq('user_id', user.id)

    revalidatePath(`/projeler/${projectId}/rakipler`)
    return result
  } catch (err) {
    console.error('[fetchOwnDomainData] DataForSEO error:', err)
    return null
  }
}
