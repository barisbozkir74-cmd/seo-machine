import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Service role client — projects tablosu RLS bypass
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // T-15.5-06-03: Session doğrulama — kimliği doğrulanmamış erişim engellenir
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = getServiceClient()

  // T-15.5-06-03: Ownership check — kullanıcı sadece kendi projesini okuyabilmeli
  const { data: project } = await serviceClient
    .from('projects')
    .select('import_status, import_current, import_total, import_error_message')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: project.import_status ?? 'idle',
    current: project.import_current ?? 0,
    total: project.import_total ?? 0,
    errorMessage: project.import_error_message ?? null,
  })
}
