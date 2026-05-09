'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataForSeoCredentials } from '@/lib/supabase/vault'
import { fetchKeywordData, fetchRelatedKeywords } from '@/lib/dataforseo/client'
import { parseKeywordText } from '@/lib/keywords/parser'
import { clusterKeywords, clusterKeywordsWithAI } from '@/lib/keywords/clustering'
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
  // WR-03: count bir kez sorgulanır, hem niche-score hem cluster-silme kararında reuse edilir
  if (kw.cluster_id) {
    const { count: remaining } = await supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', kw.cluster_id)
    const remainingCount = remaining ?? 0

    if (remainingCount > 0) {
      // WR-02: allClusterVolumes, total_volume snapshot'ına değil live keyword volume toplamlarına dayanır
      const { data: allKwLive } = await supabase
        .from('keywords')
        .select('cluster_id, volume, cpc')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
      // Cluster başına volume toplamı
      const volumeByCluster = new Map<string, number>()
      for (const row of allKwLive ?? []) {
        if (!row.cluster_id) continue
        volumeByCluster.set(row.cluster_id, (volumeByCluster.get(row.cluster_id) ?? 0) + (row.volume ?? 0))
      }
      const allClusterVolumes = Array.from(volumeByCluster.values())

      // WR-01: maxCpc proje genelinden hesaplanmalı
      const maxProjectCpcDelete = Math.max(...(allKwLive ?? []).map((k) => k.cpc ?? 0), 0)

      await recalculateClusterNicheScore(kw.cluster_id, user.id, supabase, allClusterVolumes, maxProjectCpcDelete)
    } else {
      // Kümedeki son keyword silindi — kümeyi de kaldır (D-12 interaction contract)
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

// ─── Add Single Keyword ───────────────────────────────────────────────────────

export type AddKeywordResult =
  | { success: true }
  | { success: false; error: string }

export async function addKeyword(
  projectId: string,
  keywordText: string,
  clusterId: string | null,
  newClusterName: string | null
): Promise<AddKeywordResult> {
  const text = keywordText.trim()
  if (!text) return { success: false, error: 'Keyword boş olamaz.' }

  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(projectId)) return { success: false, error: 'Geçersiz proje ID.' }

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

  // Yeni küme oluştur (istenirse)
  let resolvedClusterId: string | null = clusterId
  if (newClusterName?.trim()) {
    const { data: newCluster, error: clusterErr } = await supabase
      .from('keyword_clusters')
      .upsert(
        { user_id: user.id, project_id: projectId, cluster_name: newClusterName.trim(), total_volume: 0 },
        { onConflict: 'project_id,cluster_name', ignoreDuplicates: false }
      )
      .select('id')
      .single()
    if (clusterErr || !newCluster) return { success: false, error: 'Küme oluşturulamadı.' }
    resolvedClusterId = newCluster.id
  }

  // Keyword ekle
  const { error: kwErr } = await supabase
    .from('keywords')
    .upsert(
      { user_id: user.id, project_id: projectId, keyword: text, source: 'manual', cluster_id: resolvedClusterId },
      { onConflict: 'project_id,keyword', ignoreDuplicates: false }
    )
  if (kwErr) return { success: false, error: 'Keyword eklenemedi.' }

  // Sessiz enrichment
  try {
    const credentials = await getDataForSeoCredentials()
    const enriched = await fetchKeywordData([text], credentials)
    if (enriched[0]) {
      const item = enriched[0]
      const payload: Record<string, unknown> = { enriched_at: new Date().toISOString() }
      if (item.search_volume !== null) payload.volume = item.search_volume
      if (item.cpc !== null) payload.cpc = item.cpc
      if (item.keyword_difficulty !== null) payload.difficulty = item.keyword_difficulty
      if (item.search_intent !== null) payload.search_intent = item.search_intent
      await supabase.from('keywords').update(payload).eq('project_id', projectId).eq('keyword', text)
    }
  } catch { /* sessiz fail */ }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

// ─── Phase 6: Clustering & Scoring Actions ───────────────────────────────────

export type ClusterAndScoreResult =
  | { success: true; clusterCount: number; clusters: DraftCluster[] }
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

  // D-05: Approved cluster'ların ID'lerini topla — bunlara dokunulmayacak
  const { data: approvedClusters } = await supabase
    .from('keyword_clusters')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'approved')

  const approvedClusterIds = (approvedClusters ?? []).map((c) => c.id)

  // Eski draft cluster'ları sil (D-05: approved olanlar korunur — Pitfall 2: upsert conflict önlemi)
  await supabase
    .from('keyword_clusters')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('status', 'draft')

  // Enriched keywords'ü çek (Pitfall 1: enriched_at IS NOT NULL filtresi)
  // cluster_id dahil edildi — approved cluster filtresi için
  const { data: keywordsRaw } = await supabase
    .from('keywords')
    .select('id, keyword, volume, cpc, difficulty, search_intent, cluster_id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .not('enriched_at', 'is', null)

  // D-05: Sadece approved cluster'da olmayan keyword'leri kümelendirmeye al
  const keywords = (keywordsRaw ?? []).filter(
    (kw) => !kw.cluster_id || !approvedClusterIds.includes(kw.cluster_id)
  )

  if (keywords.length === 0) {
    return { success: false, error: 'Kümelenecek keyword bulunamadı. Önce zenginleştirme çalıştırın.' }
  }

  // DoS guard: 500+ keyword için uyarı döndür
  if (keywords.length > 500) {
    return { success: false, error: `Proje çok fazla keyword içeriyor (${keywords.length}). Kümeleme 500 keyword ile sınırlıdır.` }
  }

  // AI semantic clustering
  const clusters = await clusterKeywordsWithAI(keywords)

  // Opportunity score context (batch normalizasyon için max değerler)
  const scoringCtx = buildScoringContext(keywords)

  let clusterCount = 0
  const draftClusters: DraftCluster[] = []

  for (const cluster of clusters) {
    // INSERT (upsert değil — Pitfall 2: approved cluster üzerine yazma önlemi)
    // status: 'draft' — D-08: AI önerisi her zaman draft başlar
    const { data: clusterRow, error: clusterErr } = await supabase
      .from('keyword_clusters')
      .insert({
        user_id: user.id,
        project_id: projectId,
        cluster_name: cluster.name,
        total_volume: cluster.totalVolume,
        intent: cluster.intent,
        status: 'draft',
      })
      .select('id')
      .single()

    if (clusterErr || !clusterRow) continue
    clusterCount++

    // DraftCluster listesi için kaydet (D-08: overlay'e data aktarımı)
    draftClusters.push({
      id: clusterRow.id,
      cluster_name: cluster.name,
      intent: cluster.intent ?? null,
      total_volume: cluster.totalVolume,
      status: 'draft',
      keywords: cluster.keywords.map((kw) => ({
        id: kw.id,
        keyword: kw.keyword,
        volume: kw.volume ?? null,
      })),
    })

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

  // WR-01: maxCpc proje genelinden hesaplanmalı, cluster'a özel değil
  const { data: allKwForCpc } = await supabase
    .from('keywords')
    .select('cpc')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  const maxProjectCpc = Math.max(...(allKwForCpc ?? []).map((k) => k.cpc ?? 0), 0)

  await Promise.all(
    (allClusterRows ?? []).map((cluster) =>
      recalculateClusterNicheScore(cluster.id, user.id, supabase, allClusterVolumes, maxProjectCpc)
    )
  )

  // revalidatePath KALDIRILDI — overlay kapandıktan sonra approveStrategy veya router.refresh() tetikler
  return { success: true, clusterCount, clusters: draftClusters }
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

  // WR-01: maxCpc proje genelinden hesaplanmalı
  const { data: allKwForCpcMove } = await supabase
    .from('keywords')
    .select('cpc')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  const maxProjectCpcMove = Math.max(...(allKwForCpcMove ?? []).map((k) => k.cpc ?? 0), 0)

  // Eski cluster (keyword çıktı — Pitfall 2)
  if (kw.cluster_id && kw.cluster_id !== newClusterId) {
    await recalculateClusterNicheScore(kw.cluster_id, user.id, supabase, allClusterVolumes, maxProjectCpcMove)
  }
  // Yeni cluster
  await recalculateClusterNicheScore(newClusterId, user.id, supabase, allClusterVolumes, maxProjectCpcMove)

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

export type MoveToNewClusterResult = { success: true } | { success: false; error: string }

export async function moveKeywordToNewCluster(
  keywordId: string,
  newClusterName: string,
  projectId: string
): Promise<MoveToNewClusterResult> {
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(keywordId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }
  if (!newClusterName.trim()) return { success: false, error: 'Küme adı boş olamaz.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: clusterRow, error: clusterErr } = await supabase
    .from('keyword_clusters')
    .upsert(
      { user_id: user.id, project_id: projectId, cluster_name: newClusterName.trim(), total_volume: 0 },
      { onConflict: 'project_id,cluster_name', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (clusterErr || !clusterRow) return { success: false, error: 'Küme oluşturulamadı.' }

  return moveKeywordToCluster(keywordId, clusterRow.id, projectId)
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

export async function unsetPrimaryKeyword(
  clusterId: string,
  projectId: string,
): Promise<SetPrimaryKeywordResult> {
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(clusterId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('keyword_clusters')
    .update({ primary_keyword_id: null })
    .eq('id', clusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Primary kaldırma başarısız.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

// ─── Keyword yıldız toggle ────────────────────────────────────────────────────

export async function toggleKeywordStar(
  keywordId: string,
  projectId: string,
  starred: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(keywordId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { error } = await supabase
    .from('keywords')
    .update({ is_starred: starred })
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Yıldız güncellenemedi.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

// ─── Phase 17: Niche Score Recalculation Helper ──────────────────────────────

async function recalculateClusterNicheScore(
  clusterId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  allClusterVolumes: number[],
  maxProjectCpc: number
): Promise<void> {
  const { data: keywords } = await supabase
    .from('keywords')
    .select('volume, cpc, difficulty, search_intent')
    .eq('cluster_id', clusterId)
    .eq('user_id', userId)

  if (!keywords || keywords.length === 0) return

  const maxClusterVolume = Math.max(...allClusterVolumes, 0)
  const maxCpc = maxProjectCpc

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

export type FetchLongTailResult =
  | { success: true; count: number }
  | { success: false; error: string }

export async function fetchLongTailKeywords(
  keywordId: string,
  projectId: string
): Promise<FetchLongTailResult> {
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(keywordId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Keyword ownership doğrula
  const { data: kw } = await supabase
    .from('keywords')
    .select('id, keyword, cluster_id')
    .eq('id', keywordId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!kw) return { success: false, error: 'Keyword bulunamadı.' }

  // Mevcut uzun kuyrukları sil — taze veri çekilecek
  await supabase
    .from('keywords')
    .delete()
    .eq('parent_keyword_id', keywordId)
    .eq('user_id', user.id)

  let credentials: { login: string; password: string }
  try {
    credentials = await getDataForSeoCredentials()
  } catch {
    return { success: false, error: 'DataForSEO credentials bulunamadı.' }
  }

  let relatedItems
  try {
    relatedItems = await fetchRelatedKeywords([kw.keyword], credentials, undefined, { depth: 1, limit: 20 })
  } catch {
    return { success: false, error: 'DataForSEO API hatası.' }
  }

  if (relatedItems.length === 0) return { success: true, count: 0 }

  const rows = relatedItems
    .map((item) => {
      const kd = item.keyword_data
      const text = kd?.keyword
      if (!text) return null
      return {
        user_id: user.id,
        project_id: projectId,
        cluster_id: kw.cluster_id,
        parent_keyword_id: keywordId,
        keyword: text,
        volume: kd?.keyword_info?.search_volume ?? null,
        cpc: kd?.keyword_info?.cpc ?? null,
        source: 'expansion' as const,
      }
    })
    .filter(Boolean) as {
      user_id: string
      project_id: string
      cluster_id: string | null
      parent_keyword_id: string
      keyword: string
      volume: number | null
      cpc: number | null
      source: 'expansion'
    }[]

  if (rows.length === 0) return { success: true, count: 0 }

  const { error } = await supabase
    .from('keywords')
    .upsert(rows, { onConflict: 'project_id,keyword', ignoreDuplicates: true })

  if (error) return { success: false, error: 'Kayıt başarısız.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true, count: rows.length }
}

// ─── Phase 20: Clustering Approval Actions ────────────────────────────────────

export type UpdateClusterStatusResult =
  | { success: true }
  | { success: false; error: string }

const VALID_CLUSTER_STATUSES = ['draft', 'approved', 'rejected'] as const

export async function updateClusterStatus(
  clusterId: string,
  status: string,
  projectId: string
): Promise<UpdateClusterStatusResult> {
  // Whitelist kontrolü — T-20-02 (Tampering: geçersiz durum değeri enjeksiyonu)
  if (!VALID_CLUSTER_STATUSES.includes(status as typeof VALID_CLUSTER_STATUSES[number])) {
    return { success: false, error: 'Geçersiz durum değeri.' }
  }

  // UUID format validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(clusterId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership doğrula — T-20-01 (Tampering: başka projenin cluster'ına yazma)
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
    .update({ status })
    .eq('id', clusterId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Durum güncellenemedi.' }

  // revalidatePath YOK — overlay state korunur (Pitfall 3: overlay state sıfırlanmasın)
  return { success: true }
}

export async function approveStrategy(
  projectId: string,
  approved: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  // UUID format validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // Ownership doğrula — T-20-03 (Elevation of Privilege: başka kullanıcının projesini onaylama)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('projects')
    .update({ keyword_strategy_approved: approved })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Strateji onayı kaydedilemedi.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}

// DraftCluster: clusterAndScoreKeywords'ün overlay'e döneceği tip
export type DraftCluster = {
  id: string
  cluster_name: string
  intent: string | null
  total_volume: number
  status: 'draft'
  keywords: Array<{ id: string; keyword: string; volume: number | null }>
}

export type RemoveKeywordFromClusterResult =
  | { success: true }
  | { success: false; error: string }

export async function removeKeywordFromCluster(
  keywordId: string,
  clusterId: string,
  projectId: string
): Promise<RemoveKeywordFromClusterResult> {
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(keywordId) || !uuidRegex.test(clusterId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  // T-20-01: Cluster ownership check — IDOR önlemi
  const { data: clusterRow } = await supabase
    .from('keyword_clusters')
    .select('id')
    .eq('id', clusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!clusterRow) return { success: false, error: 'Küme bulunamadı.' }

  // keyword.cluster_id = null — havuza gönder (D-03)
  const { error: kwErr } = await supabase
    .from('keywords')
    .update({ cluster_id: null })
    .eq('id', keywordId)
    .eq('user_id', user.id)

  if (kwErr) return { success: false, error: 'Keyword kaldırılamadı.' }

  // Pitfall 7: total_volume güncelle — kalan keyword'lerin volume'unu topla
  const { data: remaining } = await supabase
    .from('keywords')
    .select('volume')
    .eq('cluster_id', clusterId)
    .eq('user_id', user.id)

  const newVolume = (remaining ?? []).reduce((sum, k) => sum + (k.volume ?? 0), 0)

  await supabase
    .from('keyword_clusters')
    .update({ total_volume: newVolume })
    .eq('id', clusterId)
    .eq('user_id', user.id)

  // revalidatePath YOK — overlay state korunur (Pitfall 3)
  // Not: Cluster boşalırsa silinmez — kullanıcı ayrıca reddeder (Pitfall 4)
  return { success: true }
}
