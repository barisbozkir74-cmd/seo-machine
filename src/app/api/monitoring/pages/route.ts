import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPageMetrics } from '@/lib/monitoring/aggregation'
import type { MonitoringPeriod } from '@/lib/monitoring/aggregation'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const periodRaw = searchParams.get('period') ?? '28'
  const period: MonitoringPeriod =
    periodRaw === '7' ? 7 : periodRaw === '90' ? 90 : 28

  // Kullanıcı kimlik doğrulama
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Proje ownership ve GSC bağlantısı doğrulama
  const { data: project } = await supabase
    .from('projects')
    .select('id, gsc_property_url')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // GSC bağlantısı yoksa boş veri dön
  if (!project.gsc_property_url) {
    return NextResponse.json({ pages: [], gscConnected: false })
  }

  try {
    const pages = await getPageMetrics(supabase, projectId, period)
    return NextResponse.json({ pages, gscConnected: true, period })
  } catch (err) {
    console.error('[monitoring/pages]', err)
    return NextResponse.json(
      { error: 'Failed to fetch page metrics' },
      { status: 500 }
    )
  }
}
