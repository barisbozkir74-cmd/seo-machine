---
phase: 06-keyword-clustering-scoring
plan: "01"
subsystem: keyword-clustering-backend
tags: [clustering, scoring, server-actions, vitest, tdd]
dependency_graph:
  requires:
    - "05-keyword-import-enrichment (keywords tablosu, enriched_at)"
    - "src/lib/supabase/server.ts (createClient)"
  provides:
    - "clusterEnrichedKeywords — intent-first hibrid clustering fonksiyonu"
    - "calculateOpportunityScore — opportunity score hesaplama"
    - "clusterAndScoreKeywords Server Action — DB'ye kümeleme + skorlama yazar"
    - "moveKeywordToCluster Server Action — keyword cluster taşıma"
    - "setPrimaryKeyword Server Action — cluster primary keyword atama"
  affects:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx (Plan 02 UI için hazır)"
tech_stack:
  added:
    - "vitest@4.1.5 (devDependency)"
    - "vitest.config.ts (node environment)"
  patterns:
    - "Intent-first hibrid clustering: search_intent gruplaması + metin benzerliği alt kümeleme"
    - "Opportunity score: (volume×0.4) + (cpc×0.25) + (kd_ease×0.15) + (intent_weight×0.20)"
    - "Promise.all toplu UPDATE — Pitfall 4 önlemi"
    - "UUID regex validation tüm Server Actions'ta"
key_files:
  created:
    - src/lib/keywords/scoring.ts
    - src/lib/keywords/scoring.test.ts
    - src/lib/keywords/clustering.ts
    - src/lib/keywords/clustering.test.ts
    - src/lib/keywords/parser.ts
    - vitest.config.ts
  modified:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
    - package.json
decisions:
  - "Intent-first hibrid clustering seçildi: search_intent (Phase 5'ten hazır) + metin benzerliği; DataForSEO SERP URL overlap API maliyeti yok"
  - "Opportunity score ağırlıkları: volume 40%, CPC 25%, KD inverse 15%, intent multiplier 20%"
  - "Cluster name formatı: '${head_keyword} (${intent})' — UNIQUE(project_id, cluster_name) constraint çakışmasını önler (Pitfall 3)"
  - "parser.ts sıfırdan oluşturuldu: actions.ts import ediyordu ama dosya worktree'de yoktu"
metrics:
  duration_minutes: 9
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
---

# Phase 06 Plan 01: Keyword Clustering & Scoring Backend Summary

Intent-first hibrid clustering algoritması, opportunity score hesaplama, üç yeni Server Action ve vitest ile 15 birim testi.

## What Was Built

### Task 1: scoring.ts + Vitest kurulumu (commit: ae9a4e8)

`src/lib/keywords/scoring.ts` oluşturuldu:
- `calculateOpportunityScore(keyword, context)` — 0-100 arası, 1 ondalık hassasiyet
- `buildScoringContext(keywords)` — maxVolume + maxCpc batch normalizasyon bağlamı
- `INTENT_MULTIPLIERS` — transactional:1.0, commercial:0.85, informational:0.5, navigational:0.3

Vitest kuruldu (`vitest@4.1.5`), `vitest.config.ts` oluşturuldu, `package.json`'a `"test": "vitest run"` eklendi.
8 test, tümü geçiyor.

### Task 2: clustering.ts + parser.ts (commit: 07b59f1)

`src/lib/keywords/clustering.ts` oluşturuldu:
- `clusterEnrichedKeywords(keywords: ClusterInput[])` — intent gruplaması + metin benzerliği alt kümeleme
- `ClusterInput` ve `ClusterResult` tipleri
- `overlapsWithCluster` ve `getSignificantWords` yardımcı fonksiyonlar
- `clusterKeywords(ParsedKeyword[])` — orijinal fonksiyon; importKeywords action bağımlılığı için korundu

`src/lib/keywords/parser.ts` oluşturuldu — tab/virgül ayrımlı keyword metin parse (Rule 3 deviation).
7 test, tümü geçiyor.

