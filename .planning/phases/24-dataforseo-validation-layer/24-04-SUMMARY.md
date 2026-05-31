---
phase: "24"
plan: "04"
subsystem: "dataforseo-validation-layer"
tags: ["n8n-webhook", "workflow_runs", "deep-analysis", "polling", "server-actions", "route-handlers"]
dependency_graph:
  requires: ["24-01", "24-02", "24-03"]
  provides: ["deep-analysis/route.ts", "deep-analysis/callback/route.ts", "DeepAnalysisPoller", "triggerDeepAnalysisAction"]
  affects: ["keyword-stratejisi/actions.ts", "keyword-stratejisi/page.tsx", "keyword-stratejisi/AnalysisButtons.tsx"]
tech_stack:
  added: []
  patterns:
    - "n8n trigger route (recovery/detect/route.ts analog)"
    - "n8n callback route (service role + dfs_fetched_at bulk update)"
    - "5s polling component with MAX_LOOPS=144 timeout guard"
    - "triggerDeepAnalysisAction Server Action (Approach A — anon client + RLS)"
key_files:
  created:
    - "src/app/api/dataforseo/deep-analysis/route.ts"
    - "src/app/api/dataforseo/deep-analysis/callback/route.ts"
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/DeepAnalysisPoller.tsx"
  modified:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts"
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx"
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx"
decisions:
  - "Yaklaşım A seçildi: triggerDeepAnalysisAction Server Action, anon client + user RLS (route.ts sadece n8n callback için)"
  - "onDeepAnalysisStart prop geriye uyumluluk için AnalysisButtons'da bırakıldı, kullanılmıyor"
  - "isPendingDeep useTransition eklendi — Derinlemesine Analiz butonuna Başlatılıyor... spinner eklendi"
  - "currentStatus SSR'dan gelince done/failed transition phase useEffect ile yakalanıyor"
metrics:
  duration: "~20 dakika"
  completed_date: "2026-05-31"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 24 Plan 04: Deep Analysis Async Flow Summary

Deep analiz n8n trigger route, n8n callback route ve DeepAnalysisPoller bileşeni implement edildi; workflow_runs lifecycle'ı (pending → running → done/failed) ve 5 saniyelik SSR polling ile tamamlandı. Phase 24 teslim listesi kapandı.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Deep Analysis trigger route | f97911e | src/app/api/dataforseo/deep-analysis/route.ts |
| 2 | Deep Analysis callback route | e52ab0e | src/app/api/dataforseo/deep-analysis/callback/route.ts |
| 3 | DeepAnalysisPoller + actions + page wiring | 5f3a7ad | DeepAnalysisPoller.tsx, actions.ts, AnalysisButtons.tsx, page.tsx |

---

## What Was Built

### Task 1: POST /api/dataforseo/deep-analysis (trigger route)

Pattern: `src/app/api/recovery/detect/route.ts` tam analogu.

- **Service role client** (SUPABASE_SERVICE_ROLE_KEY — anon key değil, RLS bypass zorunlu)
- **X-N8n-Webhook-Secret** header auth (T-24-05)
- **UUID validation**: projectId + userId regex `/^[0-9a-f-]{36}$/i`
- **Ownership check**: `projects.user_id = userId` (T-24-01 IDOR önlemi)
- **Concurrent guard (DFS-08)**: workflow_runs `.in('status', ['pending','running']) → 409` — eş zamanlı deep analiz engellendi
- **workflow_runs INSERT**: status='pending', input_payload: {keywordIds, analysisLevel, triggeredAt}
- **n8n webhook call**: `N8N_DEEP_ANALYSIS_WEBHOOK_URL` ile opsiyonel — env var yoksa pending'te kalır (geliştirme toleransı)
- **n8n ulaşılamazsa**: workflow_runs 'failed' yapılır, 502 dönülür

Response: `{ workflowRunId: string }` veya `{ error: string }`.

### Task 2: POST /api/dataforseo/deep-analysis/callback (callback route)

n8n analizi tamamlayınca çağırdığı endpoint.

- **Service role client** (RLS bypass — n8n auth ile gelen çağrı)
- **X-N8n-Webhook-Secret** check (T-24-05)
- **Gerekli field validation**: projectId, userId, workflowRunId, status — hepsi zorunlu
- **status enum check**: sadece 'done' veya 'failed' kabul edilir
- **UUID validation**: 3 alan için regex kontrolü
- **Ownership check**: projects.user_id = userId (T-24-01)
- **workflow_runs UPDATE**: status + result_payload + error_message + completed_at + updated_at
- **dfs_fetched_at bulk update** (DFS-07): `status === 'done' && keywordIds.length > 0` ise keywords tablosu güncellenir — hata non-fatal

Response: `{ ok: true }` veya `{ error: string }`.

### Task 3: DeepAnalysisPoller.tsx + triggerDeepAnalysisAction + wiring

