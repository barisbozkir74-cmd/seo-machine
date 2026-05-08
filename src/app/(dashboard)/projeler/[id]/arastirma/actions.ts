'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { success: false; error: string }

export type SectionKey =
  | 'market_structures'
  | 'competitor_strengths'
  | 'competitor_weaknesses'
  | 'quick_wins'
  | 'high_value_opportunities'

export async function upsertSection(
  projectId: string,
  section: SectionKey,
  rows: Record<string, string>[]
): Promise<ActionResult> {
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

  const { error } = await supabase.from('research_reports').upsert(
    {
      user_id: user.id,
      project_id: projectId,
      section,
      rows,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,section' }
  )

  if (error) return { success: false, error: 'Kayıt sırasında hata oluştu.' }

  revalidatePath(`/projeler/${projectId}/arastirma`)
  return { success: true }
}

export async function deleteRow(
  projectId: string,
  section: SectionKey,
  rowIndex: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: report } = await supabase
    .from('research_reports')
    .select('id, rows')
    .eq('project_id', projectId)
    .eq('section', section)
    .eq('user_id', user.id)
    .single()

  if (!report) return { success: false, error: 'Bölüm bulunamadı.' }

  const currentRows = (report.rows as Record<string, string>[]) ?? []
  const updatedRows = currentRows.filter((_, i) => i !== rowIndex)

  const { error } = await supabase
    .from('research_reports')
    .update({ rows: updatedRows, updated_at: new Date().toISOString() })
    .eq('id', report.id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Silme sırasında hata oluştu.' }

  revalidatePath(`/projeler/${projectId}/arastirma`)
  return { success: true }
}
