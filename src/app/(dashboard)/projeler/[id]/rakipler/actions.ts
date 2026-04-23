'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchSerpDomains, fetchTopPages } from '@/lib/dataforseo/client'
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

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // Keyword validasyonu: 1-3 arası, her biri max 700 karakter
  if (!keywords.length || keywords.length > 3) {
    return { success: false, error: '1 ile 3 arasında keyword girin.' }
  }
  if (keywords.some((kw) => kw.trim().length === 0 || kw.length > 700)) {
    return { success: false, error: 'Keyword boş olamaz ve 700 karakterden uzun olamaz.' }
  }

  try {
    const credentials = await getDataForSeoCredentials()
    const domains = await fetchSerpDomains(keywords, credentials)
    return { success: true, domains }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return { success: false, error: `Rakip keşfi başarısız: ${message}` }
  }
}

// ─── COMP-02: Seçilen rakipleri toplu ekle (SERP keşif onayından sonra) ───────

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

  const rows = domains.map((d) => ({
    user_id: user.id,
    project_id: projectId,
    domain: d.replace(/^www\./, '').trim(),
    source: 'serp' as const,
  }))

  // ignoreDuplicates: true — aynı domain tekrar eklenirse hata verme
  const { error } = await supabase.from('competitors').insert(rows)

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

  try {
    const credentials = await getDataForSeoCredentials()

    // DataForSEO Relevant Pages API — top 10 organik sayfa (D-05)
    const pages = await fetchTopPages(competitor.domain, credentials)

    // Top pages — URL + tahmini trafik (title bu endpoint'te gelmiyor — RESEARCH.md Pitfall 1)
    const topPages = pages.map((p) => ({
      url: p.page_address,
      etv: p.metrics?.organic?.etv ?? 0,
    }))

    // URL pattern analizi ile kategori çıkarımı (D-05)
    const categoryStructure = extractCategories(pages)

    // competitors tablosuna JSONB UPDATE (D-07)
    const { error } = await supabase
      .from('competitors')
      .update({
        top_pages: topPages,
        category_structure: categoryStructure,
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

// ─── D-10: Kullanıcı domain'i için kategori yapısı çek (DB'ye yazılmaz) ────────

export async function fetchOwnDomainData(
  projectId: string,
  domain: string
): Promise<Record<string, number> | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Ownership check — sadece kendi projesini analiz edebilir
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return null

  try {
    const credentials = await getDataForSeoCredentials()

    // relevant_pages endpoint — lokasyon bağımsız (Q2 RESOLVED)
    const pages = await fetchTopPages(domain, credentials)

    // URL pattern analizi ile kategori → sayfa sayısı haritası
    const categoryStructure = extractCategories(pages)

    // Record<string, number>: kategori → pageCount (SSR render için yeterli)
    const result: Record<string, number> = {}
    for (const [cat, data] of Object.entries(categoryStructure)) {
      result[cat] = data.pageCount
    }

    return result
  } catch {
    return null
  }
}
