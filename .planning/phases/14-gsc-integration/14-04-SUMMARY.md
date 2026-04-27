---
phase: 14-gsc-integration
plan: "04"
subsystem: gsc-ui-sync
tags: [gsc, client-component, api-route, n8n, search-analytics, webhook-secret, ownership-check]
dependency_graph:
  requires:
    - "14-01: gsc_tokens JSONB column + gsc_property_url TEXT column on projects"
    - "14-02: getValidGscToken, saveGscTokens, listGscProperties, fetchSearchAnalytics"
    - "14-03: initiateGscOAuth + saveGscProperty server actions"
  provides:
    - GscConnectionSection client component — tüm bağlantı durumları
    - GET /api/gsc/properties — OAuth sonrası property listesi endpoint
    - POST /api/gsc/sync — n8n webhook trigger, gsc_metrics upsert
    - page.tsx entegrasyonu — GscConnectionSection WordPress bölümünün altında
  affects:
    - plans: [14-05]
      reason: Index badge (14-05) page.tsx'te aynı konuma entegre olacak
tech_stack:
  added:
    - shadcn Select component (src/components/ui/select.tsx)
  patterns:
    - "D-04: useEffect isConnected=true && !gscPropertyUrl → fetch /api/gsc/properties"
    - "T-14-P-01: GET /api/gsc/properties ownership check (.eq user_id)"
    - "T-14-04: POST /api/gsc/sync X-N8n-Webhook-Secret + userId ownership double-check"
    - "Pitfall 5 mitigation: gsc_tokens main project SELECT'e dahil edilmez"
    - "Q3 resolution: wp_post_url → page_id eşleşmesi via page_packages join"
key_files:
  created:
    - src/app/api/gsc/properties/route.ts
    - src/app/(dashboard)/projeler/[id]/gsc-section.tsx
    - src/app/api/gsc/sync/route.ts
    - src/components/ui/select.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/page.tsx
decisions:
  - "listGscProperties imzası Wave 2'de değiştirilmişti — (projectId, userId) değil, (accessToken) alıyor; GET /api/gsc/properties route kendi içinde getValidGscToken çağırarak accessToken elde eder"
  - "Select onValueChange tipi string | null; null coalesce ile empty string fallback eklendi (Rule 1 fix)"
  - "POST /api/gsc/sync service client'ı function içinde oluşturur (singleton değil) — Next.js edge runtime uyumluluğu için"
metrics:
  duration: "~12 min"
  completed: "2026-04-27"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
requirements:
  - GSC-01
  - GSC-03
---

# Phase 14 Plan 04: GSC UI + Sync Endpoint Summary

GscConnectionSection client component'i, property listesi API endpoint'i, proje detay sayfası entegrasyonu ve n8n sync endpoint'i oluşturuldu — D-04 (property dropdown), D-05 (GscConnectionSection), D-09/D-12 (sync endpoint) kararları implemente edildi.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GET /api/gsc/properties + GscConnectionSection | d5ee9bc | src/app/api/gsc/properties/route.ts, src/app/(dashboard)/projeler/[id]/gsc-section.tsx, src/components/ui/select.tsx |
| 2 | page.tsx GSC entegrasyonu + /api/gsc/sync | d76ba23 | src/app/(dashboard)/projeler/[id]/page.tsx, src/app/api/gsc/sync/route.ts |

## What Was Built

### src/app/api/gsc/properties/route.ts (yeni)

**GET /api/gsc/properties?projectId=uuid:**
- `supabase.auth.getUser()` ile session kontrolü (T-14-P-01)
- `projects` tablosunda `.eq('user_id', user.id)` ownership doğrulaması
- `getValidGscToken(projectId, user.id)` → token refresh otomatik
- `listGscProperties(accessToken)` → property array döner
- Response: `{ properties: Array<{ siteUrl, permissionLevel }> }`

### src/app/(dashboard)/projeler/[id]/gsc-section.tsx (yeni)

