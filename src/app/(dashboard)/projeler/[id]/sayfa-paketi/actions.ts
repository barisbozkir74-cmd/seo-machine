'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getWordPressCredentials } from '@/lib/supabase/vault'
import { getValidGscToken } from '@/lib/gsc/auth'
import { checkUrlIndexStatus } from '@/lib/gsc/index-check'

export type ActionResult = { success: true } | { success: false; error: string }

export type RevisionRow = {
  id: string
  version_num: number
  snapshot: Record<string, unknown>
  created_at: string
}

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

// ContentSection runtime tipi koruma — JSONB'den gelen veriyi doğrular
function isContentSection(item: unknown): item is ContentSection {
  if (typeof item !== 'object' || item === null) return false
  const s = item as Record<string, unknown>
  return (
    typeof s.heading === 'string' &&
    typeof s.level === 'number' &&
    Array.isArray(s.sub_headings) &&
    typeof s.content === 'string' &&
    ['pending', 'generating', 'draft', 'approved', 'rejected'].includes(s.status as string)
  )
}

function parseContentSections(raw: unknown): ContentSection[] {
  return Array.isArray(raw) && (raw as unknown[]).every(isContentSection)
    ? (raw as ContentSection[])
    : []
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
  // WR-04: validate client-supplied array before writing to JSONB
  if (!Array.isArray(sections) || !sections.every(isContentSection)) {
    return { success: false, error: 'Geçersiz bölüm verisi.' }
  }
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

  const sections: ContentSection[] = parseContentSections(pkg.content_sections)

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

  const sections: ContentSection[] = parseContentSections(pkg.content_sections)

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

  // D-04: Auto-snapshot before every save
  // 1. Fetch current package state for snapshot
  const { data: currentPkg } = await supabase
    .from('page_packages')
    .select('*')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (currentPkg) {
    // 2. Count existing revisions to compute next version_num
    const { count } = await supabase
      .from('page_package_revisions')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', currentPkg.id)

    const versionNum = (count ?? 0) + 1

    // 3. Insert revision — non-fatal: do not block save on failure
    // ignoreDuplicates: true handles COUNT→INSERT race condition: if two concurrent
    // saves compute the same version_num, the second upsert is silently skipped.
    await supabase
      .from('page_package_revisions')
      .upsert(
        {
          package_id: currentPkg.id,
          page_id: pageId,
          project_id: projectId,
          user_id: user.id,
          snapshot: currentPkg,
          version_num: versionNum,
        },
        { onConflict: 'package_id,version_num', ignoreDuplicates: true }
      )
    // Note: no error check — revision failure does not block save
  }

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

export type PublishResult =
  | { success: true; wpPostId: number; wpPostUrl: string; wpStatus: string }
  | { success: false; error: string }

// WordPress plugin tespiti için yardımcı
type WpPlugin = { plugin: string; status: string }

function detectSeoPlugin(plugins: WpPlugin[]): 'yoast' | 'rankmath' | 'none' {
  const slugs = plugins.map((p) => p.plugin)
  if (slugs.some((s) => s.includes('wordpress-seo'))) return 'yoast'
  if (slugs.some((s) => s.includes('rank-math'))) return 'rankmath'
  return 'none'
}

// Plugin tipine göre WP REST meta payload oluştur
function buildMetaPayload(
  plugin: 'yoast' | 'rankmath' | 'none',
  seoTitle: string | null,
  metaDescription: string | null,
  schemaJsonld: unknown | null
): Record<string, string> {
  const meta: Record<string, string> = {}

  if (plugin === 'yoast') {
    if (seoTitle) meta['_yoast_wpseo_title'] = seoTitle
    if (metaDescription) meta['_yoast_wpseo_metadesc'] = metaDescription
    if (schemaJsonld) meta['_yoast_wpseo_schema'] = JSON.stringify(schemaJsonld)
  } else if (plugin === 'rankmath') {
    if (seoTitle) meta['rank_math_title'] = seoTitle
    if (metaDescription) meta['rank_math_description'] = metaDescription
    if (schemaJsonld) meta['rank_math_schema'] = JSON.stringify(schemaJsonld)
  } else {
    // Plugin yok — WP native meta.description
    if (metaDescription) meta['description'] = metaDescription
    // Schema skip (native WP desteklemez)
  }

  return meta
}

export async function publishToWordPress(
  projectId: string,
  pageId: string,
  status: 'publish' | 'draft'
): Promise<PublishResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Proje sahipliği doğrula
  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Paket sahipliği + gerekli veri
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id, status, seo_title, html_content, meta_description, schema_jsonld')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!pkg) return { success: false, error: 'Sayfa paketi bulunamadı.' }
  if (pkg.status !== 'locked') return { success: false, error: 'Paket kilitli değil. Önce paketi kilitleyin.' }
  if (!pkg.html_content) return { success: false, error: 'HTML içerik henüz oluşturulmamış. İçerik Stüdyosunu tamamlayın.' }

  // Vault'tan WP credentials al
  const creds = await getWordPressCredentials(projectId)
  if (!creds) {
    return { success: false, error: 'WordPress kimlik bilgileri bulunamadı. Proje ayarlarından ekleyin.' }
  }

  // Basic Auth header
  // appPassword formatı: "kullaniciadi:uygulama_sifresi"
  // Eğer ":" içermiyorsa formatı geçersiz say
  if (!creds.appPassword.includes(':')) {
    return {
      success: false,
      error: 'Uygulama Şifresi geçersiz format. "kullaniciadi:sifre" formatında kaydedin.',
    }
  }
  const authHeader = 'Basic ' + Buffer.from(creds.appPassword).toString('base64')

  // SECURITY: wpUrl'i runtime'da tekrar doğrula (Vault sonradan değişmiş olabilir)
  function assertSafeWpUrl(raw: string): void {
    let parsed: URL
    try { parsed = new URL(raw) } catch {
      throw new Error('wp_url geçersiz.')
    }
    if (parsed.protocol !== 'https:') throw new Error('wp_url HTTPS olmalı.')
    // DNS çözümlemesinden önce bilinen özel/loopback aralıklarını string seviyesinde engelle
    const h = parsed.hostname
    if (
      h === 'localhost' ||
      h.startsWith('127.') ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      h.startsWith('169.254.') ||
      h.endsWith('.local')
    ) {
      throw new Error('wp_url özel ağ adresine işaret edemez.')
    }
  }

  try {
    assertSafeWpUrl(creds.wpUrl)
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }

  const apiBase = creds.wpUrl.replace(/\/$/, '') + '/wp-json/wp/v2'

  // Plugin algıla (her gönderimde — cache yok, D-03)
  let detectedPlugin: 'yoast' | 'rankmath' | 'none' = 'none'
  try {
    const pluginsRes = await fetch(`${apiBase}/plugins`, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    })
    if (pluginsRes.ok) {
      const plugins: WpPlugin[] = await pluginsRes.json()
      detectedPlugin = detectSeoPlugin(plugins)
    }
    // Plugin endpoint 403 dönebilir (yeterli yetki yoksa) — native'e düş
  } catch {
    // Ağ hatası — native'e düş
    detectedPlugin = 'none'
  }

  // Meta payload oluştur
  const meta = buildMetaPayload(
    detectedPlugin,
    pkg.seo_title,
    pkg.meta_description,
    pkg.schema_jsonld
  )

  // WordPress'e POST
  let wpPostId: number
  let wpPostUrl: string

  try {
    const postRes = await fetch(`${apiBase}/posts`, {
      method: 'POST',
      headers: {
        Authorization: authHeader, // SECURITY: loglanmaz
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: pkg.seo_title ?? '',
        content: pkg.html_content,
        status,
        meta,
      }),
    })

    if (!postRes.ok) {
      if (postRes.status === 401 || postRes.status === 403) {
        return {
          success: false,
          error: 'WordPress bağlantısı kurulamadı. URL ve Uygulama Şifresini kontrol edin.',
        }
      }
      return {
        success: false,
        error: 'Gönderim sırasında hata oluştu. Tekrar deneyin.',
      }
    }

    const wpPost = await postRes.json() as Record<string, unknown>
    if (typeof wpPost.id !== 'number' || typeof wpPost.link !== 'string' || !wpPost.link) {
      return {
        success: false,
        error: 'WordPress geçersiz yanıt döndürdü. Lütfen tekrar deneyin.',
      }
    }
    wpPostId = wpPost.id
    wpPostUrl = wpPost.link
  } catch {
    return {
      success: false,
      error: "WordPress'e bağlanılamadı. İnternet bağlantınızı ve site URL'sini kontrol edin.",
    }
  }

  // page_packages güncelle
  const { error: updateError } = await supabase
    .from('page_packages')
    .update({
      wp_post_id: wpPostId,
      wp_post_url: wpPostUrl,
      wp_status: status,
      wp_published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pkg.id)
    .eq('user_id', user.id)

  if (updateError) {
    // WP'de başarılı ama DB'ye yazılamadı — partial success, wpPostId döndür
    return {
      success: false,
      error: `WordPress'e gönderildi (Post ID: ${wpPostId}) ancak durum kaydedilemedi. Lütfen destek alın.`,
    }
  }

  // ─── Phase 16 D-04: Recovery task auto-resolve ─────────────────────────────
  // After a successful WP publish (wp_published_at updated), mark any open/in_progress
  // recovery_task pointing at this page_packages.id as resolved.
  //
  // NON-FATAL: a failure here is logged and ignored. The publish itself already succeeded
  // in WordPress AND in our DB; the user should not see an error because of a bookkeeping
  // hiccup. Worst case: the recovery row stays open and the user can dismiss it manually.
  //
  // Filter rationale:
  //   .eq('source_id', pkg.id)       — pkg.id IS page_packages.id (polymorphic FK convention)
  //   .eq('source', 'page_package')  — defence: prevents accidental match on imported_page rows
  //                                    that happened to share an id (unlikely, but explicit)
  //   .in('status', ['open', 'in_progress']) — never overwrite resolved/dismissed
  try {
    const { error: recoveryUpdateError } = await supabase
      .from('recovery_tasks')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString(),
      })
      .eq('source_id', pkg.id)
      .eq('source', 'page_package')
      .in('status', ['open', 'in_progress'])

    if (recoveryUpdateError) {
      // non-fatal — log and continue
      console.warn(
        '[publishToWordPress] recovery auto-resolve failed:',
        recoveryUpdateError.message,
      )
    }
  } catch (e) {
    // non-fatal — log and continue
    console.warn(
      '[publishToWordPress] recovery auto-resolve threw:',
      e instanceof Error ? e.message : String(e),
    )
  }

  revalidatePath(`/projeler/${projectId}/icerik-studio/${pageId}`)
  revalidatePath(`/projeler/${projectId}/sayfa-paketi`)
  revalidatePath(`/projeler/${projectId}/izleme`)

  return { success: true, wpPostId, wpPostUrl, wpStatus: status }
}

