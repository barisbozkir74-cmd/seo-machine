'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ToggleRuleResult =
  | { success: true }
  | { success: false; error: string }

// D-01 kural seed verisi — 12 boolean kural, 4 kategori
const GLOBAL_RULES_SEED = [
  // SEO Title
  { rule_key: 'title_starts_with_keyword', rule_value: 'true' },
  { rule_key: 'title_max_length_enforced', rule_value: 'true' },
  { rule_key: 'title_includes_brand', rule_value: 'false' },
  // H1
  { rule_key: 'h1_exact_match', rule_value: 'false' },
  { rule_key: 'h1_single_per_page', rule_value: 'true' },
  { rule_key: 'h1_includes_keyword', rule_value: 'true' },
  // Slug
  { rule_key: 'slug_exact_match', rule_value: 'false' },
  { rule_key: 'slug_lowercase_hyphen', rule_value: 'true' },
  { rule_key: 'slug_no_stopwords', rule_value: 'false' },
  // Meta Description
  { rule_key: 'meta_desc_required', rule_value: 'true' },
  { rule_key: 'meta_desc_includes_keyword', rule_value: 'true' },
  { rule_key: 'meta_desc_length_enforced', rule_value: 'true' },
] as const

export async function seedGlobalRules(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('rules').upsert(
    GLOBAL_RULES_SEED.map((rule) => ({
      user_id: user.id,
      project_id: null,
      scope: 'global' as const,
      rule_key: rule.rule_key,
      rule_value: rule.rule_value,
    })),
    { onConflict: 'user_id,rule_key,scope' }
  )
}

export async function toggleRule(
  ruleKey: string,
  newValue: boolean
): Promise<ToggleRuleResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Oturum bulunamadı.' }
  }

  const { error } = await supabase
    .from('rules')
    .update({ rule_value: String(newValue) })
    .eq('rule_key', ruleKey)
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)

  if (error) {
    return { success: false, error: 'Kural güncellenemedi. Lütfen tekrar deneyin.' }
  }

  revalidatePath('/ayarlar/kurallar')
  return { success: true }
}
