import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * POST /api/dataforseo/deep-analysis/callback
 *
 * n8n deep analysis tamamlama callback'i — Phase 24 DFS-06
 *
 * n8n analizi tamamlayınca bu endpoint'i çağırır:
 * - workflow_runs satırını 'done' veya 'failed' yapar
 * - status='done' ise keywords.dfs_fetched_at günceller
 *
 * Body: {
 *   projectId: string
 *   userId: string
 *   workflowRunId: string
 *   status: 'done' | 'failed'
 *   keywordIds?: string[]
 *   error?: string
 *   result?: unknown
 * }
 */

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  // 1. Webhook secret check (T-24-05 — n8n spoofing önlemi)
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Body parse
  let body: {
    projectId?: string
    userId?: string
    workflowRunId?: string
    status?: 'done' | 'failed'
    keywordIds?: string[]
    error?: string
    result?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, userId, workflowRunId, status, keywordIds, result } = body

  if (!projectId || !userId || !workflowRunId || !status) {
    return NextResponse.json(
      { error: 'projectId, userId, workflowRunId, status required' },
      { status: 400 },
    )
  }

  if (!['done', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'status must be done or failed' }, { status: 400 })
  }

  // 3. UUID validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(projectId) || !uuidRegex.test(userId) || !uuidRegex.test(workflowRunId)) {
    return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 })
  }

  const serviceClient = getServiceClient()

  // 4. Ownership check (IDOR önlemi — T-24-01)
  const { data: project } = await serviceClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 5. workflow_runs UPDATE
  const now = new Date().toISOString()
  const { error: updateError } = await serviceClient
    .from('workflow_runs')
    .update({
      status,
      result_payload: result ?? null,
      error_message: status === 'failed' ? (body.error ?? null) : null,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', workflowRunId)
    .eq('project_id', projectId)

  if (updateError) {
    return NextResponse.json({ error: 'Workflow güncellenemedi.' }, { status: 500 })
  }

  // 6. dfs_fetched_at bulk update (DFS-07 — sadece status='done' ise)
  if (status === 'done' && Array.isArray(keywordIds) && keywordIds.length > 0) {
    await serviceClient
      .from('keywords')
      .update({ dfs_fetched_at: now })
      .in('id', keywordIds)
      .eq('project_id', projectId)
    // Hata non-fatal — workflow başarılı sayılır, sadece freshness güncellenmedi
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
