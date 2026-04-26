---
phase: 12-content-studio
plan: "02"
subsystem: ai-generation
tags:
  - streaming
  - anthropic
  - content-studio
  - api-route
  - rules-engine
dependency_graph:
  requires:
    - 12-01 (content_sections migration — page_packages.status='locked' zorunlu)
  provides:
    - POST /api/ai/generate-section (streaming endpoint)
  affects:
    - src/app/api/ai/generate-section/route.ts
tech_stack:
  added: []
  patterns:
    - Anthropic SDK client.messages.stream() + ReadableStream
    - Global + project override rule resolution (RULE_META)
    - Prompt injection isolation via --- delimiters
key_files:
  created:
    - src/app/api/ai/generate-section/route.ts
  modified: []
decisions:
  - "Lock guard: yalnızca pkg.status='locked' olan paketler için üretim yapılır (403 otherwise)"
  - "max_tokens: 2000 — bölüm başına yeterli, paralel çağrılarda maliyet kontrolü"
  - "isRegenerate=true ile approvedSections eklenir; paralel üretimde eklenmez"
  - "Prompt injection: brand_tone, sector, strategic_purpose --- bloklarıyla talimat bölümünden izole edildi"
metrics:
  duration: "~5 dakika"
  completed: "2026-04-26"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 12 Plan 02: Generate-Section Streaming Endpoint Summary

**One-liner:** Kilitli sayfa paketi için bölüm bazlı streaming AI içerik üretimi — claude-sonnet-4-6, RULE_META kural enjeksiyonu ve prompt injection korumasıyla.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | generate-section/route.ts streaming endpoint | 4771a87 | src/app/api/ai/generate-section/route.ts |

## What Was Built

`POST /api/ai/generate-section` — Content Studio'nun bölüm kartlarının kullandığı streaming AI endpoint'i. Her bölüm kartı bu endpoint'e `sectionIndex` ve `headingHierarchy` göndererek SSE-style `ReadableStream` üzerinden token alır.

**Güvenlik katmanları (sırayla):**
1. `supabase.auth.getUser()` → 401 unauthenticated
2. Body parse + tip doğrulaması → 400 eksik/hatalı alanlar
3. `projects.eq('user_id', user.id)` → 404 IDOR koruması
4. `pages.eq('user_id', user.id).eq('project_id', projectId)` → 404 çapraz proje koruması
5. `page_packages.status !== 'locked'` → 403 kilit kontrolü

**Prompt yapısı (D-03 uyumlu):**
- Proje: domain, name, sector (---izole---), brand_tone (---izole---), target_language
- Sayfa paketi: seo_title, h1, meta_description, search_intent, strategic_purpose (---izole---)
- Focus keyword
- Tam heading_hierarchy (hedef bölüm okla işaretlendi)
- approvedSections: yalnızca `isRegenerate=true` ise eklenir
- Aktif SEO kuralları: `resolvedRules`'dan true olan RULE_META label'ları

**Streaming response:**
- `Content-Type: text/plain; charset=utf-8`
- `Transfer-Encoding: chunked`
- `Cache-Control: no-cache`

## Deviations from Plan

None — plan tam olarak yürütüldü.

## Threat Surface Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-12-02-01 | supabase.auth.getUser() → 401 | Implemented |
| T-12-02-02 | Tüm sorguları .eq('user_id', user.id) içeriyor | Implemented |
| T-12-02-03 | pkg.status !== 'locked' → 403 | Implemented |
| T-12-02-04 | brand_tone, sector, strategic_purpose --- bloklarıyla izole edildi | Implemented |
| T-12-02-05 | max_tokens: 2000; Anthropic rate limit kabul edildi | Accepted |

## Self-Check: PASSED

- [x] `src/app/api/ai/generate-section/route.ts` mevcut
- [x] Commit `4771a87` git log'da mevcut
- [x] `client.messages.stream` var
- [x] `status !== 'locked'` guard var
- [x] `status: 401` auth guard var
- [x] `claude-sonnet-4-6` model sabit
- [x] `RULE_META` import ve kullanım var
- [x] TypeScript: generate-section dosyasına ait sıfır hata (pre-existing hatalar kapsam dışı)
