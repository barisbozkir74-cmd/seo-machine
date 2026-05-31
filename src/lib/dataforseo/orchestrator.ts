import 'server-only'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import {
  type TaskSpec,
  type CacheResult,
  type SkipReason,
  ENDPOINT_TTL,
  DAILY_BUDGET_UNITS,
} from './types'

const RUNNING_TIMEOUT_MS = 5 * 60 * 1000    // 5 dakika — sonrası takılmış sayılır
const BACKOFF_WINDOW_MS  = 60 * 60 * 1000   // 1 saat
const BACKOFF_THRESHOLD  = 3                // bu kadar ardışık error → backoff

// ─── Hata dili ────────────────────────────────────────────────────────────────

export function humanizeApiError(raw: string): string {
  if (/402/.test(raw))
    return 'DataForSEO hesap bakiyesi yetersiz veya bu endpoint plan kapsamında değil. Hesabınızı kontrol edin.'
  if (/401/.test(raw) || /unauthorized/i.test(raw))
    return 'DataForSEO kimlik doğrulama başarısız — API anahtarlarınızı kontrol edin.'
  if (/429/.test(raw) || /rate.?limit/i.test(raw))
    return 'DataForSEO istek sınırına ulaşıldı — birkaç dakika bekleyip tekrar deneyin.'
  if (/50[0-9]/.test(raw))
    return 'DataForSEO sunucusunda geçici sorun — kısa süre sonra tekrar deneyin.'
  if (/vault|api.?key|credential/i.test(raw))
    return 'DataForSEO API anahtarları bulunamadı — proje ayarlarından ekleyin.'
  return raw
}

function extractErrorCode(raw: string): string {
  const m = raw.match(/\b(40[0-9]|50[0-9])\b/)
  return m ? m[1] : 'UNKNOWN'
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────
// Format: {endpoint}:{target_value}:{location_code}:{language_code}:{params_hash}
// Deterministik: domain → www. strip + lowercase, keywords → sort + normalize + hash

export function makeFingerprint(spec: TaskSpec): string {
  let targetValue: string

  if (spec.target.type === 'domain') {
    targetValue = spec.target.value.toLowerCase().replace(/^www\./, '').trim()
  } else if (spec.target.type === 'keyword') {
    targetValue = spec.target.value.toLowerCase().trim()
  } else {
    const normalised = spec.target.value
      .map(k => k.toLowerCase().trim())
      .filter(Boolean)
      .sort()
      .join('|')
    targetValue = crypto.createHash('sha256').update(normalised).digest('hex').slice(0, 16)
  }

  const paramsHash = spec.params
    ? crypto
        .createHash('sha256')
        .update(JSON.stringify(spec.params, Object.keys(spec.params).sort()))
        .digest('hex')
        .slice(0, 8)
    : 'default'

  return [spec.endpoint, targetValue, spec.locationCode, spec.languageCode, paramsHash].join(':')
}

// ─── Freshness ────────────────────────────────────────────────────────────────

export function isStale(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt) < new Date()
}

export function computeFreshnessLabel(
  expiresAt: string,
  ttlSeconds: number,
): 'fresh' | 'aging' | 'stale' {
  if (isStale(expiresAt)) return 'stale'
  const remaining = new Date(expiresAt).getTime() - Date.now()
  return remaining > (ttlSeconds * 1000) / 2 ? 'fresh' : 'aging'
}

// ─── Guard fonksiyonları ──────────────────────────────────────────────────────

async function checkBudget(projectId: string): Promise<boolean> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('dataforseo_task_cache')
    .select('cost_units')
    .eq('project_id', projectId)
    .eq('status', 'done')
    .gte('created_at', since)

  const total = (data ?? []).reduce((sum, r) => sum + (r.cost_units ?? 0), 0)
  return total < DAILY_BUDGET_UNITS
}

async function isInBackoff(projectId: string, fingerprint: string): Promise<boolean> {
  const supabase = await createClient()
  const since = new Date(Date.now() - BACKOFF_WINDOW_MS).toISOString()

  const { data } = await supabase
    .from('dataforseo_task_cache')
    .select('retry_count, updated_at')
    .eq('project_id', projectId)
    .eq('fingerprint', fingerprint)
    .eq('status', 'error')
    .maybeSingle()

  if (!data) return false
  return data.updated_at > since && (data.retry_count ?? 0) >= BACKOFF_THRESHOLD
}

async function isAlreadyRunning(projectId: string, fingerprint: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('dataforseo_task_cache')
    .select('updated_at')
    .eq('project_id', projectId)
    .eq('fingerprint', fingerprint)
    .eq('status', 'running')
    .maybeSingle()

  if (!data) return false
  return Date.now() - new Date(data.updated_at).getTime() < RUNNING_TIMEOUT_MS
}

// ─── Ana orchestrator fonksiyonu ──────────────────────────────────────────────
//
// Lifecycle (spec'e birebir):
//  [1] fingerprint hesapla
//  [2] budget guard    (forceRefresh'te atla)
//  [3] backoff guard   (forceRefresh'te atla)
//  [4] running guard
//  [5] cache hit       (forceRefresh'te atla)
//  [6] upsert running
//  [7] API çağrısı
//  [8] normalize
//  [9] done yaz
// [10] dön

