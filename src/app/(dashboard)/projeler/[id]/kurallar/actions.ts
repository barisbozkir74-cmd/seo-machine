'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ToggleProjectRuleResult =
  | { success: true }
  | { success: false; error: string }

export async function toggleProjectRule(
  projectId: string,
  ruleKey: string,
  newValue: boolean
): Promise<ToggleProjectRuleResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // Proje ownership kontrolü (D-08: inheritance modeli — proje yoksa global geçerli)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  // UPSERT — override varsa güncelle, yoksa ekle (D-08: sadece override yapıldığında yazılır)
  const { error } = await supabase.from('rules').upsert(
    {
      user_id: user.id,
      project_id: projectId,
      scope: 'project',
      rule_key: ruleKey,
      rule_value: String(newValue),
    },
    { onConflict: 'user_id,project_id,rule_key,scope' }
  )

  if (error) {
    return { success: false, error: 'Kural güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/kurallar`)
  return { success: true }
}

export async function resetProjectRule(
  projectId: string,
  ruleKey: string
): Promise<ToggleProjectRuleResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  // Ownership check — kullanıcının projesi olduğunu doğrula
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return { success: false, error: 'Proje bulunamadı.' }
  }

  const { error } = await supabase
    .from('rules')
    .delete()
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .eq('rule_key', ruleKey)
    .eq('scope', 'project')

  if (error) {
    return { success: false, error: 'Kural sıfırlanamadı. Lütfen tekrar deneyin.' }
  }

  revalidatePath(`/projeler/${projectId}/kurallar`)
  return { success: true }
}
