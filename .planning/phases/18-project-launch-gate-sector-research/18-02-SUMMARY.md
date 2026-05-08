---
phase: 18
plan: "02"
subsystem: research-api
tags: [api-route, idor-protection, gate-validation, research-pipeline]
dependency_graph:
  requires: []
  provides:
    - "POST /api/research/trigger — araştırma pipeline HTTP entry point"
    - "src/lib/research/sector-research.ts stub (Plan 18-01 override edecek)"
  affects:
    - "Plan 18-03: ProjectInfoSection butonu bu endpoint'i çağıracak"
tech_stack:
  added: []
  patterns:
    - "IDOR ownership check: .eq('user_id', userId) + 404 on mismatch"
    - "Gate validation: 3 zorunlu alan trim kontrolü"
    - "SerpAPI config error: SERPAPI_NOT_CONFIGURED code + 503"
key_files:
  created:
    - src/app/api/research/trigger/route.ts
    - src/lib/research/sector-research.ts
  modified: []
decisions:
  - "D-01: sector + initial_competitors + target_keywords — 3 zorunlu alan gate kontrolü server-side uygulandı"
  - "STUB: sector-research.ts minimal stub olarak oluşturuldu — Plan 18-01 implementasyonu override edecek; parallel wave gereksinimi"
metrics:
  duration: "~8 dakika"
  completed: "2026-05-08T09:01:50Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 2
  files_modified: 0
---

# Phase 18 Plan 02: Research Trigger API Route Summary

**One-liner:** IDOR-korumalı POST /api/research/trigger route — gate validation, runSectorResearch() çağrısı ve SerpAPI config error handling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | /api/research/trigger/route.ts oluştur | 721c18e | src/app/api/research/trigger/route.ts, src/lib/research/sector-research.ts |

## What Was Built

`POST /api/research/trigger` Next.js API route:

- **Body parse:** `{ projectId, userId }` — Invalid JSON veya eksik alan → 400
- **IDOR koruması (T-18-06):** `.eq('user_id', userId)` ile ownership check; eşleşmezse 404
- **Gate validation (D-01):** `sector`, `initial_competitors`, `target_keywords` `.trim()` kontrolü — eksikse 400 + açıklayıcı Türkçe mesaj
- **runSectorResearch() çağrısı:** Başarılı validasyon sonrası `{ projectId, userId, sector, initial_competitors, target_keywords }` imzasıyla
- **SerpAPI config error (T-18-07):** `message.includes('SERPAPI_KEY')` koşulunda `code: 'SERPAPI_NOT_CONFIGURED'` + 503 — UI bu kodu özel toast ile gösterecek
- **Error logging:** `console.error('[research/trigger] Pipeline error:', err)` — API key veya kullanıcı verisi loglanmıyor

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sector-research.ts stub oluşturuldu**
- **Found during:** Task 1 başlangıcı
- **Issue:** Plan 18-01 ile parallel wave'de çalışılıyor; `src/lib/research/sector-research.ts` henüz mevcut değil. TypeScript import hatası route.ts'i derlemesiz bırakırdı.
- **Fix:** Minimal stub oluşturuldu — `ResearchInput` interface + `runSectorResearch` export imzası. Plan 18-01 aynı worktree merge edilince gerçek implementasyon dosyayı override edecek.
- **Files modified:** src/lib/research/sector-research.ts (stub)
- **Commit:** 721c18e

## Verification Results

- `ls src/app/api/research/trigger/route.ts` — FOUND
- `export async function POST(request: NextRequest)` — FOUND (satır 13)
- `.eq('user_id', userId)` — FOUND (satır 34) — IDOR koruması
- `if (!project)` + 404 — FOUND (satır 37-39)
- `sector?.trim() || initial_competitors?.trim() || target_keywords?.trim()` gate — FOUND (satır 42)
- `runSectorResearch(` — FOUND (satır 50)
- `SERPAPI_NOT_CONFIGURED` code — FOUND (satır 65)
- `console.error('[research/trigger]` — FOUND (satır 61)
- TypeScript (yeni dosyalar için): 0 hata — pre-existing hatalar kapsam dışı

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `runSectorResearch` — throw 'Not implemented' | src/lib/research/sector-research.ts | 13 | Plan 18-01 implementasyonu bekleniyor; parallel wave stub |

## Self-Check: PASSED

- `src/app/api/research/trigger/route.ts` — FOUND
- `src/lib/research/sector-research.ts` — FOUND
- Commit 721c18e — FOUND in git log
