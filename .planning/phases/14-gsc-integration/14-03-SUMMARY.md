---
phase: 14-gsc-integration
plan: "03"
subsystem: oauth-flow
tags: [google-oauth2, csrf, server-action, route-handler, cookies, token-exchange, env-vars]
dependency_graph:
  requires:
    - "14-01: gsc_tokens JSONB column on projects"
    - "14-01: gsc_property_url TEXT column on projects"
    - "14-02: saveGscTokens — token persistence helper"
  provides:
    - initiateGscOAuth server action — state cookie + Google auth redirect
    - saveGscProperty server action — projects.gsc_property_url update
    - /api/gsc/callback GET handler — CSRF check, token exchange, Supabase write
    - .env.local.example — 5 yeni env var (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_APP_URL, N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET)
  affects:
    - plans: [14-04, 14-05]
      reason: GscConnectionSection (14-04) bu action'ları çağırır; property_url (14-04, 14-05) bu action tarafından set edilir
tech_stack:
  added: []
  patterns:
    - "HttpOnly cookie CSRF protection — gsc_oauth_state state={projectId:uuid}"
    - "next/headers cookies() async API — Next.js App Router server action cookie write"
    - "state cookie delete on first use — replay attack prevention"
    - "new URL('/path', origin) redirect pattern — T-14-05 open redirect mitigation"
    - "prompt=consent in OAuth URL — Pitfall 1 refresh_token guarantee"
key_files:
  created:
    - src/app/api/gsc/callback/route.ts
  modified:
    - src/app/(dashboard)/projeler/[id]/actions.ts
    - .env.local.example
decisions:
  - "initiateGscOAuth redirect() kullanır (throws NEXT_REDIRECT) — return value yoktur, bu server action pattern normal davranışıdır"
  - "saveGscProperty dönüş tipi explicit: { success: true } | { success: false; error: string } — upstream GscConnectionSection buna bağlıdır"
  - "callback route origin kullanır (request.nextUrl.origin) — T-14-05: harici URL'e redirect imkansız"
  - "refresh_token ?? '' fallback — prompt=consent rağmen ilk token exchange'de refresh_token gelmeyebilir; boş string tutulur, kullanıcı yeniden OAuth'a yönlendirilir (Pitfall 1)"
metrics:
  duration: "~8 min"
  completed: "2026-04-27"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
requirements:
  - GSC-01
---

# Phase 14 Plan 03: GSC OAuth Flow Summary

Google OAuth 2.0 flow implemente edildi — HttpOnly cookie ile CSRF korumalı state yönetimi, token exchange ve Supabase yazma ile proje sayfasına yönlendirme; initiateGscOAuth + saveGscProperty server action'ları ve /api/gsc/callback route handler'ı oluşturuldu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | initiateGscOAuth + saveGscProperty server actions | 13cb8ce | src/app/(dashboard)/projeler/[id]/actions.ts |
| 2 | /api/gsc/callback route handler + .env.local.example | b91351d | src/app/api/gsc/callback/route.ts, .env.local.example |

## What Was Built

### src/app/(dashboard)/projeler/[id]/actions.ts (güncellendi)

**initiateGscOAuth(projectId: string):**
- Kullanıcı oturumu + proje ownership doğrulaması (user_id triple-check)
- `state = "${projectId}:${crypto.randomUUID()}"` — callback'te projectId çözümleme için
- `gsc_oauth_state` HttpOnly cookie yazma (10 dk TTL, secure=production, sameSite=lax)
- Google authorization URL: client_id, redirect_uri, response_type=code, scope, access_type=offline, prompt=consent, state
- `redirect(authUrl.toString())` — server action içinde NextResponse redirect

**saveGscProperty(projectId, propertyUrl):**
- Kullanıcı oturumu doğrulaması
- `projects.gsc_property_url` güncelleme — `.eq('user_id', user.id)` ownership garantisi
- Başarı/hata dönüş tipi: `{ success: true } | { success: false; error: string }`

### src/app/api/gsc/callback/route.ts (yeni)

**GET(request: NextRequest):**
- `gsc_oauth_state` cookie okuma + hemen silme (tek kullanımlık — replay attack koruması)
- CSRF kontrolü: `savedState !== state` → `/projeler?error=gsc_csrf` redirect
- Error/code eksikliği → `/projeler?error=gsc_denied`
- `projectId = savedState.split(':')[0]` — state'ten projectId çözümü
- Kullanıcı oturumu doğrulaması
- Token exchange: `POST https://oauth2.googleapis.com/token` (code, client_id, client_secret, redirect_uri, grant_type)
- `saveGscTokens(projectId, user.id, { access_token, refresh_token, expires_at, token_type })` çağrısı
- Başarılı redirect: `/projeler/${projectId}` — D-04 uygulandı
- Tüm redirect'ler `new URL('/path', origin)` pattern — T-14-05 open redirect mitigation

### .env.local.example (güncellendi)

5 yeni env var eklendi:
- `GOOGLE_CLIENT_ID` — Google Cloud Console OAuth2 client ID
- `GOOGLE_CLIENT_SECRET` — Google Cloud Console OAuth2 client secret
- `NEXT_PUBLIC_APP_URL` — public app URL (dev: http://localhost:3000)
- `N8N_WEBHOOK_URL` — self-hosted n8n GSC sync webhook URL
- `N8N_WEBHOOK_SECRET` — n8n webhook shared secret

## Deviations from Plan

None — plan tam olarak uygulandı.

## Threat Surface Scan

Yeni network surface:
- `POST https://oauth2.googleapis.com/token` — GOOGLE_CLIENT_SECRET server-only env var; client'a gönderilmiyor
- Tüm redirect'ler `new URL('/path', origin)` — harici URL'e redirect mümkün değil (T-14-05)
- `gsc_oauth_state` cookie: HttpOnly, secure (production), SameSite=lax, 10 dk TTL — CSRF koruması (T-14-01)

Tüm tehdit surface'ları plan'ın `<threat_model>` bölümünde kayıtlı (T-14-01, T-14-02, T-14-05); yeni tehdit yok.

## Self-Check

### Created files exist:
- `src/app/api/gsc/callback/route.ts` — FOUND

### Modified files exist:
- `src/app/(dashboard)/projeler/[id]/actions.ts` — FOUND
- `.env.local.example` — FOUND

### Commits exist:
- `13cb8ce` feat(14-03): add initiateGscOAuth + saveGscProperty server actions — FOUND
- `b91351d` feat(14-03): add /api/gsc/callback route handler + env vars — FOUND

## Self-Check: PASSED
