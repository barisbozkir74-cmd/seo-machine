'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchKeywordData } from '@/lib/dataforseo/client'
import { parseKeywordText } from '@/lib/keywords/parser'
import { clusterKeywords } from '@/lib/keywords/clustering'

export type ImportKeywordsResult =
  | { success: true; clusterCount: number; keywordCount: number; enrichedCount: number }
  | { success: false; error: string }

export async function importKeywords(
  projectId: string,
  text: string
): Promise<ImportKeywordsResult> {
  if (!text?.trim()) return { success: false, error: 'Keyword listesi boş.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const parsed = parseKeywordText(text)
  if (parsed.length === 0) return { success: false, error: 'Hiç keyword bulunamadı. Format: keyword<tab>volume<tab>KD' }

  const clusters = clusterKeywords(parsed)

  // Insert clusters + keywords (upsert by keyword text to avoid duplicates)
  for (const cluster of clusters) {
    // Create/update cluster
    const { data: clusterRow, error: clusterErr } = await supabase
      .from('keyword_clusters')
      .upsert(
        {
          user_id: user.id,
          project_id: projectId,
          cluster_name: cluster.name,
          total_volume: cluster.totalVolume,
        },
        { onConflict: 'project_id,cluster_name', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (clusterErr || !clusterRow) continue

    // Insert keywords in this cluster
    const keywordRows = cluster.keywords.map((kw) => ({
      user_id: user.id,
      project_id: projectId,
      cluster_id: clusterRow.id,
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.kd,
      source: 'manual' as const,
    }))

    await supabase
      .from('keywords')
      .upsert(keywordRows, { onConflict: 'project_id,keyword', ignoreDuplicates: false })
  }

  // Enrichment — D-05: import sonrası otomatik başlar
  let enrichedCount = 0
  try {
    const credentials = await getDataForSeoCredentials()
    const keywordTexts = parsed.map((p) => p.keyword)
    const enriched = await fetchKeywordData(keywordTexts, credentials)

    for (const item of enriched) {
      if (!item.keyword) continue
      const updatePayload: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
      }
      // D-06: DataForSEO verisi manuel girilen değerlerin üstüne yazar
      if (item.search_volume !== null) updatePayload.volume = item.search_volume
      if (item.cpc !== null) updatePayload.cpc = item.cpc
      if (item.keyword_difficulty !== null) updatePayload.difficulty = item.keyword_difficulty
      if (item.search_intent !== null) updatePayload.search_intent = item.search_intent

      const { error: updateErr } = await supabase
        .from('keywords')
        .update(updatePayload)
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('keyword', item.keyword)
      if (!updateErr) enrichedCount++
    }
  } catch (err) {
    // Enrichment sessiz fail — import başarılı sayılır, satırlar enriched_at=null kalır (D-07)
    console.error('[importKeywords] enrichment failed:', err)
  }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true, clusterCount: clusters.length, keywordCount: parsed.length, enrichedCount }
}

export type DeleteClusterResult = { success: true } | { success: false; error: string }

export async function deleteCluster(
  projectId: string,
  clusterId: string
): Promise<DeleteClusterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Delete keywords in cluster first (cascade would handle it, but be explicit)
  await supabase
    .from('keywords')
    .update({ cluster_id: null })
    .eq('cluster_id', clusterId)
    .eq('user_id', user.id)

  const { error } = await supabase
    .from('keyword_clusters')
    .delete()
    .eq('id', clusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Küme silinemedi.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

export type DeleteKeywordResult = { success: true } | { success: false; error: string }

export async function deleteKeyword(
  keywordId: string,
  projectId: string
): Promise<DeleteKeywordResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership: keyword'ün bu projeye ve bu user'a ait olduğunu doğrula
  const { data: kw } = await supabase
    .from('keywords')
    .select('id, cluster_id')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!kw) return { success: false, error: 'Keyword bulunamadı.' }

  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', keywordId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Keyword silinemedi.' }

  // Kümedeki son keyword ise kümeyi de sil (D-12 interaction contract)
  if (kw.cluster_id) {
    const { count } = await supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', kw.cluster_id)
    if ((count ?? 0) === 0) {
      await supabase
        .from('keyword_clusters')
        .delete()
        .eq('id', kw.cluster_id)
        .eq('user_id', user.id)
    }
  }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}
