---
phase: 11-metadata-validator-qa-scoring
plan: "01"
subsystem: metadata-validator
tags: [qa, rules-engine, anthropic, metadata-validator]
dependency_graph:
  requires:
    - src/lib/rules/rule-meta.ts
    - src/app/api/ai/generate-page-package/route.ts (pattern)
    - src/lib/supabase/server.ts
  provides:
    - computeQaRules (named export, consumed by PagePackageEditor lock flow)
    - POST /api/ai/qa-audit (Claude QA endpoint)
  affects:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
tech_stack:
  added:
    - Anthropic SDK (non-streaming messages.create)
  patterns:
    - ownership double-check (projects + page_packages both .eq user_id)
    - prompt injection mitigation via delimiters + .slice() caps
    - rules-engine integration in client-side validator
key_files:
  created:
    - src/app/api/ai/qa-audit/route.ts
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
decisions:
  - "computeQaRules exported — allows PagePackageEditor lock flow to reuse validation logic without re-importing"
  - "QaBadge receives projectRules={} empty default in PagePackageEditor — future plans wire actual rules from page.tsx SSR"
  - "Non-streaming Anthropic call (max_tokens: 1000) — sufficient for 4-check JSON response, simpler client handling"
  - "Prompt injection mitigated with ---BAŞLIK---/---BİTİŞ--- delimiters and .slice() length caps on all user-controlled fields"
metrics:
  duration: "~12 min"
  completed: "2026-04-25"
  tasks: 2
  files_modified: 3
---

# Phase 11 Plan 01: QaBadge Extension + QA Audit Endpoint Summary

**One-liner:** Rules-engine entegrasyonlu QaBadge (projectRules prop + computeQaRules export) ve Claude-tabanlı /api/ai/qa-audit endpoint — auth, double ownership check, non-streaming JSON yanıt.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | QaBadge.tsx — projectRules prop + rules engine entegrasyonu | a3b8416 | QaBadge.tsx, PagePackageEditor.tsx |
| 2 | /api/ai/qa-audit/route.ts — Claude QA endpoint | 4081cc7 | src/app/api/ai/qa-audit/route.ts |

## What Was Built

### Task 1: QaBadge Extension

`QaBadge.tsx` genişletildi:
- `ProjectRules = Record<string, boolean>` tip tanımı eklendi
- `QaBadgeProps`'a `slug: string | null` ve `projectRules: ProjectRules` eklendi
- `computeQaRules` iç fonksiyondan `export function` haline getirildi
- 9 rules-engine kuralı eklendi: `title_starts_with_keyword`, `title_max_length_enforced`, `h1_includes_keyword`, `h1_exact_match`, `slug_lowercase_hyphen`, `meta_desc_includes_keyword`, `meta_desc_required`, `meta_desc_length_enforced`
- 4 mevcut hardcoded kural (QA-01~QA-04) korundu
- `title_includes_brand` ve `h1_single_per_page`: client context'te uygulanamaz — no-op

`PagePackageEditor.tsx` güncellendi:
- QaBadge çağrısına `slug={slug}` ve `projectRules={{}}` eklendi (Rule 1 fix: TS type error önlendi)
- `projectRules={}` boş obje — Plan 03'te page.tsx SSR'dan rules sorgusu gelecek

### Task 2: /api/ai/qa-audit Route

`src/app/api/ai/qa-audit/route.ts` oluşturuldu:
- `supabase.auth.getUser()` → `!user → 401` auth guard
- `projects` tablosuna `.eq('user_id', user.id)` → 404 if mismatch (T-11-01)
- `page_packages` tablosuna `.eq('user_id', user.id)` → 404 if mismatch (T-11-02)
- Non-streaming `client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1000 })`
- `buildQaPrompt`: `---BAŞLIK---/---BİTİŞ---` delimiter'lar + `.slice()` caps (T-11-03)
- JSON extract: ```json...``` veya raw `{...}` pattern
- `ANTHROPIC_API_KEY` sunucu taraflı — `NEXT_PUBLIC_` prefix yok (T-11-04)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PagePackageEditor.tsx QaBadge call updated for new required props**
- **Found during:** Task 1
- **Issue:** QaBadge'e `slug` ve `projectRules` eklendikten sonra PagePackageEditor.tsx'teki mevcut QaBadge çağrısı TypeScript hatasına neden oluyordu (eksik required props)
- **Fix:** `slug={slug}` ve `projectRules={{}}` eklendi — slug zaten state'te var, projectRules boş obje olarak geçildi (Plan 03'te wired olacak)
- **Files modified:** src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
- **Commit:** a3b8416

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| PagePackageEditor.tsx | `projectRules={}` (empty object passed to QaBadge) | Plan 01 kapsamı sadece QaBadge ve API endpoint — page.tsx SSR rules sorgusu Plan 03'te wired olacak. Boş obje ile tüm rules-engine kuralları hiç tetiklenmez (false branch), mevcut 4 hardcoded kural çalışmaya devam eder. |

## Threat Surface Scan

Tüm T-11-* tehditler plan'daki STRIDE register ile örtüşüyor — yeni yüzey yok.

| Mitigated | File | Description |
|-----------|------|-------------|
| T-11-01 | qa-audit/route.ts | supabase.auth.getUser() → 401 if !user |
| T-11-02 | qa-audit/route.ts | .eq('user_id') on both projects and page_packages |
| T-11-03 | qa-audit/route.ts | Delimiter markers + .slice() on all user-controlled fields |
| T-11-04 | qa-audit/route.ts | process.env.ANTHROPIC_API_KEY, no NEXT_PUBLIC_ prefix |

## Self-Check

**Created files exist:**
- src/app/api/ai/qa-audit/route.ts: FOUND
- src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx: FOUND (modified)

**Commits exist:**
- a3b8416: FOUND
- 4081cc7: FOUND

## Self-Check: PASSED
