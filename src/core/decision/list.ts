import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordAuditEntry } from '@/core/audit/trail'
import type { LockedDecision } from './locking-engine'

type PaginatedResult<T> = {
  items:        T[]
  has_more:     boolean
  next_cursor?: string
}

export type DecisionListFilters = {
  lifecycle_status?: 'active' | 'locked' | 'superseded' | 'draft' | 'all'
  limit?:            number
  cursor?:           string
}

// SELECT_FIELDS includes lifecycle columns added in migration 20260607000001.
// If those columns are absent (pre-migration environment), the query fails and
// we fall back to SELECT_FIELDS_SAFE which only selects the original columns,
// then synthesises safe defaults so the page always renders real data.
const SELECT_FIELDS =
  'id, project_id, section, decision_type, decision, reason, scope_type, entity_type, is_active, lifecycle_status, locked_at, locked_by, lock_reason, created_at'

const SELECT_FIELDS_SAFE =
  'id, project_id, section, decision_type, decision, reason, scope_type, entity_type, is_active, created_at'

function applyDefaults(raw: Record<string, unknown>): LockedDecision {
  return {
    id:               raw.id as string,
    project_id:       raw.project_id as string,
    section:          (raw.section as string | null) ?? null,
    decision_type:    raw.decision_type as string,
    decision:         raw.decision as string,
    reason:           (raw.reason as string | null) ?? null,
    scope_type:       (raw.scope_type as string) ?? 'project',
    entity_type:      (raw.entity_type as string | null) ?? null,
    is_active:        raw.is_active as boolean,
    lifecycle_status: (raw.lifecycle_status as LockedDecision['lifecycle_status']) ?? 'active',
    locked_at:        (raw.locked_at as string | null) ?? null,
    locked_by:        (raw.locked_by as string | null) ?? null,
    lock_reason:      (raw.lock_reason as string | null) ?? null,
    created_at:       raw.created_at as string,
  }
}

export async function listDecisions(
  supabase: SupabaseClient,
  projectId: string,
  filters: DecisionListFilters = {}
): Promise<PaginatedResult<LockedDecision>> {
  const { lifecycle_status, limit = 50, cursor } = filters
  const clampedLimit = Math.min(Math.max(1, limit), 100)
  const empty: PaginatedResult<LockedDecision> = { items: [], has_more: false }

  const buildQuery = (fields: string) => {
    let q = supabase
      .from('project_decisions')
      .select(fields)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(clampedLimit)
    if (cursor) q = q.lt('created_at', cursor)
    // Only apply lifecycle_status filter when using the full select (column exists)
    if (fields === SELECT_FIELDS && lifecycle_status && lifecycle_status !== 'all') {
      q = q.eq('lifecycle_status', lifecycle_status)
    }
    return q
  }

  try {
    // First attempt: full select with lifecycle columns
    const { data, error } = await buildQuery(SELECT_FIELDS)

    if (error) {
      // Column missing — fall back to safe select without lifecycle columns
      const { data: safeData, error: safeError } = await buildQuery(SELECT_FIELDS_SAFE)
      if (safeError || !safeData) return empty

      // Client-side filter for lifecycle_status when the column doesn't exist yet
      // All existing rows are implicitly 'active', so only 'all' / 'active' yield results
      const shouldFilter = lifecycle_status && lifecycle_status !== 'all' && lifecycle_status !== 'active'
      const rows = shouldFilter ? [] : safeData

      const items = (rows as unknown as Record<string, unknown>[]).map(applyDefaults)
      const has_more = items.length === clampedLimit
      const result: PaginatedResult<LockedDecision> = { items, has_more }
      if (has_more) result.next_cursor = items[items.length - 1].created_at
      return result
    }

    if (!data) return empty
    const items = (data as unknown as Record<string, unknown>[]).map(applyDefaults)
    const has_more = items.length === clampedLimit
    const result: PaginatedResult<LockedDecision> = { items, has_more }
    if (has_more) result.next_cursor = items[items.length - 1].created_at
    return result
  } catch {
    return empty
  }
}

export async function deactivateDecision(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  decisionId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: existing, error: fetchError } = await supabase
    .from('project_decisions')
    .select('id, is_active')
    .eq('id', decisionId)
    .eq('project_id', projectId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'Karar bulunamadı' }
  }

  if (!existing.is_active) {
    return { success: false, error: 'Karar zaten pasif' }
  }

  const { error: updateError } = await supabase
    .from('project_decisions')
    .update({ is_active: false })
    .eq('id', decisionId)
    .eq('project_id', projectId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await recordAuditEntry(supabase, {
    project_id:    projectId,
    user_id:       userId,
    actor_type:    'human',
    actor_id:      userId,
    action_type:   'decision_deactivated',
    resource_type: 'decision',
    resource_id:   decisionId,
  })

  return { success: true }
}
