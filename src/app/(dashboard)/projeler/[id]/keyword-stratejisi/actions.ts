'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchKeywordData } from '@/lib/dataforseo/client'
import { parseKeywordText } from '@/lib/keywords/parser'
import { clusterKeywords, clusterEnrichedKeywords } from '@/lib/keywords/clustering'
import { calculateOpportunityScore, buildScoringContext } from '@/lib/keywords/scoring'
import { calculateNicheScore, classifyRevenueType } from '@/lib/keywords/niche-scoring'

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

  // Phase 17: Keyword silindi ama cluster hâlâ varsa niche skorunu güncelle
  if (kw.cluster_id) {
    const { count: remaining } = await supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', kw.cluster_id)
    if ((remaining ?? 0) > 0) {
      const { data: allClusters } = await supabase
        .from('keyword_clusters')
        .select('id, total_volume')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
      const allClusterVolumes = (allClusters ?? []).map((c) => c.total_volume ?? 0)
      await recalculateClusterNicheScore(kw.cluster_id, user.id, supabase, allClusterVolumes)
    }
  }

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

// ─── Phase 6: Clustering & Scoring Actions ───────────────────────────────────

export type ClusterAndScoreResult =
  | { success: true; clusterCount: number }
  | { success: false; error: string }

export async function clusterAndScoreKeywords(
  projectId: string
): Promise<ClusterAndScoreResult> {
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return { success: false, error: 'Geçersiz proje ID.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  // Enriched keywords'ü çek (Pitfall 1: enriched_at IS NOT NULL filtresi)
  const { data: keywordsRaw } = await supabase
    .from('keywords')
    .select('id, keyword, volume, cpc, difficulty, search_intent')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .not('enriched_at', 'is', null)

  const keywords = keywordsRaw ?? []

  if (keywords.length === 0) {
    return { success: false, error: 'Kümelenecek keyword bulunamadı. Önce zenginleştirme çalıştırın.' }
  }

  // DoS guard: 500+ keyword için uyarı döndür
  if (keywords.length > 500) {
    return { success: false, error: `Proje çok fazla keyword içeriyor (${keywords.length}). Kümeleme 500 keyword ile sınırlıdır.` }
  }

  // Intent-first hibrid clustering
  const clusters = clusterEnrichedKeywords(keywords)

  // Opportunity score context (batch normalizasyon için max değerler)
  const scoringCtx = buildScoringContext(keywords)

  let clusterCount = 0

  for (const cluster of clusters) {
    // keyword_clusters UPSERT — onConflict: project_id,cluster_name (Pitfall 3 önlemi: name "(intent)" suffix zaten içeriyor)
    const { data: clusterRow, error: clusterErr } = await supabase
      .from('keyword_clusters')
      .upsert(
        {
          user_id: user.id,
          project_id: projectId,
          cluster_name: cluster.name,
          total_volume: cluster.totalVolume,
          intent: cluster.intent,
        },
        { onConflict: 'project_id,cluster_name', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (clusterErr || !clusterRow) continue
    clusterCount++

    // Her keyword için opportunity_score hesapla ve cluster_id + score güncelle
    const updates = cluster.keywords.map((kw) => ({
      id: kw.id,
      cluster_id: clusterRow.id,
      opportunity_score: calculateOpportunityScore(kw, scoringCtx),
    }))

    // Toplu UPDATE — her keyword ayrı çağrı yerine Promise.all (Pitfall 4)
    await Promise.all(
      updates.map((u) =>
        supabase
          .from('keywords')
          .update({ cluster_id: u.cluster_id, opportunity_score: u.opportunity_score })
          .eq('id', u.id)
          .eq('user_id', user.id)
      )
    )

    // Primary keyword otomatik ata: cluster'ın ilk keyword'ü (en yüksek volume — clusterEnrichedKeywords sıralı döner)
    if (cluster.keywords.length > 0) {
      await supabase
        .from('keyword_clusters')
        .update({ primary_keyword_id: cluster.keywords[0].id })
        .eq('id', clusterRow.id)
        .eq('user_id', user.id)
    }
  }

  // Phase 17: Tüm cluster'lar için niche skoru batch hesaplama
  // Pitfall 3: Her cluster kendi max değerine göre normalize edilmemeli — proje geneli max kullanılır
  const { data: allClusterRows } = await supabase
    .from('keyword_clusters')
    .select('id, total_volume')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  const allClusterVolumes = (allClusterRows ?? []).map((c) => c.total_volume ?? 0)

  await Promise.all(
    (allClusterRows ?? []).map((cluster) =>
      recalculateClusterNicheScore(cluster.id, user.id, supabase, allClusterVolumes)
    )
  )

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true, clusterCount }
}

export type MoveKeywordResult = { success: true } | { success: false; error: string }

export async function moveKeywordToCluster(
  keywordId: string,
  newClusterId: string,
  projectId: string
): Promise<MoveKeywordResult> {
  // UUID format validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(keywordId) || !uuidRegex.test(newClusterId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Keyword ownership doğrula (Elevation of Privilege — T-06-01)
  const { data: kw } = await supabase
    .from('keywords')
    .select('id, cluster_id')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!kw) return { success: false, error: 'Keyword bulunamadı.' }

  // Hedef cluster'ın bu projeye ve user'a ait olduğunu doğrula (Elevation of Privilege)
  const { data: targetCluster } = await supabase
    .from('keyword_clusters')
    .select('id')
    .eq('id', newClusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!targetCluster) return { success: false, error: 'Hedef küme bulunamadı.' }

  // Pitfall 2: Keyword eski cluster'ın primary'si ise primary_keyword_id NULL yap
  if (kw.cluster_id) {
    await supabase
      .from('keyword_clusters')
      .update({ primary_keyword_id: null })
      .eq('id', kw.cluster_id)
      .eq('primary_keyword_id', keywordId)
      .eq('user_id', user.id)
  }

  // Keyword cluster_id UPDATE — eski cluster_id otomatik ezilir (cannibalization prevention)
  const { error } = await supabase
    .from('keywords')
    .update({ cluster_id: newClusterId })
    .eq('id', keywordId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Küme ataması başarısız.' }

  // Phase 17: Hem eski hem yeni cluster'ın niche skorunu güncelle
  // Normalizasyon için proje cluster volume'larını çek
  const { data: allClusters } = await supabase
    .from('keyword_clusters')
    .select('id, total_volume')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  const allClusterVolumes = (allClusters ?? []).map((c) => c.total_volume ?? 0)

  // Eski cluster (keyword çıktı — Pitfall 2)
  if (kw.cluster_id && kw.cluster_id !== newClusterId) {
    await recalculateClusterNicheScore(kw.cluster_id, user.id, supabase, allClusterVolumes)
  }
  // Yeni cluster
  await recalculateClusterNicheScore(newClusterId, user.id, supabase, allClusterVolumes)

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

export type SetPrimaryKeywordResult = { success: true } | { success: false; error: string }

export async function setPrimaryKeyword(
  clusterId: string,
  keywordId: string,
  projectId: string
): Promise<SetPrimaryKeywordResult> {
  // UUID format validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(clusterId) || !uuidRegex.test(keywordId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Tampering: keyword'ün bu cluster'a VE bu projeye VE bu user'a ait olduğunu doğrula (T-06-02)
  const { data: kw } = await supabase
    .from('keywords')
    .select('id, cluster_id, project_id')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!kw) return { success: false, error: 'Keyword bulunamadı.' }

  // Keyword bu cluster'ın üyesi mi? (başka projenin keyword UUID'si saldırısına karşı)
  if (kw.cluster_id !== clusterId) {
    return { success: false, error: 'Keyword bu kümenin üyesi değil.' }
  }

  const { error } = await supabase
    .from('keyword_clusters')
    .update({ primary_keyword_id: keywordId })
    .eq('id', clusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Primary atama başarısız.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

// ─── Phase 17: Niche Score Recalculation Helper ──────────────────────────────

async function recalculateClusterNicheScore(
  clusterId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  allClusterVolumes: number[]
): Promise<void> {
  const { data: keywords } = await supabase
    .from('keywords')
    .select('volume, cpc, difficulty, search_intent')
    .eq('cluster_id', clusterId)
    .eq('user_id', userId)

  if (!keywords || keywords.length === 0) return

  const maxClusterVolume = Math.max(...allClusterVolumes, 0)
  const maxCpc = Math.max(...keywords.map((k) => k.cpc ?? 0), 0)

  const nicheScore = calculateNicheScore(keywords, { maxClusterVolume, maxCpc })
  const revenueType = classifyRevenueType(keywords)

  await supabase
    .from('keyword_clusters')
    .update({ opportunity_score: nicheScore, revenue_type: revenueType })
    .eq('id', clusterId)
    .eq('user_id', userId)
}

// ─── Phase 17: Revenue Override Action ───────────────────────────────────────

export type UpdateClusterRevenueResult =
  | { success: true }
  | { success: false; error: string }

const VALID_REVENUE_TYPES = ['bilgi', 'mixed', 'ticari'] as const

export async function updateClusterRevenue(
  clusterId: string,
  revenueType: string,
  projectId: string
): Promise<UpdateClusterRevenueResult> {
  // Whitelist kontrolü — T-17-02 (Tampering: geçersiz değer enjeksiyonu)
  if (!VALID_REVENUE_TYPES.includes(revenueType as typeof VALID_REVENUE_TYPES[number])) {
    return { success: false, error: 'Geçersiz gelir tipi.' }
  }

  // UUID format validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(clusterId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership doğrula — T-17-01 (Tampering: başka projenin cluster'ına yazma)
  const { data: cluster } = await supabase
    .from('keyword_clusters')
    .select('id')
    .eq('id', clusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!cluster) return { success: false, error: 'Küme bulunamadı.' }

  const { error } = await supabase
    .from('keyword_clusters')
    .update({ revenue_type: revenueType })
    .eq('id', clusterId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Güncelleme başarısız.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}
