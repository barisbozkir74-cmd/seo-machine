import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runKeywordAcquisition } from '@/lib/keywords/ai-acquisition'

// Service role client — RLS bypass, uzun pipeline için
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  // Body parse
  let body: { projectId?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, userId } = body
  if (!projectId || !userId) {
    return NextResponse.json({ error: 'projectId and userId required' }, { status: 400 })
  }

  // V5 Input Validation: UUID format
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(projectId) || !uuidRegex.test(userId)) {
    return NextResponse.json({ error: 'Geçersiz ID formatı.' }, { status: 400 })
  }

  // T-19-09: IDOR koruması — userId ownership check (analog: research/trigger satır 27-38)
  const serviceClient = getServiceClient()
  const { data: project } = await serviceClient
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const result = await runKeywordAcquisition({ projectId, userId })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Keyword acquisition başarısız oldu.'
    console.error('[keywords/acquire] Pipeline error:', err)

    if (message.includes('DataForSEO credentials')) {
      return NextResponse.json(
        { error: 'DataForSEO credentials yapılandırılmamış.', code: 'DATAFORSEO_NOT_CONFIGURED' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Keyword acquisition failed' }, { status: 500 })
  }
}
