---
phase: "24"
plan: "03"
subsystem: "dataforseo-validation-layer"
tags: ["server-actions", "analysis-buttons", "concurrent-guard", "dfs_fetched_at", "cost-dialog", "tdd"]
dependency_graph:
  requires: ["24-01", "24-02"]
  provides: ["lightAnalysisAction", "standardAnalysisAction", "AnalysisButtons", "dfs_fetched_at-display"]
  affects: ["keyword-stratejisi/page.tsx", "keyword-stratejisi/actions.ts"]
tech_stack:
  added: []
  patterns:
    - "getCachedOrFetch cache-first pattern (Plan 02 foundation)"
    - "useTransition + Server Action (ClusterButton analog)"
    - "shadcn Dialog cost approval"
    - "concurrent guard via workflow_runs"
    - "TDD RED/GREEN cycle"
key_files:
  created:
    - "src/__tests__/lib/dataforseo/analysis.test.ts"
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx"
  modified:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts"
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx"
decisions:
  - "KeywordFlatList.tsx mevcut değil — DFS Tarihi sütunu page.tsx flat table'a eklendi (inlined)"
  - "fetchSerpDomains import void guard ile korundu — Phase 25 için"
  - "DialogDescription asChild TS hatası nedeniyle sr-only pattern kullanıldı"
  - "AnalysisButtons page.tsx'de toolbar'ın yanına render edildi — KeywordStratejisiToolbar değiştirilmedi"
metrics:
  duration: "~25 dakika"
  completed_date: "2026-05-31"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 24 Plan 03: Analysis Actions + UI Summary

Light/standard analiz Server Action'ları getCachedOrFetch üzerinden implement edildi; 3-buton cyan AnalysisButtons bileşeni cost dialog + concurrent guard ile oluşturuldu; dfs_fetched_at sütunu SSR query ve flat table'a eklendi.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | lightAnalysisAction + standardAnalysisAction + test stub | 9e055e7 | actions.ts, analysis.test.ts |
| 2 | AnalysisButtons.tsx — 3 buton + cost dialog + concurrent guard | fe00951 | AnalysisButtons.tsx |
| 3 | page.tsx + dfs_fetched_at sütunu + AnalysisButtons entegrasyonu | c66dad3 | page.tsx |

---

## What Was Built

### Task 1: Server Actions (TDD)

**RED phase:** `analysis.test.ts` 6 test yazıldı (UUID guard, concurrent guard, keyword gate, cluster gate). Testler başlangıçta fail etti.

**GREEN phase:** `lightAnalysisAction` ve `standardAnalysisAction` actions.ts'e eklendi:

- **lightAnalysisAction** (DFS-03, DFS-07, DFS-08): UUID validation → auth → ownership → concurrent guard (workflow_runs) → keywords.limit(50) → getDataForSeoCredentials → getCachedOrFetch(keyword_data/search_volume) → dfs_fetched_at update → revalidatePath
- **standardAnalysisAction** (DFS-04, DFS-07, DFS-08): Aynı akış + cluster varlık kontrolü, labs/related_keywords endpoint
- **Type exports:** `LightAnalysisResult`, `StandardAnalysisResult`
- **Threat model uygulandı:** T-24-10 (UUID regex), T-24-01 (ownership .eq user_id), T-24-11 (.limit 50), T-24-04 (concurrent guard workflow_runs)

**Test sonucu:** 9/9 test (6 yeni + 3 mevcut cache.test.ts)

### Task 2: AnalysisButtons.tsx

3 cyan buton bileşeni UI-SPEC.md'deki tüm state machine'ler uygulanarak oluşturuldu:

