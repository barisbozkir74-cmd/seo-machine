'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { success: false; error: string }

export type ContentSection = {
  heading: string
  level: number
  sub_headings: string[]
  content: string
  status: 'pending' | 'generating' | 'draft' | 'approved' | 'rejected'
}

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
  // Schema JSON-LD (Phase 10)
  schema_jsonld?: unknown
  // QA
  qa_scores?: unknown
  // Content Studio (Phase 12)
  content_sections?: unknown
  html_content?: string
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

// HTML kaçış helper — XSS engellemek için tüm dinamik değerlere uygulanır
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// HTML birleştirme helper — tüm bölümler approved olduğunda kullanılır
function assembleHtml(sections: ContentSection[]): string {
  return sections
    .map((section) => {
      const safeHeading = escapeHtml(section.heading)
      const safeContent = escapeHtml(section.content)
      let html = `<h2>${safeHeading}</h2>\n<p>${safeContent}</p>`
      if (section.sub_headings && section.sub_headings.length > 0) {
        const subHtml = section.sub_headings.map((sub) => `<h3>${escapeHtml(sub)}</h3>`).join('\n')
        html = `<h2>${safeHeading}</h2>\n${subHtml}\n<p>${safeContent}</p>`
      }
      return html
    })
    .join('\n\n')
}

/**
 * saveContentSections: Streaming tamamlandıktan sonra tüm bölümleri bulk yazar.
 * Client, stream bittikten sonra sections[] dizisini (status='draft') bu action'a gönderir.
 */
export async function saveContentSections(
  projectId: string,
  pageId: string,
  sections: ContentSection[]
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Ownership: page_packages'ı page_id + project_id + user_id üçlüsüyle doğrula
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return { success: false, error: 'Paket bulunamadı.' }
  if (pkg.status !== 'locked') return { success: false, error: 'Paket kilitli değil.' }

  const { error } = await supabase
    .from('page_packages')
    .update({ content_sections: sections, updated_at: new Date().toISOString() })
    .eq('id', pkg.id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Bölümler kaydedilemedi: ' + error.message }

  revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}

/**
 * approveSection: Belirtilen bölümü approved yapar, içeriği kaydeder.
 * Tüm bölümler approved ise html_content otomatik birleştirilir.
 */
export async function approveSection(
  projectId: string,
  pageId: string,
  sectionIndex: number,
  content: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, content_sections')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return { success: false, error: 'Paket bulunamadı.' }
  if (pkg.status !== 'locked') return { success: false, error: 'Paket kilitli değil.' }

  const sections: ContentSection[] = Array.isArray(pkg.content_sections)
    ? (pkg.content_sections as ContentSection[])
    : []

  if (sectionIndex < 0 || sectionIndex >= sections.length) {
    return { success: false, error: 'Geçersiz bölüm indeksi.' }
  }

  sections[sectionIndex] = { ...sections[sectionIndex], content, status: 'approved' }

  // Tüm bölümler approved ise HTML birleştir
  const allApproved = sections.every((s) => s.status === 'approved')
  const htmlContent = allApproved ? assembleHtml(sections) : undefined

  const updatePayload: Record<string, unknown> = {
    content_sections: sections,
    updated_at: new Date().toISOString(),
  }
  if (htmlContent !== undefined) {
    updatePayload.html_content = htmlContent
  }

  const { error } = await supabase
    .from('page_packages')
    .update(updatePayload)
    .eq('id', pkg.id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Bölüm onaylanamadı: ' + error.message }

  revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
}

/**
 * rejectSection: Belirtilen bölümü rejected yapar.
 * Client bölümü pending'e döndürür ve yeniden üretebilir.
 */
export async function rejectSection(
  projectId: string,
  pageId: string,
  sectionIndex: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, content_sections')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!pkg) return { success: false, error: 'Paket bulunamadı.' }
  if (pkg.status !== 'locked') return { success: false, error: 'Paket kilitli değil.' }

  const sections: ContentSection[] = Array.isArray(pkg.content_sections)
    ? (pkg.content_sections as ContentSection[])
    : []

  if (sectionIndex < 0 || sectionIndex >= sections.length) {
    return { success: false, error: 'Geçersiz bölüm indeksi.' }
  }

  sections[sectionIndex] = { ...sections[sectionIndex], status: 'rejected' }

  const { error } = await supabase
    .from('page_packages')
    .update({ content_sections: sections, updated_at: new Date().toISOString() })
    .eq('id', pkg.id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Bölüm reddedilemedi: ' + error.message }

  revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  return { success: true }
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
        .eq('user_id', user.id)
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

  // Mevcut durumu oku ve geçişin geçerli olup olmadığını doğrula
  const { data: current } = await supabase
    .from('page_packages')
    .select('status')
    .eq('id', packageId)
    .eq('user_id', user.id)
    .single()

  const validTransitions: Record<string, string[]> = {
    draft: ['approved'],
    approved: ['locked', 'draft'],
    locked: ['approved'],
  }
  if (!current || !validTransitions[current.status]?.includes(newStatus)) {
    return { success: false, error: 'Geçersiz durum geçişi.' }
  }

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
