'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const STAGE_NAMES = [
  'Alım',
  'Keşif',
  'Keyword Stratejisi',
  'Site Blueprint',
  'Sayfa Planlaması',
  'Sayfa Paketi',
  'İçerik Üretimi',
  'SEO Denetimi',
  'Yayın Hazırlığı',
  'Yayın Sonrası',
] as const

const createProjectSchema = z.object({
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
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export type CreateProjectResult =
  | { success: true; projectId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createProject(
  input: CreateProjectInput
): Promise<CreateProjectResult> {
  // 1. Validate input
  const parsed = createProjectSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Form verileri geçersiz.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2. Authenticate — user_id never taken from form (T-02-03-01)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }
  }

  const data = parsed.data

  // 3. Insert project
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
    })
    .select('id')
    .single()

  if (projectError || !project) {
    return { success: false, error: 'Proje oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  // 4. Insert 10 stages — first one active, rest pending (T-02-03-04)
  const stageRows = STAGE_NAMES.map((stageName, index) => ({
    project_id: project.id,
    user_id: user.id,
    stage_name: stageName,
    status: index === 0 ? 'active' : 'pending',
    started_at: index === 0 ? new Date().toISOString() : null,
  }))

  const { error: stagesError } = await supabase.from('stages').insert(stageRows)

  if (stagesError) {
    // Project inserted but stages failed — clean up project to avoid orphan record
    await supabase.from('projects').delete().eq('id', project.id)
    return { success: false, error: 'Proje aşamaları oluşturulamadı. Lütfen tekrar deneyin.' }
  }

  // 5. Revalidate and return
  revalidatePath('/projeler')
  return { success: true, projectId: project.id }
}