### Task 3: actions.ts — 3 yeni Server Action (commit: e430c83)

`src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` genişletildi:

**clusterAndScoreKeywords(projectId):**
- UUID validation + getUser() + project ownership
- `enriched_at IS NOT NULL` filtresi (Pitfall 1 önlemi)
- DoS guard: keywords.length > 500 erken döner (T-06-03)
- clusterEnrichedKeywords çağrısı + buildScoringContext
- keyword_clusters UPSERT + keywords toplu UPDATE (Promise.all)
- primary_keyword_id otomatik atama (en yüksek volume)

**moveKeywordToCluster(keywordId, newClusterId, projectId):**
- Keyword ve hedef cluster'ın her ikisi için ownership doğrulama (T-06-01)
- primary_keyword_id: null temizleme (Pitfall 2 önlemi)
- Cannibalization prevention: cluster_id UPDATE eski değeri ezer

**setPrimaryKeyword(clusterId, keywordId, projectId):**
- `kw.cluster_id !== clusterId` tampering önleme (T-06-02)
- Keyword bu cluster'ın üyesi değilse hata döner

## Test Results

```
npx vitest run src/lib/keywords/
Test Files: 2 passed (2)
Tests: 15 passed (15)
  - scoring.test.ts: 8 tests passed
  - clustering.test.ts: 7 tests passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] clustering.ts ve parser.ts sıfırdan oluşturuldu**
- **Found during:** Task 2
- **Issue:** Plan "mevcut clustering.ts'i genişlet" diyordu; ancak worktree'de `src/lib/keywords/` dizini hiç mevcut değildi. Aynı şekilde `parser.ts` de yoktu — actions.ts bu dosyayı import ediyordu.
- **Fix:** Her iki dosyayı sıfırdan oluşturdum. clustering.ts'e hem orijinal `clusterKeywords` (ParsedKeyword tabanlı, importKeywords action bağımlılığı) hem de yeni `clusterEnrichedKeywords` fonksiyonları eklendi.
- **Files modified:** src/lib/keywords/clustering.ts, src/lib/keywords/parser.ts (yeni)

**2. [Rule 3 - Blocking] TypeScript compile pre-existing hataları — kapsam dışı**
- **Found during:** Task 3 verification
- **Issue:** `npx tsc --noEmit` bazı pre-existing hatalar döndürdü: page.tsx'de eksik bileşenler (KeywordImport, ProjectNav, SeoFetchButton, CompetitorDeleteButton) ve stage-transition.tsx TS18047.
- **Fix:** Bu plan'ın dosyalarına (scoring.ts, clustering.ts, actions.ts) ait TypeScript hatası yok. Pre-existing hatalar kapsam dışı — deferred-items'e not edildi.

## Known Stubs

Yok — tüm fonksiyonlar tam implementasyon içeriyor.

## Threat Surface Scan

Bu plan için `<threat_model>` tüm tehditleri kapsıyor ve mitigasyonlar uygulandı:
- T-06-01: moveKeywordToCluster çift ownership check
- T-06-02: setPrimaryKeyword kw.cluster_id === clusterId doğrulaması
- T-06-03: clusterAndScoreKeywords keywords.length > 500 guard
- T-06-04: getUser() + project ownership her action'da
- T-06-05: UUID regex validation tüm parametrelerde

Yeni threat surface bulunamadı.

## Self-Check: PASSED

### Created files exist:
- src/lib/keywords/scoring.ts: FOUND
- src/lib/keywords/scoring.test.ts: FOUND
- src/lib/keywords/clustering.ts: FOUND
- src/lib/keywords/clustering.test.ts: FOUND
- src/lib/keywords/parser.ts: FOUND
- vitest.config.ts: FOUND

### Commits exist:
- ae9a4e8: feat(06-01): scoring.ts — FOUND
- 07b59f1: feat(06-01): clustering.ts — FOUND
- e430c83: feat(06-01): actions.ts — FOUND