- **3 buton:** Temel Verileri Al, Standart Analiz, Derinlemesine Analiz
- **Stil:** `border-cyan-500/30 bg-cyan-500/10 text-cyan-400` (3 buton + dialog onay butonu)
- **Cost approval dialog:** per-level başlık, maliyet tahmini (~{count} birim), destructive uyarı (deep)
- **Concurrent guard banner:** `bg-amber-500/10 border border-amber-500/20 text-amber-300` — isAnalysisRunning prop'undan
- **Inline result:** success (emerald), cache (muted), partial (amber), error (destructive)
- **Disabled states:** no-keywords, no-clusters (standard), concurrent (tüm butonlar)
- **Spinner:** Veriler Çekiliyor... / Analiz Yapılıyor... loading label'ları

### Task 3: page.tsx Güncellemeleri

- **KeywordRow type:** `dfs_fetched_at: string | null` eklendi
- **SSR query:** `dfs_fetched_at` select string'e dahil edildi
- **workflow_runs SSR:** `dfs_deep_analysis` pending/running `activeWorkflow` sorgusu
- **clusterCount SSR:** `keyword_clusters` count sorgusu
- **AnalysisButtons:** separator + render (toolbar'ın sağında, `<span className="h-4 w-px bg-border/50">` ile ayrılmış)
- **DFS Tarihi sütunu:** `text-cyan-400/70` başlık, 3-state hücre (Veri yok / Güncel değil / tarih)
- **enriched_at:** değiştirilmedi

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test UUID formatı regex'i geçemiyordu**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test dosyasındaki `'proj-uuid-001'` gibi kısa ID'ler `/^[0-9a-f-]{36}$/i` regex'ini geçemiyordu
- **Fix:** Test ID'leri `'00000000-0000-0000-0000-000000000001'` formatına güncellendi
- **Files modified:** `src/__tests__/lib/dataforseo/analysis.test.ts`
- **Commit:** 9e055e7

**2. [Rule 3 - Blocking] DialogDescription asChild TS hatası**
- **Found during:** Task 2
- **Issue:** `DialogDescription` bileşeni `asChild` prop'unu desteklemiyor — TS2322 hatası
- **Fix:** `asChild` kaldırıldı; `sr-only` DialogDescription + inline `<div>` pattern kullanıldı
- **Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AnalysisButtons.tsx`
- **Commit:** fe00951

**3. [Rule 1 - Bug] KeywordFlatList.tsx mevcut değil**
- **Found during:** Task 3
- **Issue:** Plan `KeywordFlatList.tsx` modifikasyonu öngörüyordu ama dosya codebase'de bulunmuyor; flat liste `page.tsx` içinde satır içi render ediliyor
- **Fix:** DFS Tarihi sütunu ve dfs_fetched_at TableCell doğrudan `page.tsx` flat table section'ına eklendi; `isDfsStale` ve `formatDfsDate` helper'lar page.tsx üstüne yerleştirildi
- **Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx`
- **Commit:** c66dad3

**4. [Rule 2 - Correctness] fetchSerpDomains import guard**
- **Found during:** Task 1
- **Issue:** Plan `fetchSerpDomains` import'unu belirtiyordu ama action'da kullanılmıyordu — unused import TS uyarısı riski
- **Fix:** `void (fetchSerpDomains as unknown)` guard ile Phase 25 için import korundu ve açıklama eklendi
- **Files modified:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts`

---

## Known Stubs

Yok. Tüm fonksiyonlar implement edildi ve veri kaynaklarına bağlandı.

---

## Threat Flags

Plan'daki threat model tam olarak uygulandı:
- T-24-10: UUID regex — `lightAnalysisAction` ve `standardAnalysisAction` başında
- T-24-01: `.eq('user_id', user.id)` her Supabase sorgusunda
- T-24-11: `.limit(50)` her keyword sorgusunda
- T-24-04: `workflow_runs .in('status', ['pending','running']) .maybeSingle()` her action başında

Yeni threat surface eklenmedi.

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `analysis.test.ts` mevcut | FOUND |
| `AnalysisButtons.tsx` mevcut | FOUND |
| Commit 9e055e7 mevcut | FOUND |
| Commit fe00951 mevcut | FOUND |
| Commit c66dad3 mevcut | FOUND |
| 9/9 test geçiyor | PASS |
| TS hata sayısı değişmedi (21) | PASS |
