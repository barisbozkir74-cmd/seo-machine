import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runSectorResearch } from '@/lib/research/sector-research'

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

  const serviceClient = getServiceClient()

  // T-18-06: IDOR koruması — userId ownership check
  const { data: project } = await serviceClient
    .from('projects')
    .select('id, name, sector, initial_competitors, target_keywords')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Gate validation — 3 zorunlu alan kontrolü (D-01 per CONTEXT.md)
  if (!project.sector?.trim() || !project.initial_competitors?.trim() || !project.target_keywords?.trim()) {
    return NextResponse.json(
      { error: 'Proje bilgileri eksik: sektör, rakipler ve hedef kelimeler dolu olmalıdır.' },
      { status: 400 }
    )
  }

  try {
    await runSectorResearch({
      projectId: project.id,
      userId,
      sector: project.sector,
      initial_competitors: project.initial_competitors,
      target_keywords: project.target_keywords,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Araştırma pipeline başarısız oldu.'
    console.error('[research/trigger] Pipeline error:', err)
    if (message.includes('DataForSEO credentials')) {
      return NextResponse.json(
        { error: 'DataForSEO credentials yapılandırılmamış.', code: 'DATAFORSEO_NOT_CONFIGURED' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Research pipeline failed' }, { status: 500 })
  }
}
