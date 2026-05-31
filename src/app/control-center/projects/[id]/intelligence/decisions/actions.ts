'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recordAuditEntry } from '@/core/audit/trail'

export async function reactivateDecision(
  decisionId: string,
  projectId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Yetkisiz işlem' }

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('project_decisions')
    .select('id, is_active, lifecycle_status')
    .eq('id', decisionId)
    .eq('project_id', projectId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Karar bulunamadı' }
  }

  if (existing.is_active) {
    return { success: false, error: 'Karar zaten aktif' }
  }

  const { error: updateError } = await supabase
    .from('project_decisions')
    .update({ is_active: true, lifecycle_status: 'active' })
    .eq('id', decisionId)
    .eq('project_id', projectId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await recordAuditEntry(supabase, {
    project_id:    projectId,
    user_id:       user.id,
    actor_type:    'human',
    actor_id:      user.id,
    action_type:   'decision_proposed',
    resource_type: 'decision',
    resource_id:   decisionId,
    reason:        'Kullanıcı tarafından yeniden aktif edildi',
  })

  revalidatePath(`/control-center/projects/${projectId}/intelligence/decisions`)
  return { success: true }
}
