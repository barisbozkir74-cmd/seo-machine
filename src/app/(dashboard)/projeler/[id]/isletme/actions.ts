'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f-]{36}$/i

export type EntityType = 'product' | 'service' | 'category' | 'service_area' | 'persona' | 'usp'
export type SeoIntent = 'commercial' | 'transactional' | 'informational' | 'local' | 'navigational'
export type EntityStatus = 'active' | 'draft' | 'archived'

export type BusinessEntity = {
  id: string
  project_id: string
  type: EntityType
  name: string
  description: string | null
  seo_intent: SeoIntent | null
  primary_keyword: string | null
  target_url: string | null
  parent_id: string | null
  attributes: Record<string, unknown>
  is_primary: boolean
  status: EntityStatus
  sort_order: number | null
  created_at: string
  updated_at: string
}

export type EntityInput = {
  type: EntityType
  name: string
  description?: string
  seo_intent?: SeoIntent | null
  primary_keyword?: string
  target_url?: string
  parent_id?: string | null
  attributes?: Record<string, unknown>
  is_primary?: boolean
  status?: EntityStatus
}

export type ActionResult = { success: true } | { success: false; error: string }
export type EntityResult = { success: true; entity: BusinessEntity } | { success: false; error: string }

const VALID_TYPES: EntityType[] = ['product', 'service', 'category', 'service_area', 'persona', 'usp']
const VALID_INTENTS: SeoIntent[] = ['commercial', 'transactional', 'informational', 'local', 'navigational']
const VALID_STATUSES: EntityStatus[] = ['active', 'draft', 'archived']

// ─── Add ──────────────────────────────────────────────────────────────────────

export async function addBusinessEntity(
  projectId: string,
  input: EntityInput
): Promise<EntityResult> {
  if (!UUID_RE.test(projectId)) return { success: false, error: 'Geçersiz proje ID.' }
  if (!input.name?.trim()) return { success: false, error: 'Ad boş olamaz.' }
  if (!VALID_TYPES.includes(input.type)) return { success: false, error: 'Geçersiz tip.' }
  if (input.seo_intent && !VALID_INTENTS.includes(input.seo_intent)) return { success: false, error: 'Geçersiz SEO intent.' }
  if (input.parent_id && !UUID_RE.test(input.parent_id)) return { success: false, error: 'Geçersiz parent ID.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { data, error } = await supabase
    .from('business_entities')
    .insert({
      user_id: user.id,
      project_id: projectId,
      type: input.type,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      seo_intent: input.seo_intent ?? null,
      primary_keyword: input.primary_keyword?.trim() || null,
      target_url: input.target_url?.trim() || null,
      parent_id: input.parent_id ?? null,
      attributes: input.attributes ?? {},
      is_primary: input.is_primary ?? false,
      status: input.status ?? 'active',
    })
    .select()
    .single()

  if (error) return { success: false, error: 'Kayıt eklenemedi.' }

  revalidatePath(`/projeler/${projectId}/isletme`)
  revalidatePath(`/control-center/projects/${projectId}`, 'layout')
  return { success: true, entity: data as BusinessEntity }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateBusinessEntity(
  entityId: string,
  projectId: string,
  input: Partial<EntityInput>
): Promise<ActionResult> {
  if (!UUID_RE.test(entityId) || !UUID_RE.test(projectId)) return { success: false, error: 'Geçersiz ID.' }
  if (input.name !== undefined && !input.name.trim()) return { success: false, error: 'Ad boş olamaz.' }
  if (input.type && !VALID_TYPES.includes(input.type)) return { success: false, error: 'Geçersiz tip.' }
  if (input.seo_intent && !VALID_INTENTS.includes(input.seo_intent)) return { success: false, error: 'Geçersiz SEO intent.' }
  if (input.status && !VALID_STATUSES.includes(input.status)) return { success: false, error: 'Geçersiz durum.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const payload: Record<string, unknown> = {}
  if (input.name !== undefined)           payload.name = input.name.trim()
  if (input.description !== undefined)    payload.description = input.description?.trim() || null
  if (input.seo_intent !== undefined)     payload.seo_intent = input.seo_intent ?? null
  if (input.primary_keyword !== undefined) payload.primary_keyword = input.primary_keyword?.trim() || null
  if (input.target_url !== undefined)     payload.target_url = input.target_url?.trim() || null
  if (input.parent_id !== undefined)      payload.parent_id = input.parent_id ?? null
  if (input.attributes !== undefined)     payload.attributes = input.attributes
  if (input.is_primary !== undefined)     payload.is_primary = input.is_primary
  if (input.status !== undefined)         payload.status = input.status

  if (Object.keys(payload).length === 0) return { success: true }

  const { error } = await supabase
    .from('business_entities')
    .update(payload)
    .eq('id', entityId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Güncelleme başarısız.' }

  revalidatePath(`/projeler/${projectId}/isletme`)
  revalidatePath(`/control-center/projects/${projectId}`, 'layout')
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBusinessEntity(
  entityId: string,
  projectId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(entityId) || !UUID_RE.test(projectId)) return { success: false, error: 'Geçersiz ID.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('business_entities')
    .delete()
    .eq('id', entityId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Silme başarısız.' }

  revalidatePath(`/projeler/${projectId}/isletme`)
  revalidatePath(`/control-center/projects/${projectId}`, 'layout')
  return { success: true }
}

// ─── Bulk delete ─────────────────────────────────────────────────────────────

export async function bulkDeleteEntities(
  projectId: string,
  entityIds: string[]
): Promise<ActionResult> {
  if (!UUID_RE.test(projectId)) return { success: false, error: 'Geçersiz proje ID.' }
  if (!entityIds.length) return { success: false, error: 'Silinecek kayıt yok.' }
  if (entityIds.some(id => !UUID_RE.test(id))) return { success: false, error: 'Geçersiz entity ID.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('business_entities')
    .delete()
    .in('id', entityIds)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Silme başarısız.' }

  revalidatePath(`/projeler/${projectId}/isletme`)
  revalidatePath(`/control-center/projects/${projectId}`, 'layout')
  return { success: true }
}

// ─── Bulk import (paste text → parse lines) ───────────────────────────────────

export type BulkImportResult =
  | { success: true; count: number }
  | { success: false; error: string }

export async function bulkImportEntities(
  projectId: string,
  type: EntityType,
  text: string
): Promise<BulkImportResult> {
  if (!UUID_RE.test(projectId)) return { success: false, error: 'Geçersiz proje ID.' }
  if (!VALID_TYPES.includes(type)) return { success: false, error: 'Geçersiz tip.' }

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[-•*·]\s*/, ''))
    .filter(Boolean)

  if (lines.length === 0) return { success: false, error: 'Boş liste.' }
  if (lines.length > 200) return { success: false, error: 'En fazla 200 kayıt.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: project } = await supabase
    .from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const rows = lines.map((name, i) => ({
    user_id: user.id,
    project_id: projectId,
    type,
    name,
    sort_order: i,
    attributes: {},
  }))

  const { error } = await supabase
    .from('business_entities')
    .upsert(rows, { onConflict: 'project_id,type,name', ignoreDuplicates: true })

  if (error) return { success: false, error: 'Toplu ekleme başarısız.' }

  revalidatePath(`/projeler/${projectId}/isletme`)
  revalidatePath(`/control-center/projects/${projectId}`, 'layout')
  return { success: true, count: lines.length }
}
