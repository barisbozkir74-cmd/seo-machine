'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
  const { error: completeError } = await supabase
    .from('stages')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', currentStageId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (completeError) {
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

  revalidatePath(`/dashboard/projeler/${projectId}`)
  return { success: true, isLastStage }
}
