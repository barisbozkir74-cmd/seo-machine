import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * POST /api/dataforseo/deep-analysis
 *
 * Deep analysis n8n trigger endpoint — Phase 24 DFS-05
 *
 * Pattern: src/app/api/recovery/detect/route.ts kopyası (Phase 16)
 * - X-N8n-Webhook-Secret header auth
 * - Service role client (RLS bypass — anon key KULLANMA)
 * - Ownership check: projects.user_id
 * - workflow_runs INSERT (status='pending')
 * - n8n webhook POST
 *
 * Body: { projectId: string, userId: string, keywordIds?: string[] }
 * Response: { workflowRunId: string } | { error: string }
 */

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  // 1. Webhook secret auth (T-24-05 mitigation)
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Body parse
  let body: { projectId?: string; userId?: string; keywordIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, userId, keywordIds } = body
  if (!projectId || !userId) {
    return NextResponse.json(
      { error: 'projectId and userId required' },
      { status: 400 },
    )
  }

  // 3. UUID validation
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(projectId) || !uuidRegex.test(userId)) {
    return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 })
  }

  const serviceClient = getServiceClient()

  // 4. Ownership check (T-24-01 mitigation — IDOR önlemi)
  const { data: project } = await serviceClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // 5. DFS-08 Concurrent guard — aynı projede aktif deep analysis var mı?
  const { data: existingRun } = await serviceClient
    .from('workflow_runs')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('workflow_type', 'dfs_deep_analysis')
    .in('status', ['pending', 'running'])
    .maybeSingle()

  if (existingRun) {
    return NextResponse.json(
      { error: 'Analiz devam ediyor. Tamamlanmasını bekleyin.' },
      { status: 409 },
    )
  }

  // 6. workflow_runs INSERT (status='pending')
  const { data: workflowRun, error: insertError } = await serviceClient
    .from('workflow_runs')
    .insert({
      user_id: userId,
      project_id: projectId,
      workflow_type: 'dfs_deep_analysis',
      status: 'pending',
      input_payload: {
        keywordIds: keywordIds ?? [],
        analysisLevel: 'deep',
        triggeredAt: new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  if (insertError || !workflowRun) {
    return NextResponse.json({ error: 'Workflow kaydı oluşturulamadı.' }, { status: 500 })
  }

  // 7. n8n webhook tetikle (N8N_DEEP_ANALYSIS_WEBHOOK_URL env var)
  const n8nUrl = process.env.N8N_DEEP_ANALYSIS_WEBHOOK_URL
  if (n8nUrl) {
    try {
      await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8n-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify({
          projectId,
          userId,
          workflowRunId: workflowRun.id,
          keywordIds: keywordIds ?? [],
        }),
      })
    } catch {
      // n8n erişilemez — workflow_runs 'failed' yap
      await serviceClient
        .from('workflow_runs')
        .update({ status: 'failed', error_message: 'n8n webhook ulaşılamadı.' })
        .eq('id', workflowRun.id)
      return NextResponse.json({ error: 'n8n webhook tetiklenemedi.' }, { status: 502 })
    }
  }
  // N8N_DEEP_ANALYSIS_WEBHOOK_URL yoksa workflow_runs 'pending'te kalır (n8n kurulmamış ortam)

  return NextResponse.json({ workflowRunId: workflowRun.id }, { status: 200 })
}
