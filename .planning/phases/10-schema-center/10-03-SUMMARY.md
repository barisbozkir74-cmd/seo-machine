---
phase: 10-schema-center
plan: "03"
subsystem: ui
tags: [typescript, react, page-packages, schema-jsonld, tab-navigation, client-component]

requires:
  - phase: 10-schema-center
    provides: schema_jsonld JSONB kolonu page_packages tablosuna eklendi (Plan 01)
  - phase: 10-schema-center
    provides: PagePackageData tipinde schema_jsonld alanı + SELECT sorgusu (Plan 02)

provides:
  - PagePackageEditor tab navigasyonu (Paket | Schema)
  - generateSchemaJsonLd pure function (page_type → JSON-LD mapping)
  - Schema sekmesi UI: boş durum + dolu durum (textarea, kopyala, schema üret)
  - handleSave schema_jsonld'yi de persist ediyor

affects: []

tech-stack:
  added: []
  patterns:
    - "Tab navigasyon: client-side activeTab state, pkg mevcut iken gösterilir"
    - "generateSchemaJsonLd: pure function, deterministik, page_type switch + FAQPage augmentation"
    - "Kopyala feedback: useState + setTimeout 2000ms pattern"
    - "Paket sekmesi sarma: pkg===null || activeTab==='paket' koşulu — yeni paket akışında form hep görünür"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx

key-decisions:
  - "generateSchemaJsonLd component dışı pure function olarak tanımlandı — test edilebilir, side-effect yok"
  - "Paket sekmesi koşulu pkg===null || activeTab==='paket': pkg yokken sekme bar görünmez ama form gösterilir (yeni paket akışı korunur)"
  - "Schema sekmesinde ayrı Kaydet butonu yok — mevcut handleSave akışına entegre (D-06)"
  - "font-medium yasak class — aktif tab font-semibold kullanıyor (CONTEXT.md zorunluluğu)"

metrics:
  duration: 12min
  completed: "2026-04-25"
---

# Phase 10 Plan 03: Schema Tab UI Summary

**PagePackageEditor'a Paket/Schema tab bar ve deterministik JSON-LD üretimi eklendi: generateSchemaJsonLd pure function + Schema sekmesi boş/dolu durum UI + Kopyala feedback + handleSave entegrasyonu**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-25T16:19:00Z
- **Completed:** 2026-04-25T16:31:04Z
- **Tasks:** 2 (Task 3 checkpoint)
- **Files modified:** 1

## Accomplishments

- `PageData.pkg` tipine `schema_jsonld: unknown` eklendi
- `generateSchemaJsonLd` pure function: homepage → `['Organization', 'WebSite']`, service/product/blog/category/landing/default mapping + FAQPage augmentation
- 3 yeni state: `schemaJsonLd`, `activeTab`, `copyStatus`
- `handleGenerateSchema` ve `handleCopySchema` handler'ları eklendi
- `handleSave`'e `schema_jsonld: parseJsonField(schemaJsonLd)` eklendi
- Tab bar: `pkg !== null` koşuluyla gösterilir, aktif tab `font-semibold` ile vurgulanır
- 9 section Paket sekmesi koşuluyla sarıldı (`pkg === null || activeTab === 'paket'`)
- Schema sekmesi: boş durum (2 açıklama satırı + Schema Üret CTA) + dolu durum (Label + Kopyala ghost buton + Field mono textarea + Schema Üret)
- Kopyala: `emerald-500` (copied) / `red-400` (error) / 2sn sonra idle
- TypeScript derleme hatası yok (`npx tsc --noEmit` 0 exit code)
- `font-medium` class yok (grep doğrulandı)

## Task Commits

1. **Task 1: PageData tipi + state + handler'lar** — `34c4b41` (feat)
2. **Task 2: Tab bar + Schema sekmesi UI** — `d962457` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — Tab navigasyon + generateSchemaJsonLd + Schema sekmesi UI (105 satır eklendi)

## Decisions Made

- `generateSchemaJsonLd` component dışı pure function — test edilebilir
- `pkg === null || activeTab === 'paket'` koşulu — yeni paket akışında form görünürlüğü korunuyor
- Mevcut `handleSave` entegrasyonu — ayrı kaydetme butonu yok (D-06 uygulandı)

## Deviations from Plan

**Verification count farkı (önemsiz):** Plan doğrulama `grep -c "schema_jsonld" → ≥5` bekliyordu; gerçek sonuç 4. Bunun nedeni: plan state satırındaki `setSchemaJsonLd` ve `pkg?.schema_jsonld` ifadelerini ayrı satır olarak saydı ancak bunlar aynı `useState(...)` satırında. Tüm done kriterleri (type, state, Field id, handleSave, generateSchemaJsonLd) tam olarak karşılanmıştır.

## Known Stubs

None — tüm veri akışı tam: DB → SELECT → prop → state → render → save.

## Threat Flags

None — yeni network endpoint, auth path veya schema değişikliği yok. Tüm tehditler 10-03-PLAN.md threat_model kapsamında belgelendi (T-10-03-01 ile T-10-03-05).

## Self-Check

```
FOUND: src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
FOUND: 34c4b41
FOUND: d962457
```

## Self-Check: PASSED

---
*Phase: 10-schema-center*
*Completed: 2026-04-25*
