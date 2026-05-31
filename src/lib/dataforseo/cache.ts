/**
 * DataForSEO Cache Service — Phase 24
 *
 * getCachedOrFetch: fetchWithCache() orchestrator'ının ince ergonomi wrapper'ı.
 * Tüm guard mantığı (budget, backoff, running guard, TTL) fetchWithCache'de.
 * cache.ts yalnızca tip dönüşümü + null normalizasyonu yapar.
 *
 * DFS-01: Cache deposu dataforseo_task_cache tablosudur (20260522000001 migration).
 * keyword_data_cache adında ayrı tablo AÇILMAZ — bu tablonun DFS-01'i karşıladığı kabul edilir.
 */
import 'server-only'

import { fetchWithCache } from './orchestrator'
import type { TaskSpec } from './types'

export type CachedFetchResult<T> = {
  data: T
  fromCache: boolean
}

/**
 * Cache-first DataForSEO çağrısı.
 * - Cache HIT: dataforseo_task_cache'den döner, fromCache: true
 * - Cache MISS: fetcher() çağrılır, cache'e yazılır, fromCache: false
 * - SKIPPED (budget/backoff/running): null döner — çağıran hata göstermeli
 */
export async function getCachedOrFetch<T>(opts: {
  projectId: string
  userId: string
  spec: TaskSpec
  fetcher: () => Promise<T>
}): Promise<CachedFetchResult<T> | null> {
  const result = await fetchWithCache<T>({ ...opts })
  if (result.skipped) return null
  return { data: result.data as T, fromCache: result.fromCache }
}
