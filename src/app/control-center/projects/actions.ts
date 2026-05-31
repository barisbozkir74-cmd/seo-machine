'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function deleteProject(
  projectId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isValidUUID(projectId)) {
    return { success: false, error: 'Geçersiz proje ID formatı.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Oturum açmanız gerekiyor.' }
  }

  // Ownership check
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !project) {
    return { success: false, error: 'Proje bulunamadı veya yetkiniz yok.' }
  }

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (deleteError) {
    return { success: false, error: 'Proje silinemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath('/control-center/projects')
  return { success: true }
}
