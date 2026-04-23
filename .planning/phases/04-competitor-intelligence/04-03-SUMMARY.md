---
phase: 04-competitor-intelligence
plan: "03"
subsystem: ui
tags: [server-component, client-component, gap-analysis, dialog, competitor-intelligence, next.js]

dependency_graph:
  requires:
    - phase: 04-01
      provides:
        - extractCategories (src/lib/competitors/url-categories.ts)
    - phase: 04-02
      provides:
        - addCompetitor (actions.ts)
        - discoverCompetitors (actions.ts)
        - addCompetitors (actions.ts)
        - fetchCompetitorData (actions.ts)
        - fetchOwnDomainData (actions.ts)
  provides:
    - rakipler/page.tsx (Server Component — rakip listesi + gap analizi)
    - CompetitorDiscoveryDialog.tsx (Client Component — 2-adımlı SERP keşif)
    - CompetitorFetchButton.tsx (Client Component — veri çek + loading state)
    - OwnDomainAnalyzeButton.tsx (Client Component — kendi domain analizi tetikleyici)
  affects: []

tech-stack:
  added: []
  patterns:
    - Server Component SSR gap raporu hesaplama (buildGapReport pure function)
    - Client Component inline Server Action import (dynamic import pattern, OwnDomainAnalyzeButton)
    - 2-adımlı dialog state machine (keyword-input → domain-select step)
    - addCompetitor.bind(null, id) inline Server Action form action
    - Badge className direkt renk — variant prop yok (PROJECT.md pattern)

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/rakipler/page.tsx
    - src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx
    - src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx
    - src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx
  modified: []

key-decisions:
  - "buildGapReport SSR'da çalışır — kategori union hesabı client'ta değil server'da yapılır (COMP-04)"
  - "Diğer kategori gap tablosundan filtreli — anlamsız karşılaştırma yaratır (04-RESEARCH.md Pitfall 5)"
  - "OwnDomainAnalyzeButton dynamic import: server action'ı client'ta import etmenin en temiz yolu"
  - "DialogTrigger render prop pattern — @base-ui/react asChild desteklemiyor (D-03)"
  - "Kullanıcı domain'i gap tablosunda ilk sütun olarak gösterilir (D-10)"

requirements-completed: [COMP-01, COMP-02, COMP-03, COMP-04]

duration: 5min
completed: 2026-04-23
---

# Phase 4 Plan 03: Rakipler Sayfası UI — Server Component + Client Components

**rakipler/page.tsx Server Component ile rakip listesi + SSR gap analizi tablosu; CompetitorDiscoveryDialog 2-adımlı SERP keşif flow; CompetitorFetchButton loading state ile veri çek butonu — COMP-01/02/03/04 tüm UI'ları tamamlandı.**

## Performance

- **Duration:** ~5 dakika
- **Started:** 2026-04-23T01:26:18Z
- **Completed:** 2026-04-23T01:31:00Z
- **Tasks:** 2
- **Files modified:** 4 (tümü yeni)

## Accomplishments

- COMP-01: Manuel domain ekleme formu — `addCompetitor.bind(null, id)` form action olarak bağlandı
- COMP-02: 2-adımlı `CompetitorDiscoveryDialog` — keyword giriş → SERP domain listesi → checkbox seçim → toplu ekle
- COMP-03: `CompetitorFetchButton` — her rakip satırında, `isPending` loading state, son çekim tarihi gösterimi
- COMP-04: `buildGapReport()` SSR'da hesaplanır — satır=kategori, ilk sütun=Sizin Siteniz (D-10), sonraki sütunlar=rakipler
- `OwnDomainAnalyzeButton` — `ownCategoryData` null ise kullanıcıya kendi domain analizini tetikleme imkânı

## Task Commits

1. **Task 1: CompetitorFetchButton + CompetitorDiscoveryDialog Client Components** - `3bf98ba` (feat)
2. **Task 2: rakipler/page.tsx Server Component + OwnDomainAnalyzeButton** - `a098e39` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` — Server Component; auth guard, ownership check, rakip listesi, gap raporu SSR, 2-sütunlu layout (kurallar page.tsx template)
- `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` — Client Component; 2-adımlı dialog (keyword-input → domain-select), discoverCompetitors + addCompetitors bağlantısı
- `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx` — Client Component; fetchCompetitorData bağlantısı, isPending/error state, lastFetched tarih gösterimi
- `src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx` — Client Component; ownCategoryData null ise render edilir, window.location.reload() ile sayfa yenileme

## Decisions Made

- `buildGapReport` SSR'da hesaplanır — React Server Component içinde pure function olarak tanımlandı; client'a sıfır bundle maliyeti
- "Diğer" kategorisi gap tablosundan filtrelendi — anlamsız karşılaştırma yaratır (04-RESEARCH.md Pitfall 5)
- `OwnDomainAnalyzeButton`'da `dynamic import('./actions')` — server-only modülü client'ta doğrudan import edilemez
- `DialogTrigger render={<Button>}` pattern — @base-ui/react, asChild prop yok (D-03 kararı)
- Gap tablosu ilk data sütunu "Sizin Siteniz" — `gapReport.matrix[project.domain]` ile kullanıcı domain verisi render edilir (D-10)

## Deviations from Plan

Yok — plan tam olarak yazıldığı gibi çalıştırıldı.

## Issues Encountered

- `stage-transition.tsx` TS18047 pre-existing TypeScript hatası (`activeStage possibly null`) — bu plan kapsamında değil, 04-02 SUMMARY'de de belgelenmiş. Yeni dosyalarımız TypeScript-temiz.

## Known Stubs

Yok — tüm bileşenler gerçek server action'larla bağlı. DataForSEO credentials mevcut değilse runtime'da hata mesajı döner; UI stub yok.

## Threat Flags

Yok — yeni ağ endpoint veya auth path açılmadı. Mevcut threat model kapsamında:
- T-04-08 MITIGATED: `eq('project_id', id).eq('user_id', user.id)` her iki filtre page.tsx'de mevcut; `if (!user) notFound()` auth guard aktif
- T-04-09 ACCEPTED: Client'ta sadece server'dan dönen domain'ler gösterilir
- T-04-10 ACCEPTED: `disabled={isPending}` — paralel tıklama koruması
- T-04-11 MITIGATED: `addCompetitor` server action domain normalize ediyor

## Next Phase Readiness

- Phase 4 (04-competitor-intelligence) tamamlandı — tüm 3 plan (04-01, 04-02, 04-03) hazır
- `/projeler/[id]/rakipler` route tam çalışır durumda
- COMP-01, COMP-02, COMP-03, COMP-04 gereksinimleri karşılandı

## Self-Check: PASSED

- [x] `src/app/(dashboard)/projeler/[id]/rakipler/page.tsx` FOUND
- [x] `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorDiscoveryDialog.tsx` FOUND
- [x] `src/app/(dashboard)/projeler/[id]/rakipler/CompetitorFetchButton.tsx` FOUND
- [x] `src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx` FOUND
- [x] Commit 3bf98ba FOUND
- [x] Commit a098e39 FOUND
- [x] `Gap Analizi` başlığı page.tsx'de FOUND
- [x] `buildGapReport` 3 parametre alıyor FOUND
- [x] `Sizin Siteniz` gap tablosu ilk sütun FOUND
- [x] `DialogTrigger render={` pattern (asChild yok) FOUND

---
*Phase: 04-competitor-intelligence*
*Completed: 2026-04-23*