**DeepAnalysisPoller.tsx** (ResearchAutoTrigger.tsx pattern'ı):
- `'use client'` — SSR'dan mount edilir, polling devam eder
- `setInterval(5000)` — 5 saniyelik polling, `router.refresh()` ile SSR'ı yeniler
- `MAX_LOOPS = 144` — 12 dakika timeout guard (144 × 5s)
- `triggered.current` ref ile çift polling önlendi
- Stop conditions: 3 farklı mesaj (done: ✓ Derinlemesine analiz tamamlandı / failed: Analiz başarısız oldu / timeout: Analiz yanıt vermedi)
- `currentStatus` prop ile SSR re-render'da phase güncellenmesi

**triggerDeepAnalysisAction** (actions.ts'e eklendi):
- UUID validation + auth + ownership (standart pattern)
- Concurrent guard: workflow_runs `dfs_deep_analysis` pending/running check
- workflow_runs INSERT: anon client + user RLS (Server Action pattern)
- n8n webhook call — N8N_DEEP_ANALYSIS_WEBHOOK_URL opsiyonel
- revalidatePath — DeepAnalysisPoller'ın SSR üzerinden mount edilmesini sağlar

**AnalysisButtons.tsx güncellendi**:
- `triggerDeepAnalysisAction` import edildi
- `isPendingDeep` + `startDeepTransition` useTransition eklendi
- `handleConfirm` deep branchi: Server Action çağrısı + error handling + router.refresh()
- Derinlemesine Analiz butonu: `isPendingDeep` ile Başlatılıyor... spinner
- `anyConcurrent`: isPendingDeep de dahil edildi

**page.tsx güncellendi**:
- `DeepAnalysisPoller` import edildi
- `activeWorkflow` varsa `<DeepAnalysisPoller>` mount edildi (toolbar'da AnalysisButtons yanında)

---

## Deviations from Plan

### Auto-fixed Issues

Yok — plan tam olarak uygulandı.

### Design Decision

**[Yaklaşım A seçimi] triggerDeepAnalysisAction Server Action**
- **Found during:** Task 3
- **Plan context:** Plan iki yaklaşım sundu (A: Server Action, B: fetch + client auth) ve A'yı önerdi
- **Seçim:** Server Action — mevcut actions.ts pattern'ı ile tutarlı, tüm tetiklemeler aynı katman
- **onDeepAnalysisStart prop:** Geriye uyumluluk için bırakıldı, kullanılmıyor

---

## Known Stubs

Yok. Tüm fonksiyonlar implement edildi ve veri kaynaklarına bağlandı.

N8N_DEEP_ANALYSIS_WEBHOOK_URL env var yoksa workflow_runs 'pending'te kalır — bu kasıtlı geliştirme ortamı toleransı (n8n kurulmamış ortam için).

---

## Threat Flags

Plan'daki threat model tam olarak uygulandı:

| Threat ID | Mitigation | Uygulama |
|-----------|-----------|---------|
| T-24-05 | X-N8n-Webhook-Secret | Her iki route + triggerDeepAnalysisAction'da n8n call header'ı |
| T-24-04 | Concurrent guard | workflow_runs `.in('status', ['pending','running'])` — trigger route + Server Action |
| T-24-06 | DoS önlemi | Concurrent guard (1 aktif job) + dialog onayı |
| T-24-01 | IDOR önlemi | `.eq('user_id', userId)` ownership check — trigger route + callback route + Server Action |
| T-24-12 | workflowRunId entropy | UUID v4 — accept (122 bit) |

Yeni threat surface eklenmedi.

---

## Phase 24 Tamamlama Özeti

Bu plan ile Phase 24 tüm DFS gereksinim listesini kapattı:

| Req | Açıklama | Plan |
|-----|----------|------|
| DFS-01 | strategy_decisions tablosu | 24-01 |
| DFS-02 | dfs_fetched_at kolonu | 24-01 |
| DFS-03 | Light analysis (sync) | 24-03 |
| DFS-04 | Standard analysis (sync) | 24-03 |
| DFS-05 | Deep analysis trigger (async n8n) | 24-04 (bu plan) |
| DFS-06 | n8n callback + workflow lifecycle | 24-04 (bu plan) |
| DFS-07 | dfs_fetched_at bulk update | 24-03 + 24-04 |
| DFS-08 | Concurrent guard | 24-03 + 24-04 |

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `deep-analysis/route.ts` mevcut | FOUND |
| `deep-analysis/callback/route.ts` mevcut | FOUND |
| `DeepAnalysisPoller.tsx` mevcut | FOUND |
| `triggerDeepAnalysisAction` actions.ts'de | FOUND |
| Commit f97911e mevcut | FOUND |
| Commit e52ab0e mevcut | FOUND |
| Commit 5f3a7ad mevcut | FOUND |
| TS hata sayısı: 20 (Plan 03'te 21 — azaldı) | PASS |
| X-N8n-Webhook-Secret her iki route'da | PASS |
| SUPABASE_SERVICE_ROLE_KEY her iki route'da | PASS |
| MAX_LOOPS = 144 DeepAnalysisPoller'da | PASS |
| dfs_fetched_at callback'te | PASS |
