---
phase: 05-keyword-import-enrichment
plan: 01
subsystem: api
tags: [dataforseo, server-action, keyword-enrichment, supabase]

requires:
  - phase: 04-competitor-intelligence
    provides: DataForSEO client.ts altyapısı (auth pattern, error pattern, result pattern)
  - phase: 02-project-core
    provides: keywords ve keyword_clusters tabloları, importKeywords Server Action temeli

provides:
  - fetchKeywordData fonksiyonu — DataForSEO keywords_data/google_ads/search_volume/live endpoint
  - KeywordDataItem tipi — search_volume, cpc, keyword_difficulty, search_intent alanları
  - importKeywords genişletilmiş — import sonrası otomatik enrichment akışı (sessiz fail)
  - deleteKeyword Server Action — üçlü ownership doğrulaması + küme cleanup
  - DeleteKeywordResult ve enrichedCount tipi

affects:
  - 05-02 (KeywordDeleteButton ve tablo UI doğrudan deleteKeyword'e bağımlı)
  - 06-keyword-scoring (enriched_at, search_intent alanları hazır)

tech-stack:
  added: []
  patterns:
    - "DataForSEO Keyword Data API çağrısı — toplu keyword listesi, google_ads/search_volume/live"
    - "Enrichment sessiz fail — try/catch içinde, import her zaman başarılı döner"
    - "deleteKeyword üçlü ownership — keywordId + projectId + user.id üçlüsü"
    - "Son keyword silinince küme otomatik temizlenir — count=0 koşulu"

key-files:
  created: []
  modified:
    - src/lib/dataforseo/client.ts
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts

key-decisions:
  - "D-05: Enrichment otomatik — import sonrası ayrı trigger yok; tek akış"
  - "D-06: DataForSEO verisi manuel değerlerin üstüne yazar (sistematik veri kazanır)"
  - "D-07: Enrichment başarısız olursa import başarılı sayılır; satırlar enriched_at=null kalır"
  - "D-08: keywords_data/google_ads/search_volume/live endpoint — Türkiye (2792, tr) varsayılan"
  - "D-12: deleteKeyword kümedeki son keyword silinince keyword_clusters da temizler"
  - "enrichedCount ImportKeywordsResult tipine eklendi — ileriki kullanım için hazır, UI'da gösterilmiyor"

patterns-established:
  - "fetchKeywordData — boş liste guard (length===0 ise erken dön, API çağrısı yapma)"
  - "enrichment bloğu — DB insert'ten sonra, revalidatePath'ten önce, try/catch içinde"
  - "deleteKeyword — önce ownership check (.single()), sonra delete, sonra count=0 küme cleanup"

requirements-completed: [KEYW-01, KEYW-02, KEYW-03]

duration: 2min
completed: 2026-04-24
---

# Phase 05 Plan 01: Keyword Enrichment Altyapısı Summary

**DataForSEO keyword_data/google_ads/search_volume/live client fonksiyonu + import-sonrası otomatik enrichment akışı + ownership doğrulamalı deleteKeyword Server Action**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-24T11:53:34Z
- **Completed:** 2026-04-24T11:55:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `fetchKeywordData` ve `KeywordDataItem` tipi `client.ts`'e eklendi — mevcut 4 fonksiyon değişmedi
- `importKeywords` enrichment akışıyla genişletildi: DB insert tamamlandıktan sonra DataForSEO'dan toplu veri çekip `keywords` tablosunu günceller; enrichment başarısız olsa bile import `success: true` döner
- `deleteKeyword` Server Action oluşturuldu: `keywordId + projectId + user.id` üçlü ownership doğrulaması, silinince kümede keyword kalmamışsa `keyword_clusters` da temizlenir

## Task Commits

1. **Task 1: fetchKeywordData fonksiyonunu client.ts'e ekle** — `f29edd3` (feat)
2. **Task 2: actions.ts — importKeywords enrichment + deleteKeyword** — `3b6f3f5` (feat)

## Files Created/Modified

- `src/lib/dataforseo/client.ts` — `KeywordDataItem` tipi ve `fetchKeywordData` fonksiyonu eklendi (dosya sonuna, mevcut kodlar korundu)
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — `getDataForSeoCredentials` + `fetchKeywordData` import'ları, `enrichedCount` alan eklentisi, enrichment bloğu, `deleteKeyword` + `DeleteKeywordResult` eklendi

## Decisions Made

- `enrichedCount` alanı `ImportKeywordsResult` success tipine eklendi — `KeywordImport.tsx` success mesajında gösterilmiyor (D-01 gereği UI değişmez), ileriki fazlar için hazır
- Enrichment bloğunda her keyword için ayrı `.update()` yapılıyor (toplu değil) — Supabase JS client parametreli sorgu zorunluluğu nedeniyle

## Deviations from Plan

Yok — plan tam olarak yazıldığı gibi uygulandı.

## Issues Encountered

Yok.

## Known Stubs

Yok — enrichment doğrudan `keywords` tablosunu güncelliyor; tüm veri akışı tamamlanmış durumda.

## Threat Flags

Plan frontmatter'da tanımlanan tüm tehditler (T-05-01-01 ile T-05-01-06) uygulandı:

- T-05-01-01: deleteKeyword üçlü ownership — `.eq('id', keywordId).eq('project_id', projectId).eq('user_id', user.id)`
- T-05-01-02: importKeywords proje sahipliği — `projects` tablosu `.eq('user_id', user.id)` ile doğrulandı
- T-05-01-03: credentials server-only vault.ts üzerinden — NEXT_PUBLIC_ prefix yok
- T-05-01-05: deleteKeyword `.eq('user_id', user.id)` ile delete kısıtlandı

Yeni güvenlik yüzeyi oluşturulmadı.

## Next Phase Readiness

- Plan 02 (`fetchKeywordData` ve `deleteKeyword` altyapısına bağımlı): tam hazır
- `KeywordDeleteButton.tsx` ve güncellenmiş `page.tsx` tablo görünümü Plan 02'de oluşturulacak
- `enriched_at` alanı tabloda `opacity-50` göstergesi için hazır (Plan 02'de kullanılacak)

## Self-Check: PASSED

- client.ts: FOUND
- actions.ts: FOUND
- SUMMARY.md: FOUND
- Commit f29edd3 (Task 1): FOUND
- Commit 3b6f3f5 (Task 2): FOUND

---
*Phase: 05-keyword-import-enrichment*
*Completed: 2026-04-24*
