---
phase: 16-recovery-engine
plan: "04"
subsystem: monitoring-page
tags:
  - page
  - server-action
  - recovery
  - integration
dependency_graph:
  requires:
    - "src/lib/monitoring/recovery-tasks.ts (getRecoveryTasks — Plan 16-02)"
    - "src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx (Plan 16-03)"
    - "src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx (Plan 16-03)"
    - "src/app/(dashboard)/projeler/[id]/izleme/actions.ts stub (Plan 16-03)"
  provides:
    - "Full updateRecoveryTaskStatus server action (auth + ownership + status guard)"
    - "izleme page with 3-tab ContentTabBar and tab-conditional rendering"
    - "?tab=clusters|pages|recovery URL surface"
  affects:
    - "Plan 16-05 (recovery/detect route — references recovery_tasks via service client)"
    - "Plan 16-06 (publishToWordPress auto-resolve — modifies recovery task status)"
tech_stack:
  added: []
  patterns:
    - "Promise.all parallel fetch extended with third slot (recoveryTasks)"
    - "Tab-conditional rendering: {activeTab === 'X' && <section>}"
    - "Server action: auth → ownership → mutation with .in('status',[...]) guard → revalidatePath"
    - "includesDismissed=true for SSR load — dismissed rows available for toggle without extra fetch"
key_files:
  created: []
  modified:
    - "src/app/(dashboard)/projeler/[id]/izleme/actions.ts"
    - "src/app/(dashboard)/projeler/[id]/izleme/page.tsx"
decisions:
  - "getRecoveryTasks called with includesDismissed=true — loads open+in_progress+dismissed in one SSR query so the toggle in RecoveryTaskTable has rows to reveal without a client-side refetch (D-13)"
  - "Default activeTab='clusters' — backward compatible with existing /izleme URLs that have no ?tab param"
  - "?tab whitelist parser: unknown values fall back to 'clusters' — prevents blank page on bad URLs (T-16-04-04)"
  - ".in('status', ['open', 'in_progress']) guard on UPDATE — prevents race with publishToWordPress that auto-resolves tasks (T-16-04-06)"
  - ".select('id') after UPDATE — zero-row result surfaces explicit user error instead of silent failure"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-02"
  tasks: 2
  files: 2
---

# Phase 16 Plan 04: izleme Page Integration + Server Action Summary

**One-liner:** izleme/page.tsx'e ContentTabBar + paralel recovery fetch + 3-tab koşullu render eklendi; actions.ts stub tam server action implementasyonuyla değiştirildi (session auth + ownership + status guard + revalidatePath).

## What Was Built

### 1. `izleme/actions.ts` — Full Server Action (replaces 16-03 stub)

Plan 16-03'teki stub tamamen kaldırıldı. Tam implementasyon şunları içerir:

| Katman | Uygulama |
|--------|----------|
| Input validation | taskId/projectId/status tip ve değer kontrolü — defence-in-depth |
| Session auth | `supabase.auth.getUser()` — session yoksa `{ success: false, error: 'Oturum bulunamadı.' }` |
| Ownership | `projects` tablosunda `.eq('user_id', user.id)` filtresi — proje başkasına aitse `Proje bulunamadı.` |
| Mutation guard | `.in('status', ['open', 'in_progress'])` — resolved görevi asla geçersiz kılmaz (publishToWordPress race) |
| Zero-row detection | `.select('id')` sonrası `data.length === 0` kontrolü — sessiz başarısızlık yok |
| Cache invalidation | `revalidatePath('/projeler/${projectId}/izleme')` — SSR refresh gerçek veriyi gösterir |
| Error strings | Türkçe, DB detayı sızdırmaz (T-16-04-09) |

### 2. `izleme/page.tsx` — Tab Integration

Mevcut dosyaya şu değişiklikler uygulandı:

