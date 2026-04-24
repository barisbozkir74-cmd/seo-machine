'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PageFormData = {
  title: string
  slug: string
  page_type: string
  priority: 'yüksek' | 'orta' | 'düşük'
  parent_id?: string | null
}

export type CreatePageResult =
  | { success: true }
  | { success: false; error: string }

export async function createPage(
  projectId: string,
  data: PageFormData
): Promise<CreatePageResult> {
  if (!data.title?.trim()) return { success: false, error: 'Sayfa adı boş olamaz.' }
  if (!data.slug?.trim()) return { success: false, error: 'Slug boş olamaz.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase.from('pages').insert({
    user_id: user.id,
    project_id: projectId,
    title: data.title.trim(),
    slug: data.slug.trim(),
    page_type: data.page_type,
    priority: data.priority,
    parent_id: data.parent_id ?? null,
    status: 'draft',
  })

  if (error) return { success: false, error: 'Sayfa eklenemedi: ' + error.message }

  revalidatePath(`/projeler/${projectId}/sayfalar`)
  return { success: true }
}

export type DeletePageResult =
  | { success: true }
  | { success: false; error: string }

export async function deletePage(
  projectId: string,
  pageId: string
): Promise<DeletePageResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Sayfa silinemedi.' }

  revalidatePath(`/projeler/${projectId}/sayfalar`)
  return { success: true }
}

// ─── Toplu Sayfa Özellik Güncelleme (D-01) ────────────────────────────────────

export type PageAttributeUpdate = {
  id: string
  page_type?: string | null
  focus_keyword_id?: string | null
  priority?: 'yüksek' | 'orta' | 'düşük' | null
}

export type UpdatePageAttributesResult =
  | { success: true }
  | { success: false; error: string }

export async function updatePageAttributes(
  projectId: string,
  updates: PageAttributeUpdate[]
): Promise<UpdatePageAttributesResult> {
  if (!updates || updates.length === 0) return { success: true }

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

  // CR-01 fix: page ID'lerinin bu projeye ve kullanıcıya ait olduğunu doğrula
  const updateIds = updates.map((u) => u.id)
  const { data: ownedPages } = await supabase
    .from('pages')
    .select('id')
    .in('id', updateIds)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  const ownedIds = new Set((ownedPages ?? []).map((p: { id: string }) => p.id))
  if (ownedIds.size !== updateIds.length) {
    return { success: false, error: 'Bazı sayfalar bu projeye ait değil.' }
  }

  // Bulk upsert — tüm ID'ler doğrulandı; user_id ve project_id payload'a dahil
  const payload = updates.map((u) => ({
    id: u.id,
    project_id: projectId,
    user_id: user.id,
    ...(u.page_type !== undefined ? { page_type: u.page_type } : {}),
    ...(u.focus_keyword_id !== undefined ? { focus_keyword_id: u.focus_keyword_id } : {}),
    ...(u.priority !== undefined ? { priority: u.priority } : {}),
  }))

  const { error } = await supabase
    .from('pages')
    .upsert(payload, { onConflict: 'id' })

  if (error) return { success: false, error: 'Güncelleme başarısız.' }

  revalidatePath(`/projeler/${projectId}/sayfalar`)
  return { success: true }
}
