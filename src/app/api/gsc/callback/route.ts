import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { saveGscTokens } from '@/lib/gsc/auth'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // T-14-01: CSRF — state cookie karşılaştırması
  const cookieStore = await cookies()
  const savedState = cookieStore.get('gsc_oauth_state')?.value
  cookieStore.delete('gsc_oauth_state') // tek kullanımlık — hemen sil

  if (!savedState || savedState !== state) {
    // T-14-05: Open redirect engeli — sadece kendi origin'imize redirect
    return NextResponse.redirect(new URL('/projeler?error=gsc_csrf', origin))
  }

  if (error || !code) {
    return NextResponse.redirect(new URL('/projeler?error=gsc_denied', origin))
  }

  // projectId state'ten çıkar (format: "projectId:uuid")
  const projectId = savedState.split(':')[0]

  // Kullanıcı oturumunu doğrula
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Token exchange
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gsc/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL(`/projeler/${projectId}?error=gsc_token_failed`, origin))
  }

  const tokens = await tokenRes.json()
  // RESEARCH.md Pitfall 1: refresh_token yoksa kullanıcı tekrar OAuth yapmalı
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL(`/projeler/${projectId}?error=gsc_token_failed`, origin))
  }

  // Ownership doğrulama + token kaydet
  await saveGscTokens(projectId, user.id, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? '', // refresh_token bazen gelmeyebilir (Pitfall 1)
    expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    token_type: tokens.token_type ?? 'Bearer',
  })

  // D-04: Callback sonrası proje sayfasına yönlendir
  return NextResponse.redirect(new URL(`/projeler/${projectId}`, origin))
}
