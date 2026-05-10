'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/pages/slugify'

export type ActionResult = { success: true } | { success: false; error: string }

export type Priority = 'yüksek' | 'orta' | 'düşük'
export type MenuType = 'top' | 'main' | 'footer'

export type MenuItem = {
  label: string
  href: string
  page_id?: string
}

export type AddPageInput = {
  title: string
  slug: string
  page_type: string
  parent_id?: string | null
  priority: Priority
}

// ─── Yardımcı: Proje sahipliğini doğrula ──────────────────────────────────────

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

// ─── Sayfa Ekle ───────────────────────────────────────────────────────────────

export async function addPage(
  projectId: string,
  input: AddPageInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }

  // sort_order: mevcut sayfa sayısına göre sona ekle
  const { count } = await supabase
    .from('pages')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  const { data: existingSlugRows } = await supabase
    .from('pages')
    .select('slug')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  const existingSlugs = (existingSlugRows ?? []).map((r: { slug: string }) => r.slug)
  const safeSlug = slugify(input.slug || input.title, existingSlugs)

  const { error } = await supabase.from('pages').insert({
    user_id: user.id,
    project_id: projectId,
    title: input.title,
    slug: safeSlug,
    page_type: input.page_type,
    parent_id: input.parent_id ?? null,
    priority: input.priority,
    sort_order: (count ?? 0) + 1,
  })

  if (error) return { success: false, error: 'Sayfa eklenirken hata oluştu.' }

  revalidatePath(`/projeler/${projectId}/site-blueprint`)
  return { success: true }
}

// ─── Sayfa Sil ────────────────────────────────────────────────────────────────

export async function deletePage(
  projectId: string,
  pageId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Sayfa silinirken hata oluştu.' }

  revalidatePath(`/projeler/${projectId}/site-blueprint`)
  return { success: true }
}

// ─── Menü Upsert ──────────────────────────────────────────────────────────────

