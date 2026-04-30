import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecoveryTaskStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'dismissed'

export type RecoveryTaskSource = 'page_package' | 'imported_page'

export type RecoveryTaskRow = {
  id: string
  projectId: string
  source: RecoveryTaskSource
  sourceId: string
  title: string
  pageUrl: string
  positionBefore: number | null
  positionAfter: number | null
  detectedAt: string
  status: RecoveryTaskStatus
  createdAt: string
}

// ---------------------------------------------------------------------------
// getRecoveryTasks
// ---------------------------------------------------------------------------

/**
 * Reads recovery_tasks for a project. RLS guarantees the caller only sees rows
 * for projects they own (Plan 16-01 SELECT policy).
 *
 * @param supabase     Server-side Supabase client (cookie-bound — auth context required)
 * @param projectId    Project to filter by
 * @param includesDismissed When false (default), excludes status IN ('resolved','dismissed').
 *                          When true, excludes only 'resolved'. The izleme tab uses this
 *                          to honor the "Dismissed görevleri göster" toggle (D-13, UI-SPEC).
 *
 * Sort: detected_at DESC (newest decay first). Mirrors the established
 * page-metrics convention of "most actionable first".
 */
export async function getRecoveryTasks(
  supabase: SupabaseClient,
  projectId: string,
  includesDismissed = false,
): Promise<RecoveryTaskRow[]> {
  let query = supabase
    .from('recovery_tasks')
    .select(
      'id, project_id, source, source_id, title, page_url, position_before, position_after, detected_at, status, created_at',
    )
    .eq('project_id', projectId)
    .neq('status', 'resolved')
    .order('detected_at', { ascending: false })

  if (!includesDismissed) {
    query = query.neq('status', 'dismissed')
  }

  const { data } = await query

  type Raw = {
    id: string
    project_id: string
    source: RecoveryTaskSource
    source_id: string
    title: string
    page_url: string
    position_before: number | null
    position_after: number | null
    detected_at: string
    status: RecoveryTaskStatus
    created_at: string
  }

  const rows: Raw[] = data ?? []

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    pageUrl: row.page_url,
    positionBefore: row.position_before,
    positionAfter: row.position_after,
    detectedAt: row.detected_at,
    status: row.status,
    createdAt: row.created_at,
  }))
}
