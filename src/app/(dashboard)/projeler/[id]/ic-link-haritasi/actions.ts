'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { success: false; error: string }

export type LinkType = 'contextual' | 'navigation' | 'footer' | 'breadcrumb'

export type AddLinkData = {
  source_page_id: string
  target_page_id: string
  anchor_text: string
  link_type: LinkType
}

export async function addLink(
  projectId: string,
  data: AddLinkData
): Promise<ActionResult> {
  if (data.source_page_id === data.target_page_id) {
    return { success: false, error: 'Kaynak ve hedef sayfa aynı olamaz.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Proje sahipliğini doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase.from('internal_links').insert({
    user_id: user.id,
    project_id: projectId,
    source_page_id: data.source_page_id,
    target_page_id: data.target_page_id,
    anchor_text: data.anchor_text.trim(),
    link_type: data.link_type,
  })

  if (error) return { success: false, error: 'Link eklenirken hata oluştu.' }

  revalidatePath(`/projeler/${projectId}/ic-link-haritasi`)
  return { success: true }
}

export async function deleteLink(
  projectId: string,
  linkId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('internal_links')
    .delete()
    .eq('id', linkId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Link silinemedi.' }

  revalidatePath(`/projeler/${projectId}/ic-link-haritasi`)
  return { success: true }
}

// ─── İç Link Önerileri (D-02) ─────────────────────────────────────────────────

export type InternalLinkSuggestion = {
  sourcePage: { id: string; title: string; page_type: string | null }
  targetPage: { id: string; title: string; page_type: string | null }
  anchorText: string
  linkType: 'contextual'
}

export type SuggestInternalLinksResult =
  | { success: true; suggestions: InternalLinkSuggestion[] }
  | { success: false; error: string }

const PILLAR_TYPES = ['kategori', 'ana-sayfa']
const SUPPORT_TYPES = ['hizmet', 'blog', 'landing', 'urun']

export async function suggestInternalLinks(
  projectId: string
): Promise<SuggestInternalLinksResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Proje sahipliğini doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Tüm sayfaları çek (focus_keyword_id dahil)
  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, page_type, focus_keyword_id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  const pages = pagesRaw ?? []

  // Focus keyword metinlerini çek
  const kwIds = pages.map((p) => p.focus_keyword_id).filter((k): k is string => !!k)
  const kwMap = new Map<string, string>()
  if (kwIds.length > 0) {
    const { data: kws } = await supabase
      .from('keywords')
      .select('id, keyword')
      .in('id', kwIds)
    for (const kw of kws ?? []) kwMap.set(kw.id, kw.keyword)
  }

  // Mevcut linkleri çek — aynı source+target çiftini öneri listesinden çıkarmak için
  const { data: existingLinksRaw } = await supabase
    .from('internal_links')
    .select('source_page_id, target_page_id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  const existingPairs = new Set(
    (existingLinksRaw ?? []).map((l) => `${l.source_page_id}:${l.target_page_id}`)
  )

  // Pillar ve support sayfaları ayır
  const pillarPages = pages.filter((p) => p.page_type && PILLAR_TYPES.includes(p.page_type))
  const supportPages = pages.filter((p) => p.page_type && SUPPORT_TYPES.includes(p.page_type))

  // Her pillar → her support için öneri üret; zaten var olanları atla
  const suggestions: InternalLinkSuggestion[] = []
  for (const pillar of pillarPages) {
    for (const support of supportPages) {
      const pairKey = `${pillar.id}:${support.id}`
      if (existingPairs.has(pairKey)) continue

      const anchorText = support.focus_keyword_id
        ? (kwMap.get(support.focus_keyword_id) ?? support.title)
        : support.title

      suggestions.push({
        sourcePage: { id: pillar.id, title: pillar.title, page_type: pillar.page_type },
        targetPage: { id: support.id, title: support.title, page_type: support.page_type },
        anchorText,
        linkType: 'contextual',
      })
    }
  }

  return { success: true, suggestions }
}