export async function fetchWithCache<T>(opts: {
  projectId:    string
  userId:       string
  spec:         TaskSpec
  fetcher:      () => Promise<T>
  normalizer?:  (raw: T) => unknown
  forceRefresh?: boolean
}): Promise<CacheResult<T>> {
  const {
    projectId, userId, spec,
    fetcher,
    normalizer = (r: T) => r,
    forceRefresh = false,
  } = opts

  const supabase    = await createClient()
  const fingerprint = makeFingerprint(spec)
  const ttl         = ENDPOINT_TTL[spec.endpoint]

  // Depolama için target_value (okunabilir, fingerprint'teki hash değil)
  const storedTargetValue =
    spec.target.type === 'domain'
      ? spec.target.value.toLowerCase().replace(/^www\./, '').trim()
      : spec.target.type === 'keyword'
        ? spec.target.value.toLowerCase().trim()
        : `[${(spec.target.value as string[]).length} keywords]`

  // UPSERT'lerde tekrarlanan base alanlar
  const baseRow = {
    project_id:      projectId,
    user_id:         userId,
    module:          spec.module,
    endpoint:        spec.endpoint,
    target_type:     spec.target.type,
    target_value:    storedTargetValue,
    fingerprint,
    request_payload: (spec.params ?? {}) as Record<string, unknown>,
    source:          forceRefresh ? 'force_refresh' : 'user',
  }

  async function writeSkipped(reason: SkipReason) {
    await supabase.from('dataforseo_task_cache').upsert(
      { ...baseRow, status: 'skipped', error_code: reason, updated_at: new Date().toISOString() },
      { onConflict: 'project_id,fingerprint' },
    )
  }

  // ── [2] BUDGET ────────────────────────────────────────────────────
  if (!forceRefresh) {
    const withinBudget = await checkBudget(projectId)
    if (!withinBudget) {
      await writeSkipped('BUDGET_EXCEEDED')
      return { data: null, fromCache: false, skipped: true, reason: 'BUDGET_EXCEEDED' }
    }
  }

  // ── [3] BACKOFF ───────────────────────────────────────────────────
  if (!forceRefresh) {
    if (await isInBackoff(projectId, fingerprint)) {
      await writeSkipped('BACKOFF')
      return { data: null, fromCache: false, skipped: true, reason: 'BACKOFF' }
    }
  }

  // ── [4] RUNNING GUARD ─────────────────────────────────────────────
  if (await isAlreadyRunning(projectId, fingerprint)) {
    return { data: null, fromCache: false, skipped: true, reason: 'ALREADY_RUNNING' }
  }

  // ── [5] CACHE HIT ─────────────────────────────────────────────────
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('dataforseo_task_cache')
      .select('result, expires_at')
      .eq('project_id', projectId)
      .eq('fingerprint', fingerprint)
      .eq('status', 'done')
      .maybeSingle()

    if (cached?.result && !isStale(cached.expires_at)) {
      return { data: cached.result as T, fromCache: true, skipped: false }
    }
  }

  // ── [6] UPSERT RUNNING ────────────────────────────────────────────
  await supabase.from('dataforseo_task_cache').upsert(
    {
      ...baseRow,
      status:        'running',
      result:        null,
      error_code:    null,
      error_message: null,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: 'project_id,fingerprint' },
  )

  // ── [7] API ÇAĞRISI ───────────────────────────────────────────────
  let raw: T
  try {
    raw = await fetcher()
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Bilinmeyen hata'

    // retry_count için mevcut değeri oku (Phase 1: select-then-update, race condition kabul edilebilir)
    const { data: currentRow } = await supabase
      .from('dataforseo_task_cache')
      .select('retry_count')
      .eq('project_id', projectId)
      .eq('fingerprint', fingerprint)
      .maybeSingle()

    await supabase
      .from('dataforseo_task_cache')
      .update({
        status:        'error',
        error_code:    extractErrorCode(rawMsg),
        error_message: humanizeApiError(rawMsg),
        retry_count:   (currentRow?.retry_count ?? 0) + 1,
        updated_at:    new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('fingerprint', fingerprint)

    throw new Error(humanizeApiError(rawMsg))
  }

  // ── [8] NORMALIZE (Phase 1: identity) ────────────────────────────
  const processed = normalizer(raw)

  // ── [9] DONE YAZ ─────────────────────────────────────────────────
  const now       = new Date()
  const expiresAt = ttl > 0
    ? new Date(now.getTime() + ttl * 1000).toISOString()
    : null
  const freshLabel = expiresAt
    ? computeFreshnessLabel(expiresAt, ttl)
    : null

  await supabase
    .from('dataforseo_task_cache')
    .update({
      status:          'done',
      result:          processed as Record<string, unknown>,
      error_code:      null,
      error_message:   null,
      cost_units:      null,     // live endpoint cost döndürmez; Phase 3'te doldurulur
      fetched_at:      now.toISOString(),
      expires_at:      expiresAt,
      freshness_label: freshLabel,
      retry_count:     0,        // başarı → sıfırla
      updated_at:      now.toISOString(),
    })
    .eq('project_id', projectId)
    .eq('fingerprint', fingerprint)

  // ── [10] DÖN ─────────────────────────────────────────────────────
  return { data: raw, fromCache: false, skipped: false }
}