| Değişiklik | Detay |
|------------|-------|
| `searchParams` tip | `{ period?: string; tab?: string }` |
| Tab parsing | Whitelist: `'pages' \| 'recovery' \| 'clusters'` (default) |
| Import | `getRecoveryTasks`, `ContentTabBar`, `ContentTab`, `RecoveryTaskTable` |
| Promise.all | 3. slot: `getRecoveryTasks(supabase, id, true)` (includesDismissed=true) |
| ContentTabBar | `<ContentTabBar projectId={id} active={activeTab} period={period} />` — PeriodTabBar'ın altında |
| Koşullu render | `{activeTab === 'clusters' && ...}`, `{activeTab === 'pages' && ...}`, `{activeTab === 'recovery' && ...}` |
| Backward compat | Default URL (no ?tab) → clusters section — önceki davranış korundu |

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace actions.ts stub | `70917ba` | `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` |
| 2 | Modify page.tsx — tab integration | `5c99cc9` | `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` |

## Deviations from Plan

Yok — plan tam olarak belirtildiği şekilde yürütüldü.

Plan Task 2, Critical Rule 6'da belirtildiği üzere `getRecoveryTasks(supabase, id, true)` çağrısı (includesDismissed=true) önceden planlanmış bir düzeltmeydi — sapma sayılmaz.

## Known Stubs

Yok. Plan 16-03'teki `updateRecoveryTaskStatus` stub'ı bu planda tam implementasyonla değiştirildi.

## Threat Surface Scan

Bu plan yeni ağ endpoint, auth yolu veya şema değişikliği eklemedi. Tüm `<threat_model>` tehditleri ele alındı:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-16-04-01 | `supabase.auth.getUser()` + `notFound()` — page.tsx'te uygulandı |
| T-16-04-02 | `projects` sorgusu `.eq('user_id', user.id)` — page.tsx'te uygulandı |
| T-16-04-03 | RLS SELECT policy (Plan 16-01) + `getRecoveryTasks` project_id filtresi |
| T-16-04-04 | Whitelist parser — bilinmeyen tab değeri 'clusters'a düşer |
| T-16-04-05 | Server action ownership re-check + UPDATE'de `eq('project_id', projectId)` |
| T-16-04-06 | `.in('status', ['open', 'in_progress'])` — resolved görev güncellenmez |
| T-16-04-07 | RLS UPDATE policy + anon key session gerektiriyor |
| T-16-04-08 | Accept — `console.error(error.message)` yeterli MVP audit trail |
| T-16-04-09 | Sabit Türkçe hata mesajları — ham DB hatası kullanıcıya dönmez |
| T-16-04-10 | Accept — MVP ölçeğinde DoS riski yok |

## TypeScript Compilation

`npx tsc --noEmit` — her iki dosyada da sıfır hata.

## Self-Check: PASSED

- [x] `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` exists
- [x] `'use server'` directive present
- [x] `import { revalidatePath } from 'next/cache'` present
- [x] `import { createClient } from '@/lib/supabase/server'` present
- [x] `export async function updateRecoveryTaskStatus` present
- [x] `supabase.auth.getUser()` present
- [x] `.eq('user_id', user.id)` present
- [x] `.in('status', ['open', 'in_progress'])` present
- [x] `revalidatePath(\`/projeler/${projectId}/izleme\`)` present
- [x] No STUB marker in file
- [x] `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` exists
- [x] `import { getRecoveryTasks }` from recovery-tasks present
- [x] `import { ContentTabBar, type ContentTab }` present
- [x] `import { RecoveryTaskTable }` present
- [x] `tab?: string` in searchParams type present
- [x] `activeTab: ContentTab` variable present
- [x] `getRecoveryTasks(supabase, id, true)` call present
- [x] `<ContentTabBar projectId={id} active={activeTab} period={period} />` present
- [x] `activeTab === 'clusters'` conditional present
- [x] `activeTab === 'pages'` conditional present
- [x] `activeTab === 'recovery'` conditional present
- [x] `<RecoveryTaskTable tasks={recoveryTasks} projectId={id} />` present
- [x] Commit `70917ba` exists: `git log --oneline | grep 70917ba` ✓
- [x] Commit `5c99cc9` exists: `git log --oneline | grep 5c99cc9` ✓
- [x] tsc --noEmit: zero errors in both files
