'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { saveWpCredentials } from '@/lib/supabase/vault'

export type AdvanceStageResult =
  | { success: true; isLastStage: boolean }
  | { success: false; error: string }

export async function advanceStage(
  projectId: string,
  currentStageId: string
): Promise<AdvanceStageResult> {
  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // 2. Complete current stage — only if it's active, belongs to this project and user
  const { data: updated, error: completeError } = await supabase
    .from('stages')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', currentStageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select('id')

  if (completeError || !updated || updated.length === 0) {
    return { success: false, error: 'Aşama tamamlanamadı. Lütfen tekrar deneyin.' }
  }

  // 3. Find and activate next pending stage
  const { data: nextStage } = await supabase
    .from('stages')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let isLastStage = false

  if (nextStage) {
    const { error: activateError } = await supabase
      .from('stages')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', nextStage.id)
      .eq('project_id', projectId)
      .eq('user_id', user.id)

    if (activateError) {
      return { success: false, error: 'Sonraki aşama başlatılamadı. Lütfen tekrar deneyin.' }
    }
  } else {
    // No more pending stages — all completed
    isLastStage = true
  }

  revalidatePath(`/projeler/${projectId}`)
  return { success: true, isLastStage }
}

export type AddNoteResult =
  | { success: true }
  | { success: false; error: string }

export async function addNote(
  stageId: string,
  projectId: string,
  content: string
): Promise<AddNoteResult> {
  // 1. Validate content
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Not içeriği boş olamaz.' }
  }
  if (content.length > 5000) {
    return { success: false, error: 'Not en fazla 5000 karakter olabilir.' }
  }

  // 2. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // 3. Verify stage ownership (T-02-06-01)
  const { data: stage } = await supabase
    .from('stages')
    .select('id')
    .eq('id', stageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!stage) {
    return { success: false, error: 'Aşama bulunamadı.' }
  }

  // 4. Insert note into audits
  const { error } = await supabase.from('audits').insert({
    project_id: projectId,
    user_id: user.id,
    event_type: 'note',
    entity_type: 'stage',
    entity_id: stageId,
    payload: { content: content.trim() },
  })

  if (error) {
    return { success: false, error: 'Not kaydedilemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}`)
  return { success: true }
}

export type SaveWpCredentialsResult =
  | { success: true }
  | { success: false; error: string }

export async function saveWordPressCredentials(
  projectId: string,
  wpUrl: string,
  appPassword: string,
  username: string
): Promise<SaveWpCredentialsResult> {
  if (!wpUrl || !wpUrl.startsWith('https://')) {
    return { success: false, error: "Geçerli bir WordPress URL'si girin (https:// ile başlamalı)." }
  }
  if (!username || username.trim().length === 0) {
    return { success: false, error: 'WordPress kullanıcı adı gereklidir.' }
  }
  if (!appPassword || appPassword.trim().length === 0) {
    return { success: false, error: 'Uygulama Şifresi gereklidir.' }
  }

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

  try {
    // SECURITY: appPassword vault.ts'e iletilir — loglanmaz, response'ta dönmez
    await saveWpCredentials(projectId, wpUrl, appPassword, username)
  } catch {
    return { success: false, error: 'WordPress bağlantısı kaydedilemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}`)
  return { success: true }
}

// ─── GSC Integration Actions ───────────────────────────────────────────────

// D-01: OAuth flow başlatma — state HttpOnly cookie'ye, redirect Google'a
// D-02: HttpOnly cookie ile CSRF koruması
// D-03: Scopes: webmasters.readonly + webmasters (URL Inspection için)
export async function initiateGscOAuth(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ownership doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) redirect('/projeler')

  // State: "projectId:uuid" formatı — callback'te projectId çözülür
  const state = `${projectId}:${crypto.randomUUID()}`
  const cookieStore = await cookies()
  cookieStore.set('gsc_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 dakika
    path: '/',
  })

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters',
  ].join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent') // RESEARCH.md Pitfall 1: prompt=consent refresh_token garantisi
  authUrl.searchParams.set('state', state)

  redirect(authUrl.toString())
}

// D-04: Seçilen property'yi projects.gsc_property_url'e yaz
export async function saveGscProperty(
  projectId: string,
  propertyUrl: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('projects')
    .update({ gsc_property_url: propertyUrl })
    .eq('id', projectId)
    .eq('user_id', user.id) // T-14-02: ownership garantisi

  if (error) return { success: false, error: 'Property kaydedilemedi.' }
  return { success: true }
}

// ─── Notes Actions ─────────────────────────────────────────────────────────

export type NoteActionResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteNote(
  noteId: string,
  projectId: string
): Promise<NoteActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('audits')
    .delete()
    .eq('id', noteId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('event_type', 'note')

  if (error) return { success: false, error: 'Not silinemedi.' }

  revalidatePath(`/projeler/${projectId}`)
  return { success: true }
}

export async function updateNote(
  noteId: string,
  projectId: string,
  content: string
): Promise<NoteActionResult> {
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Not içeriği boş olamaz.' }
  }
  if (content.length > 5000) {
    return { success: false, error: 'Not en fazla 5000 karakter olabilir.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('audits')
    .update({ payload: { content: content.trim() } })
    .eq('id', noteId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('event_type', 'note')

  if (error) return { success: false, error: 'Not güncellenemedi.' }

  revalidatePath(`/projeler/${projectId}`)
  return { success: true }
}

// ─── WordPress Site Import Actions ────────────────────────────────────────────

// T-15.5-07-01: startSiteImport — kullanıcı kendi projesini tetikleyebilir
// T-15.5-07-02: userId server-side session'dan alınır — client'tan gelmez
export async function startSiteImport(
  projectId: string
): Promise<{ jobStarted: boolean; error?: string }> {
  'use server'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { jobStarted: false, error: 'Oturum bulunamadı.' }

  // T-15.5-07-01: Ownership check — başkasının projesini tetikleyemez
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { jobStarted: false, error: 'Proje bulunamadı.' }

  // T-15.5-07-02: userId server-side session'dan alınır — RESEARCH.md Pitfall 1:
  // Uzun import loop Route Handler'da çalışmalı, Server Action burada fire & forget yapar
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Fire & forget — await etmiyoruz; loop Route Handler'da asenkron çalışır
  fetch(`${siteUrl}/api/wp/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, userId: user.id }),
  }).catch((err) => console.error('[startSiteImport] fire&forget failed:', err))

  return { jobStarted: true }
}
