'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { success: false; error: string }

export type CreatePackageResult =
  | { success: true; id: string }
  | { success: false; error: string }

export type PagePackageData = {
  // Temel Bilgiler
  page_type?: string
  strategic_purpose?: string
  search_intent?: string
  // Meta & URL
  slug?: string
  seo_title?: string
  meta_description?: string
  h1?: string
  canonical_url?: string
  // Heading
  heading_hierarchy?: unknown
  // Schema
  schema_type?: string
  // İçerik
  content_blocks?: unknown
  cta_blocks?: unknown
  // Görsel
  image_plan?: unknown
  alt_texts?: unknown
  // Keywords
  secondary_keywords?: unknown
  // FAQ
  faq?: unknown
  // QA
  qa_scores?: unknown
}

// Proje sahipliğini doğrulayan yardımcı fonksiyon
async function verifyOwnership(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return data
}

/**
 * updatePagePackage: page_packages tablosuna upsert yapar.
 * Çakışma durumunda (aynı page_id) mevcut satırı günceller.
 * D-05: Artık pages tablosuna değil, page_packages tablosuna yazar.
 */
export async function updatePagePackage(
  projectId: string,
  pageId: string,
  data: PagePackageData
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('page_packages')
    .upsert(
      {
        page_id: pageId,
        project_id: projectId,
        user_id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'page_id' }
    )

  if (error) return { success: false, error: 'Paket kaydedilemedi: ' + error.message }

  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}

/**
 * createPagePackage: Boş draft package satırı oluşturur.
 * D-02: Kullanıcı "AI ile Üret" veya "Manuel Başlat" aksiyonunu aldığında çağrılır.
 * Sayfa eklenince otomatik çağrılmaz.
 */
export async function createPagePackage(
  projectId: string,
  pageId: string,
  generatedBy: 'ai' | 'manual'
): Promise<CreatePackageResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Sayfa sahipliğini doğrula
  const { data: page } = await supabase
    .from('pages')
    .select('id')
    .eq('id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!page) return { success: false, error: 'Sayfa bulunamadı.' }

  const { data, error } = await supabase
    .from('page_packages')
    .insert({
      page_id: pageId,
      project_id: projectId,
      user_id: user.id,
      status: 'draft',
      generated_by: generatedBy,
      ai_model: generatedBy === 'ai' ? 'claude-sonnet-4-6' : null,
    })
    .select('id')
    .single()

  if (error) {
    // Zaten mevcut ise (UNIQUE violation) mevcut paketi döndür
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('page_packages')
        .select('id')
        .eq('page_id', pageId)
        .single()
      if (existing) return { success: true, id: existing.id }
    }
    return { success: false, error: 'Paket oluşturulamadı: ' + error.message }
  }

  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true, id: data.id }
}

/**
 * updatePackageStatus: Package status geçişi.
 * D-03: draft → approved → locked, locked → approved (unlock), approved → draft
 * Status'a göre timestamp alanları güncellenir.
 */
export async function updatePackageStatus(
  projectId: string,
  packageId: string,
  newStatus: 'draft' | 'approved' | 'locked'
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const now = new Date().toISOString()
  const timestampField =
    newStatus === 'approved' ? { approved_at: now } :
    newStatus === 'locked'   ? { locked_at: now } :
    {}

  const { error } = await supabase
    .from('page_packages')
    .update({
      status: newStatus,
      ...timestampField,
      updated_at: now,
    })
    .eq('id', packageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Durum güncellenemedi: ' + error.message }

  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}
