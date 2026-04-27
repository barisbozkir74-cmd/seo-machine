import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getValidGscToken } from '@/lib/gsc/auth'
import { fetchSearchAnalytics } from '@/lib/gsc/search-analytics'

// Service role client — gsc_metrics upsert için (RLS bypass)
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  // T-14-04: Webhook secret doğrulama — n8n unauthorized sync tetiklemesi engellenir
  const secret = request.headers.get('X-N8n-Webhook-Secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // T-14-04: Ownership doğrulama — userId, projectId'nin gerçek sahibi olmalı
  const { data: project } = await serviceClient
    .from('projects')
    .select('gsc_property_url')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project?.gsc_property_url) {
    return NextResponse.json(
      { error: 'Project not found or GSC not configured' },
      { status: 404 }
    )
  }

  // Token al (refresh gerekirse otomatik yapar)
  const accessToken = await getValidGscToken(projectId, userId)
  if (!accessToken) {
    return NextResponse.json(
      { error: 'GSC token unavailable — user must reconnect' },
      { status: 401 }
    )
  }

  // Son 28 gün aralığı (GSC API minimum)
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 28)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const rows = await fetchSearchAnalytics(
    accessToken,
    project.gsc_property_url,
    fmt(startDate),
    fmt(endDate)
  )

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0 })
  }

  // page_id çözme: wp_post_url üzerinden page_packages → pages eşleşmesi
  // RESEARCH.md Open Questions Q3 çözümü
  const pageUrls = [...new Set(rows.map((r) => r.pageUrl))]
  const { data: packages } = await serviceClient
    .from('page_packages')
    .select('page_id, wp_post_url')
    .in('wp_post_url', pageUrls)
    .eq('project_id', projectId)

  const urlToPageId = new Map<string, string>()
  for (const pkg of packages ?? []) {
    if (pkg.wp_post_url && pkg.page_id) {
      urlToPageId.set(pkg.wp_post_url, pkg.page_id)
    }
  }

  // Sadece eşleşen satırları upsert et
  const today = fmt(new Date())
  const metricsToUpsert = rows
    .filter((r) => urlToPageId.has(r.pageUrl))
    .map((r) => ({
      project_id: projectId,
      page_id: urlToPageId.get(r.pageUrl)!,
      date: today,
      keyword: r.keyword,
      clicks: r.clicks,
      impressions: r.impressions,
      avg_position: r.avgPosition,
    }))

  if (metricsToUpsert.length > 0) {
    await serviceClient
      .from('gsc_metrics')
      .upsert(metricsToUpsert, { onConflict: 'page_id,date,keyword' })
  }

  return NextResponse.json({ synced: metricsToUpsert.length })
}
