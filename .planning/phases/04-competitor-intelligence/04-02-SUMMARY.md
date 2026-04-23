---
phase: 04-competitor-intelligence
plan: "02"
subsystem: api
tags: [server-actions, dataforseo, supabase, competitor-intelligence, ownership-check]

dependency_graph:
  requires:
    - phase: 04-01
      provides:
        - getDataForSeoCredentials (src/lib/supabase/vault.ts)
        - fetchSerpDomains (src/lib/dataforseo/client.ts)
        - fetchTopPages (src/lib/dataforseo/client.ts)
        - extractCategories (src/lib/competitors/url-categories.ts)
  provides:
    - addCompetitor (src/app/(dashboard)/projeler/[id]/rakipler/actions.ts)
    - discoverCompetitors (src/app/(dashboard)/projeler/[id]/rakipler/actions.ts)
    - addCompetitors (src/app/(dashboard)/projeler/[id]/rakipler/actions.ts)
    - fetchCompetitorData (src/app/(dashboard)/projeler/[id]/rakipler/actions.ts)
    - fetchOwnDomainData (src/app/(dashboard)/projeler/[id]/rakipler/actions.ts)
  affects:
    - 04-03-PLAN.md (page.tsx bu action'ları import edecek)

tech-stack:
  added: []
  patterns:
    - Server Action ownership check: auth guard (getUser) + verifyProjectOwnership helper
    - Triple ownership filter: competitorId + projectId + user_id (T-04-05)
    - discoverCompetitors DB'ye yazmaz — sadece domain[] döner, addCompetitors ile ayrı commit
    - fetchOwnDomainData null döner hatada — UI "veri çekilmedi" mesajı gösterir

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/rakipler/actions.ts
  modified: []

key-decisions:
  - "discoverCompetitors DB'ye yazmaz — sadece domain listesi döner; kullanıcı seçtikten sonra addCompetitors() çağrılır (D-04 dialog flow)"
  - "top_pages JSONB'de title yok — DataForSEO Relevant Pages endpoint'te title gelmiyor (RESEARCH.md Pitfall 1)"
  - "updated_at manuel set edildi — kullanıcı son çekim zamanını görebilir (D-06)"
  - "fetchOwnDomainData sonucu DB'ye yazılmaz — SSR page.tsx'e döner, null dönerse gap tablosunda uyarı gösterilir (Q3 RESOLVED)"
  - "verifyProjectOwnership yardımcı fonksiyon: 4 action'da tekrar eden ownership check DRY pattern"

requirements-completed: [COMP-01, COMP-02, COMP-03]

duration: 2min
completed: 2026-04-23
---

# Phase 4 Plan 02: Rakip Yönetimi Server Actions

**4 Server Action (addCompetitor, discoverCompetitors, addCompetitors, fetchCompetitorData) + fetchOwnDomainData — tam auth guard, triple ownership filter, DataForSEO entegrasyonu ve JSONB UPDATE ile COMP-01/02/03 gereksinimleri karşılandı.**

## Performance

- **Duration:** 2 dakika
- **Started:** 2026-04-23T01:21:53Z
- **Completed:** 2026-04-23T01:23:52Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- COMP-01: addCompetitor() — manuel rakip ekleme, www. + https:// normalizasyonu, source='manual', auth guard + ownership check
- COMP-02: discoverCompetitors() (DB'ye yazmaz, keyword 1-3 sınırı, DoS koruması T-04-07) + addCompetitors() (toplu INSERT, source='serp')
- COMP-03: fetchCompetitorData() — DataForSEO Relevant Pages → top_pages + category_structure JSONB UPDATE; triple ownership filter (T-04-05)
- D-10: fetchOwnDomainData() — kullanıcı domain kategorileri DB'ye yazılmadan SSR'a döner, null-safe
- verifyProjectOwnership() helper DRY pattern — 4 action'da tekrar eden ownership check tek yerde

## Task Commits

1. **Task 1: addCompetitor + discoverCompetitors + addCompetitors** - `d90a7b8` (feat)
2. **Task 2: fetchCompetitorData + fetchOwnDomainData** - `4cdb9ad` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts` — 5 export function + 2 export type + 1 private helper; tüm DataForSEO çağrıları + auth + ownership mantığı burada

## Decisions Made

- discoverCompetitors DB'ye yazmaz — sadece domain[] döner; kullanıcı seçtikten sonra addCompetitors() çağrılır (D-04 dialog flow)
- top_pages JSONB'de title yok — DataForSEO Relevant Pages endpoint'te title gelmiyor (RESEARCH.md Pitfall 1 uyarısı)
- updated_at manuel set edildi — kullanıcı son çekim zamanını görebilir (D-06)
- fetchOwnDomainData sonucu DB'ye yazılmaz — SSR page.tsx'e döner, null dönerse gap tablosunda uyarı gösterilir (Q3 RESOLVED)
- verifyProjectOwnership yardımcı fonksiyon: 4 action'da tekrar eden ownership check DRY pattern

## Deviations from Plan

Yok — plan tam olarak yazıldığı gibi çalıştırıldı.

## Issues Encountered

- `stage-transition.tsx`'te TypeScript TS18047 hatası (`activeStage possibly null`) mevcut — bu dosya bu plan kapsamında değiştirilmedi; pre-existing issue, kapsam dışı. `rakipler/actions.ts` TypeScript-temiz (npx tsc --noEmit sadece ilgisiz dosyada hata veriyor).

## Known Stubs

Yok — bu plan pure server-side logic içeriyor, UI stub'ı yok.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-04-04 MITIGATED | actions.ts | DataForSEO credentials getDataForSeoCredentials() vault.ts'den import — server-only chain; client bundle'a sızmaz |
| T-04-05 MITIGATED | actions.ts | fetchCompetitorData triple filter: competitorId + projectId + user_id — başka kullanıcının verisi okunamaz |
| T-04-06 MITIGATED | actions.ts | domain.replace() sanitize + Supabase parameterized query — injection yok |
| T-04-07 MITIGATED | actions.ts | keyword sayısı 1-3 ile sınırlandırıldı — DoS koruması |

## Next Phase Readiness

- Wave 3 (04-03): `rakipler/page.tsx` + Dialog bileşenleri bu action'ları import ederek kullanabilir
- `addCompetitor`, `discoverCompetitors`, `addCompetitors`, `fetchCompetitorData` fonksiyon imzaları Wave 3 için hazır
- `fetchOwnDomainData` gap analiz tablosu için SSR'da çağrılabilir

## Self-Check: PASSED

- [x] `src/app/(dashboard)/projeler/[id]/rakipler/actions.ts` FOUND
- [x] export async function addCompetitor FOUND
- [x] export async function discoverCompetitors FOUND
- [x] export async function addCompetitors FOUND
- [x] export async function fetchCompetitorData FOUND
- [x] export async function fetchOwnDomainData FOUND
- [x] Commit d90a7b8 FOUND
- [x] Commit 4cdb9ad FOUND

---
*Phase: 04-competitor-intelligence*
*Completed: 2026-04-23*