**GscConnectionSection({ projectId, isConnected, gscPropertyUrl }):**
- 5 durum state: bağlı değil / bağlanıyor / bağlı+property yükleniyor / bağlı+property seçilmemiş / tam yapılandırılmış
- D-04: `useEffect` → isConnected=true && !gscPropertyUrl → `fetch('/api/gsc/properties?projectId=...')`
- Badge: `bg-emerald-500/20 text-emerald-400` (Bağlı) / `bg-slate-800 text-slate-400` (Yapılandırılmadı)
- shadcn Select dropdown property listesi için
- Error params from callback URL: `gsc_csrf`, `gsc_denied`, `gsc_token_failed`
- Hata mesajı: `role="alert" text-xs text-destructive`
- "GSC Bağla" butonu: `min-h-[44px]`
- "Senkronize Et" → `POST /api/gsc/sync { projectId }`

### src/app/api/gsc/sync/route.ts (yeni)

**POST /api/gsc/sync:**
- `X-N8n-Webhook-Secret` header kontrolü (T-14-04 — `N8N_WEBHOOK_SECRET` env var)
- Body parse: `{ projectId, userId }` required
- Service role client ile ownership: `projects`.`.eq('user_id', userId)` + `gsc_property_url` kontrolü
- `getValidGscToken(projectId, userId)` → token (server context'i olmadığından createClient server action modunda çalışır)
- `fetchSearchAnalytics(accessToken, siteUrl, startDate, endDate)` — son 28 gün
- `page_packages.wp_post_url` üzerinden `page_id` çözme (Q3 resolution)
- `gsc_metrics.upsert(rows, { onConflict: 'page_id,date,keyword' })` idempotent

### src/app/(dashboard)/projeler/[id]/page.tsx (güncellendi)

- `GscConnectionSection` import eklendi
- Project `type` + `select` string'ine `gsc_property_url` eklendi
- `gsc_tokens` ana sorguya **dahil edilmedi** (Pitfall 5 mitigation)
- Ayrı `gscCheck` sorgusu: sadece `gsc_tokens` seçer → null check → `isGscConnected` boolean
- WordPress bölümünün altına Separator + GscConnectionSection render

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] listGscProperties imza uyumsuzluğu**
- **Found during:** Task 1 implementation
- **Issue:** Plan interface'i `listGscProperties(projectId: string, userId: string)` gösteriyordu; Wave 2 gerçek imzası `listGscProperties(accessToken: string)` — farklı
- **Fix:** GET /api/gsc/properties route içinde önce `getValidGscToken(projectId, user.id)` çağrısı yapıldı, elde edilen accessToken ile `listGscProperties(accessToken)` çağrıldı
- **Files modified:** src/app/api/gsc/properties/route.ts
- **Commit:** d5ee9bc

**2. [Rule 1 - Bug] Base UI Select onValueChange TypeScript hatası**
- **Found during:** TypeScript build check
- **Issue:** Base UI Select `onValueChange` callback tipi `(value: string | null, ...) => void`; `setSelectedProperty` tipi `Dispatch<SetStateAction<string>>` — `null` assignable değil
- **Fix:** `onValueChange={(v) => setSelectedProperty(v ?? '')}` ile null coalesce eklendi
- **Files modified:** src/app/(dashboard)/projeler/[id]/gsc-section.tsx
- **Commit:** 4993352

## Known Stubs

None — tüm fonksiyonel yollar tamamlandı.

## Threat Surface Scan

Yeni network surface:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: api_endpoint | src/app/api/gsc/properties/route.ts | GET endpoint — session auth + ownership ile korunuyor (T-14-P-01) |
| threat_flag: webhook_endpoint | src/app/api/gsc/sync/route.ts | POST endpoint — X-N8n-Webhook-Secret + userId ownership double-check (T-14-04) |

Tüm tehditler plan threat_model'inde kayıtlı; yeni tehdit yok.

## Self-Check

### Created files exist:
- `src/app/api/gsc/properties/route.ts` — FOUND
- `src/app/(dashboard)/projeler/[id]/gsc-section.tsx` — FOUND
- `src/app/api/gsc/sync/route.ts` — FOUND
- `src/components/ui/select.tsx` — FOUND

### Modified files exist:
- `src/app/(dashboard)/projeler/[id]/page.tsx` — FOUND

### Commits exist:
- `d5ee9bc` feat(14-04): add GET /api/gsc/properties route + GscConnectionSection client component — FOUND
- `d76ba23` feat(14-04): page.tsx GSC integration + POST /api/gsc/sync endpoint — FOUND
- `4993352` fix(14-04): fix Select onValueChange type mismatch in GscConnectionSection — FOUND

## Self-Check: PASSED