export async function upsertMenu(
  projectId: string,
  menuType: MenuType,
  items: MenuItem[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase.from('menus').upsert(
    {
      user_id: user.id,
      project_id: projectId,
      menu_type: menuType,
      items,
    },
    { onConflict: 'project_id,menu_type' }
  )

  if (error) return { success: false, error: 'Menü kaydedilirken hata oluştu.' }

  revalidatePath(`/projeler/${projectId}/site-blueprint`)
  return { success: true }
}

// ─── Phase 7: Site Blueprint Generation ────────────────────────────────────

export type GenerateRowInput = {
  clusterId: string
  pageName: string      // kullanıcının dialog'ta düzenlediği başlık (trim)
  pageType: string      // hizmet | blog | ana-sayfa | kategori | urun | landing ...
  focusKeywordId: string | null  // cluster'ın primary_keyword_id (null olabilir)
  overwrite?: boolean   // D-03: true → UPDATE mevcut sayfayı (title, page_type, focus_keyword_id)
}

export type GenerateResult =
  | { success: true; created: number; updated: number; skipped: number }
  | { success: false; error: string }

/**
 * BLUE-01 + BLUE-02 + D-01: kümelerden toplu sayfa üretir.
 * Duplicate guard: aynı cluster_id için mevcut sayfa varsa skip.
 * Slug D-06 kurallarıyla üretilir (Türkçe normalize + -2/-3 suffix).
 */
export async function generatePagesFromClusters(
  projectId: string,
  rows: GenerateRowInput[]
): Promise<GenerateResult> {
  // UUID guard
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return { success: false, error: 'Geçersiz proje ID.' }
  }
  if (!Array.isArray(rows)) {
    return { success: false, error: 'Geçersiz satır listesi.' }
  }
  if (rows.length === 0) {
    return { success: true, created: 0, updated: 0, skipped: 0 }
  }
  // Her cluster_id UUID doğrula (T-07-03 tampering önlemi)
  for (const r of rows) {
    if (!r.clusterId || !/^[0-9a-f-]{36}$/i.test(r.clusterId)) {
      return { success: false, error: 'Geçersiz küme ID.' }
    }
    if (r.focusKeywordId && !/^[0-9a-f-]{36}$/i.test(r.focusKeywordId)) {
      return { success: false, error: 'Geçersiz focus keyword ID.' }
    }
    if (!r.pageName || !r.pageName.trim()) {
      return { success: false, error: 'Sayfa adı boş olamaz.' }
    }
  }
  // DoS guard
  if (rows.length > 500) {
    return { success: false, error: `Tek seferde 500'den fazla sayfa oluşturulamaz (${rows.length}).` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }

  // Cluster ownership doğrula — rows'daki tüm clusterId'ler bu proje altında mı?
  const clusterIds = [...new Set(rows.map((r) => r.clusterId))]
  const { data: ownedClusters } = await supabase
    .from('keyword_clusters')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .in('id', clusterIds)

  const ownedClusterSet = new Set((ownedClusters ?? []).map((c) => c.id))
  if (ownedClusterSet.size !== clusterIds.length) {
    return { success: false, error: 'Bazı kümeler projeye ait değil.' }
  }

  // Duplicate guard: bu projede cluster_id'si eşleşen mevcut sayfaları çek
  const { data: existingPages } = await supabase
    .from('pages')
    .select('id, cluster_id, slug, sort_order')
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  const takenClusterIds = new Set(
    (existingPages ?? [])
      .filter((p: { cluster_id: string | null }) => p.cluster_id !== null)
      .map((p: { cluster_id: string | null }) => p.cluster_id as string)
  )
  const existingSlugs = new Set(
    (existingPages ?? []).map((p: { slug: string }) => p.slug)
  )

  let nextSortOrder =
    ((existingPages ?? []).reduce(
      (max: number, p: { sort_order: number }) => Math.max(max, p.sort_order),
      0
    )) + 1

  // Insert payload'ları hazırla — skip / overwrite ayrımı (D-03)
  let skipped = 0
  const payloads: Array<Record<string, unknown>> = []
  const updatePayloads: Array<{ id: string; fields: Record<string, unknown> }> = []

  for (const r of rows) {
    if (takenClusterIds.has(r.clusterId)) {
      if (r.overwrite) {
        // D-03: mevcut sayfayı UPDATE et (sil değil)
        const existingPage = (existingPages ?? []).find(
          (p: { cluster_id: string | null; id: string }) => p.cluster_id === r.clusterId
        )
        if (existingPage) {
          updatePayloads.push({
            id: existingPage.id,
            fields: {
              title: r.pageName.trim(),
              page_type: r.pageType || 'blog',
              focus_keyword_id: r.focusKeywordId,
            },
          })
        }
      } else {
        skipped++
      }
      continue
    }
    const slug = slugify(r.pageName.trim(), Array.from(existingSlugs))
    existingSlugs.add(slug)  // bu batch içinde de duplicate'i önle

    payloads.push({
      user_id: user.id,
      project_id: projectId,
      parent_id: null,
      cluster_id: r.clusterId,
      focus_keyword_id: r.focusKeywordId,
      title: r.pageName.trim(),
      slug,
      page_type: r.pageType || 'blog',
      priority: 'orta', // mevcut addPage ile tutarlı (Türkçe değer)
      sort_order: nextSortOrder++,
    })
  }

  let created = 0
  if (payloads.length > 0) {
    const { error, data: inserted } = await supabase
      .from('pages')
      .insert(payloads)
      .select('id')
    if (error) {
      return { success: false, error: 'Sayfalar oluşturulurken hata oluştu.' }
    }
    created = (inserted ?? []).length
  }

  // D-03: overwrite UPDATE'leri çalıştır
  let updated = 0
  for (const u of updatePayloads) {
    const { error } = await supabase
      .from('pages')
      .update(u.fields)
      .eq('id', u.id)
      .eq('project_id', projectId)
      .eq('user_id', user.id)
    if (error) {
      return { success: false, error: 'Bazı sayfalar güncellenemedi.' }
    }
    updated++
  }

  revalidatePath(`/projeler/${projectId}/site-blueprint`)
  return { success: true, created, updated, skipped }
}

// ─── Phase 7: Reorder Page ─────────────────────────────────────────────────

/**
 * BLUE-03 + D-04: aynı parent altındaki bitişik kardeşle sort_order takası yapar.
 * 'up'   → mevcut sort_order'dan küçük, en yakın kardeş
 * 'down' → mevcut sort_order'dan büyük, en yakın kardeş
 */
export async function reorderPage(
  pageId: string,
  direction: 'up' | 'down',
  projectId: string
): Promise<ActionResult> {
  // UUID guards
  if (!pageId || !/^[0-9a-f-]{36}$/i.test(pageId)) {
    return { success: false, error: 'Geçersiz sayfa ID.' }
  }
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return { success: false, error: 'Geçersiz proje ID.' }
  }
  if (direction !== 'up' && direction !== 'down') {
    return { success: false, error: 'Geçersiz yön.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const isOwner = await verifyProjectOwnership(supabase, projectId, user.id)
  if (!isOwner) return { success: false, error: 'Proje bulunamadı.' }

  // Hedef sayfayı çek
  const { data: targetPage } = await supabase
    .from('pages')
    .select('id, parent_id, sort_order')
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!targetPage) return { success: false, error: 'Sayfa bulunamadı.' }

  // Kardeşleri çek — aynı parent_id, aynı project_id
  let siblingsQuery = supabase
    .from('pages')
    .select('id, sort_order')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  siblingsQuery =
    targetPage.parent_id === null
      ? siblingsQuery.is('parent_id', null)
      : siblingsQuery.eq('parent_id', targetPage.parent_id)

  const { data: siblings } = await siblingsQuery
  const siblingList = siblings ?? []

  const idx = siblingList.findIndex((s: { id: string }) => s.id === pageId)
  if (idx === -1) return { success: false, error: 'Sayfa kardeşler arasında bulunamadı.' }

  const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
  if (neighborIdx < 0 || neighborIdx >= siblingList.length) {
    // Kenar durum: ilk/son — no-op (başarı dön ki UI hata göstermesin)
    return { success: true }
  }

  const current = siblingList[idx]
  const neighbor = siblingList[neighborIdx]

  // sort_order takası — 3 adımlı sentinel swap (WR-01)
  // Step 1: move current to sentinel -1 (cannot collide with valid sort_order >= 0)
  await supabase
    .from('pages')
    .update({ sort_order: -1 })
    .eq('id', current.id)
    .eq('user_id', user.id)

  // Step 2: move neighbor to current's old position
  const r2 = await supabase
    .from('pages')
    .update({ sort_order: current.sort_order })
    .eq('id', neighbor.id)
    .eq('user_id', user.id)

  // Step 3: move current to neighbor's old position
  const r3 = await supabase
    .from('pages')
    .update({ sort_order: neighbor.sort_order })
    .eq('id', current.id)
    .eq('user_id', user.id)

  if (r2.error || r3.error) {
    return { success: false, error: 'Sıralama güncellenemedi.' }
  }

  revalidatePath(`/projeler/${projectId}/site-blueprint`)
  return { success: true }
}
