import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidGscToken } from '@/lib/gsc/auth'
import { listGscProperties } from '@/lib/gsc/properties'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // Kullanıcı kimlik doğrulama
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Proje ownership doğrulama
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // GSC token al (refresh gerekirse otomatik yapar)
  const accessToken = await getValidGscToken(projectId, user.id)
  if (!accessToken) {
    return NextResponse.json({ error: 'GSC not connected or token unavailable' }, { status: 401 })
  }

  try {
    const properties = await listGscProperties(accessToken)
    return NextResponse.json({ properties })
  } catch (err) {
    console.error('[gsc/properties] listGscProperties error:', err)
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 })
  }
}