// ─── GSC Index Status Actions ──────────────────────────────────────────────

// D-06: Manuel index kontrolü — URL Inspection API → page_packages güncelleme
// T-14-03: Ownership triple-check (user + project + page_package)
export async function checkIndexStatus(
  pagePackageId: string,
  projectId: string,
  inspectionUrl: string // page_packages.wp_post_url
): Promise<{ success: boolean; status?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Triple ownership: user → project → page_package
  const { data: project } = await supabase
    .from('projects')
    .select('id, gsc_property_url')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }
  if (!project.gsc_property_url) return { success: false, error: 'GSC property seçilmemiş.' }

  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id')
    .eq('id', pagePackageId)
    .eq('project_id', projectId)
    .single()
  if (!pkg) return { success: false, error: 'Sayfa paketi bulunamadı.' }

  // Token al
  const accessToken = await getValidGscToken(projectId, user.id)
  if (!accessToken) return { success: false, error: 'GSC bağlantısı geçersiz. Yeniden bağlanın.' }

  // URL Inspection API
  const status = await checkUrlIndexStatus(accessToken, inspectionUrl, project.gsc_property_url)

  if (status === 'unknown') {
    return { success: false, error: 'Index durumu alınamadı. Tekrar deneyin.' }
  }

  // Sonucu kaydet
  const { error: updateError } = await supabase
    .from('page_packages')
    .update({
      gsc_index_status: status,
      gsc_index_checked_at: new Date().toISOString(),
    })
    .eq('id', pagePackageId)
    .eq('project_id', projectId) // ek güvenlik filtresi

  if (updateError) return { success: false, error: 'Sonuç kaydedilemedi.' }

  return { success: true, status }
}

export async function getRevisions(
  projectId: string,
  pageId: string
): Promise<{ success: true; revisions: RevisionRow[] } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const project = await verifyOwnership(supabase, projectId, user.id)
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Resolve package_id from page_id
  const { data: pkg } = await supabase
    .from('page_packages')
    .select('id')
    .eq('page_id', pageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!pkg) return { success: true, revisions: [] }

  const { data, error } = await supabase
    .from('page_package_revisions')
    .select('id, version_num, snapshot, created_at')
    .eq('package_id', pkg.id)
    .order('version_num', { ascending: false })

  if (error) return { success: false, error: 'Revizyon geçmişi yüklenemedi.' }

  return { success: true, revisions: (data ?? []) as RevisionRow[] }
}
