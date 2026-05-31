'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const REQUIRED_FIELDS: Record<string, string> = {
  name:             'Proje Adı',
  domain:           'Domain',
  sector:           'Sektör',
  site_type:        'Site Türü',
  target_country:   'Hedef Ülke',
  target_language:  'Hedef Dil',
  business_model:   'İş Modeli',
  target_customer:  'Hedef Müşteri',
  main_goal:        'Ana Hedef',
}

export type ApproveResult =
  | { success: true; redirectTo: string }
  | { success: false; missingFields: { key: string; label: string }[] }

export async function approveProjectInfo(projectId: string): Promise<ApproveResult> {
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return { success: false, missingFields: [] }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, missingFields: [] }

  // Projeyi oku
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, site_type, target_country, target_language, business_model, brand_tone, target_customer, main_goal, target_keywords, initial_competitors, notes')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { success: false, missingFields: [] }

  // Zorunlu alan kontrolü
  const missing = Object.entries(REQUIRED_FIELDS)
    .filter(([key]) => !project[key as keyof typeof project])
    .map(([key, label]) => ({ key, label }))

  if (missing.length > 0) {
    return { success: false, missingFields: missing }
  }

  // Karar havuzuna kaydet — mevcut proje bilgileri snapshot'ı
  const decisionText = [
    `Proje: ${project.name} (${project.domain})`,
    `Sektör: ${project.sector}`,
    `Site Türü: ${project.site_type}`,
    `Hedef: ${project.target_country} / ${project.target_language}`,
    `İş Modeli: ${project.business_model}`,
    `Hedef Müşteri: ${project.target_customer}`,
    `Ana Hedef: ${project.main_goal}`,
    project.brand_tone ? `Marka Tonu: ${project.brand_tone}` : null,
  ].filter(Boolean).join(' | ')

  // Önceki proje-bilgileri kararını deaktif et (idempotent)
  await supabase
    .from('project_decisions')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('section', 'proje-bilgileri')
    .eq('decision_type', 'proje_bilgileri_onaylandi')

  // Yeni kayıt ekle
  await supabase.from('project_decisions').insert({
    project_id:    projectId,
    user_id:       user.id,
    section:       'proje-bilgileri',
    scope_type:    'project',
    decision_type: 'proje_bilgileri_onaylandi',
    decision:      decisionText,
    reason:        'Kullanıcı "Proje Bilgilerini Onayla" butonuna bastı — tüm zorunlu alanlar dolu.',
    is_active:     true,
  })

  revalidatePath(`/control-center/projects/${projectId}/intelligence/decisions`)

  return {
    success:    true,
    redirectTo: `/control-center/projects/${projectId}/settings/business`,
  }
}
