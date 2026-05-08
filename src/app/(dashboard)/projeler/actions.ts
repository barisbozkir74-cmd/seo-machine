'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const STAGE_NAMES = [
  'Proje Bilgileri',
  'Araştırma',
  'Keyword Stratejisi',
  'Site Blueprint',
  'Sayfa Planlaması',
  'Sayfa Paketi',
  'İçerik Üretimi',
  'SEO Denetimi',
  'Yayın Hazırlığı',
  'Yayın Sonrası',
] as const

const projectBaseSchema = z.object({
  name: z.string().min(1, 'Proje adı zorunludur').max(100),
  domain: z
    .string()
    .min(1, 'Domain zorunludur')
    .max(253)
    .regex(/^[^\s]+\.[^\s]+$/, 'Geçerli bir domain girin (örn. musteri.com)'),
  sector: z.string().max(100).optional().or(z.literal('')),
  target_country: z.string().max(100).optional().or(z.literal('')),
  target_language: z.string().max(100).optional().or(z.literal('')),
  business_model: z.string().max(100).optional().or(z.literal('')),
  site_type: z.string().max(100).optional().or(z.literal('')),
  brand_tone: z.string().max(100).optional().or(z.literal('')),
  target_customer: z.string().max(500).optional().or(z.literal('')),
  main_goal: z.string().max(1000).optional().or(z.literal('')),
  initial_competitors: z.string().max(1000).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  custom_rules: z.string().max(2000).optional().or(z.literal('')),
  target_keywords: z.string().max(2000).optional().or(z.literal('')),
})

export type CreateProjectInput = z.infer<typeof projectBaseSchema>

export type CreateProjectResult =
  | { success: true; projectId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createProject(
  input: CreateProjectInput
): Promise<CreateProjectResult> {
  const parsed = projectBaseSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Form verileri geçersiz.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }
  }

  const data = parsed.data

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: data.name,
      domain: data.domain,
      sector: data.sector || null,
      target_country: data.target_country || null,
      target_language: data.target_language || null,
      business_model: data.business_model || null,
      site_type: data.site_type || null,
      brand_tone: data.brand_tone || null,
      target_customer: data.target_customer || null,
      main_goal: data.main_goal || null,
      initial_competitors: data.initial_competitors || null,
      notes: data.notes || null,
      custom_rules: data.custom_rules || null,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Proje oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  const stageRows = STAGE_NAMES.map((stageName, index) => ({
    project_id: project.id,
    user_id: user.id,
    stage_name: stageName,
    status: index === 0 ? 'active' : 'pending',
    started_at: index === 0 ? new Date().toISOString() : null,
  }))

  const { error: stagesError } = await supabase.from('stages').insert(stageRows)

  if (stagesError) {
    await supabase.from('projects').delete().eq('id', project.id)
    return { success: false, error: 'Proje aşamaları oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  revalidatePath('/projeler')
  return { success: true, projectId: project.id }
}

// ─── Proje güncelleme ─────────────────────────────────────────────────────────

export type UpdateProjectInput = z.infer<typeof projectBaseSchema>

export type UpdateProjectResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput
): Promise<UpdateProjectResult> {
  const parsed = projectBaseSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Form verileri geçersiz.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const data = parsed.data

  const { error } = await supabase
    .from('projects')
    .update({
      name: data.name,
      domain: data.domain,
      sector: data.sector || null,
      target_country: data.target_country || null,
      target_language: data.target_language || null,
      business_model: data.business_model || null,
      site_type: data.site_type || null,
      brand_tone: data.brand_tone || null,
      target_customer: data.target_customer || null,
      main_goal: data.main_goal || null,
      initial_competitors: data.initial_competitors || null,
      notes: data.notes || null,
      custom_rules: data.custom_rules || null,
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Proje güncellenemedi. Lütfen tekrar deneyin.' }

  revalidatePath(`/projeler/${projectId}`)
  revalidatePath('/projeler')
  return { success: true }
}

// ─── Tek alan güncelleme (inline edit için) ───────────────────────────────────

const ALLOWED_FIELDS = [
  'name', 'domain', 'sector', 'target_country', 'target_language',
  'business_model', 'site_type', 'brand_tone', 'target_customer',
  'main_goal', 'initial_competitors', 'notes', 'custom_rules', 'target_keywords',
] as const

type AllowedField = typeof ALLOWED_FIELDS[number]

export type UpdateFieldResult =
  | { success: true }
  | { success: false; error: string }

export async function updateProjectField(
  projectId: string,
  field: AllowedField,
  value: string
): Promise<UpdateFieldResult> {
  if (!ALLOWED_FIELDS.includes(field)) {
    return { success: false, error: 'Geçersiz alan.' }
  }

  const fieldSchema = projectBaseSchema.shape[field]
  const parsed = fieldSchema.safeParse(value)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Geçersiz değer.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('projects')
    .update({ [field]: value || null })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Kaydedilemedi. Lütfen tekrar deneyin.' }

  revalidatePath(`/projeler/${projectId}`)
  revalidatePath('/projeler')
  return { success: true }
}

// ─── Proje silme ──────────────────────────────────────────────────────────────

export type DeleteProjectResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteProject(projectId: string): Promise<DeleteProjectResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Proje silinemedi. Lütfen tekrar deneyin.' }

  revalidatePath('/projeler')
  return { success: true }
}
