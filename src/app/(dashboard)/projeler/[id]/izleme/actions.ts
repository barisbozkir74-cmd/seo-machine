'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type RecoveryTaskActionResult =
  | { success: true }
  | { success: false; error: string }

/**
 * D-11, D-13, UI-SPEC §"Güncelle" / "Görmezden Gel" Click Flow.
 *
 * Updates a recovery task's status — invoked from RecoveryTaskTable.
 * - 'in_progress': user clicked Güncelle (also navigates client-side to editor)
 * - 'dismissed': user clicked Görmezden Gel (row removed from default view)
 *
 * Auth: session-bound. Ownership: project must belong to the calling user.
 * Race: re-checks ownership server-side even though RLS enforces it (defence-in-depth).
 *
 * 'open' and 'resolved' are NOT valid targets for this action — open is the seed
 * status set by detect route, resolved is set automatically by publishToWordPress.
 */
export async function updateRecoveryTaskStatus(
  taskId: string,
  projectId: string,
  status: 'in_progress' | 'dismissed',
): Promise<RecoveryTaskActionResult> {
  // Input validation — these should already be UUIDs from the typed prop chain,
  // but a defence-in-depth shape check costs nothing.
  if (!taskId || typeof taskId !== 'string') {
    return { success: false, error: 'Görev kimliği geçersiz.' }
  }
  if (!projectId || typeof projectId !== 'string') {
    return { success: false, error: 'Proje kimliği geçersiz.' }
  }
  if (status !== 'in_progress' && status !== 'dismissed') {
    return { success: false, error: 'Geçersiz durum.' }
  }

  const supabase = await createClient()

  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // 2. Ownership: verify the project belongs to this user
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // 3. Mutate. RLS UPDATE policy (Plan 16-01) re-checks ownership in addition.
  //    The .eq('project_id', projectId) ensures the task belongs to the verified project.
  const { error, data } = await supabase
    .from('recovery_tasks')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('project_id', projectId)
    // Only allow transitions from 'open' or 'in_progress' — never overwrite a resolved task
    .in('status', ['open', 'in_progress'])
    .select('id')

  if (error) {
    console.error('[updateRecoveryTaskStatus]', error.message)
    return { success: false, error: 'Görev güncellenemedi.' }
  }

  if (!data || data.length === 0) {
    // Task not found, not owned, or already in a terminal state (resolved)
    return { success: false, error: 'Görev güncellenemedi (bulunamadı veya zaten çözüldü).' }
  }

  revalidatePath(`/projeler/${projectId}/izleme`)
  return { success: true }
}
