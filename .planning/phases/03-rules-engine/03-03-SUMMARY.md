---
phase: 03-rules-engine
plan: 03
subsystem: ui
tags: [next.js, supabase, server-component, rules, navigation, shadcn, override]

# Dependency graph
requires:
  - phase: 03-01
    provides: RULE_META sabitleri, global kurallar sayfası
  - phase: 03-02
    provides: RuleToggleRow Client Component, toggleProjectRule + resetProjectRule Server Actions
  - phase: 02-project-core
    provides: 2 sütunlu layout pattern, auth guard, projeler/[id]/page.tsx

provides:
  - src/app/(dashboard)/projeler/[id]/kurallar/page.tsx — proje bazlı kural override sayfası
  - src/lib/rules/rule-meta.ts — RULE_META ve CATEGORIES ortak sabit
  - src/app/(dashboard)/layout.tsx — üst nav: Projeler + Ayarlar linkleri
  - src/app/(dashboard)/projeler/[id]/page.tsx — sol sütun: Separator + Proje Kuralları linki

affects:
  - Phase 4+ (RULE_META sabiti paylaşılabilir, navigation tamamlandı)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shared constant extraction: RULE_META + CATEGORIES inline'dan src/lib/rules/rule-meta.ts'ye taşındı — iki sayfada import
    - resolvedRules merge pattern: global map + projectOverrides map birleştirmesi, scope='project'|'global' type-safe
    - toggleProjectRule.bind(null, id) — Server Action partial application ile proje ID sabitlendi

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/kurallar/page.tsx
    - src/lib/rules/rule-meta.ts
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/projeler/[id]/page.tsx
    - src/app/(dashboard)/ayarlar/kurallar/page.tsx

key-decisions:
  - "RULE_META ve CATEGORIES sabitleri rule-meta.ts'e çıkarıldı — hem global hem proje sayfasında import edildi, duplicate kod ortadan kalktı"
  - "resolvedRules type: scope alanı 'global' | 'project' olarak explicit type annotation ile TypeScript hatasız derlendi"
  - "layout.tsx'e Projeler + Ayarlar üst nav eklendi — server-side auth guard korundu (T-03-05)"
  - "Sol sütun Proje Kuralları linki non-active stil (hover:bg-secondary) — kurallar sayfasında ise aktif stil (bg-secondary font-semibold)"

patterns-established:
  - "resolvedRules merge: projectOverrides ve globalValues map'leri birleştirilir; proje override varsa 'project', yoksa 'global' scope döner"
  - "Server Action bind pattern: toggleProjectRule.bind(null, id) ile Server Component'ten Client'a proje ID sabitlenerek geçirilir"

requirements-completed: [RULE-01, RULE-02, RULE-03]

# Metrics
duration: 10min
completed: 2026-04-23
---

# Phase 03 Plan 03: Proje Kuralları Sayfası + Navigasyon Summary

**Proje bazlı kural override sayfası (global+proje merge, scope badge, resetAction), dashboard üst nav ve proje sol sütunu navigasyon linkleriyle Phase 3 tamamlandı**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-23T00:35:00Z
- **Completed:** 2026-04-23T00:45:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 oluşturuldu, 2 güncellendi)

## Accomplishments

- `src/lib/rules/rule-meta.ts` oluşturuldu — RULE_META (12 kural) ve CATEGORIES (4 kategori) sabitlerinin merkezi noktası; global ve proje sayfaları buradan import ediyor
- `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` oluşturuldu — 2 sütunlu layout, global+proje override birleştirmesi (`resolvedRules`), RuleToggleRow prop injection ve scope-aware resetAction
- Dashboard `layout.tsx` güncellendi: Projeler + Ayarlar üst nav linkleri eklendi
- `projeler/[id]/page.tsx` güncellendi: Stage listesi sonuna Separator + Proje Kuralları linki eklendi

## Task Commits

Her task atomik olarak commit edildi:

1. **Task 1: Proje kuralları sayfası + rule-meta.ts** - `9c7045b` (feat)
2. **Task 2: Dashboard üst nav + proje detay Proje Kuralları linki** - `a591858` (feat)

## Files Created/Modified

- `src/lib/rules/rule-meta.ts` — RULE_META ve CATEGORIES ortak sabitleri (yeni)
- `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` — proje kural override sayfası: global+proje merge, scope badge, resetAction (yeni)
- `src/app/(dashboard)/layout.tsx` — üst nav: Projeler + Ayarlar Link bileşenleri eklendi (güncellendi)
- `src/app/(dashboard)/projeler/[id]/page.tsx` — sol sütun: Separator + Proje Kuralları linki eklendi (güncellendi)
- `src/app/(dashboard)/ayarlar/kurallar/page.tsx` — inline RULE_META/CATEGORIES kaldırıldı, rule-meta.ts'den import (güncellendi)

## Decisions Made

- `RULE_META` ve `CATEGORIES` sabitlerini `rule-meta.ts`'e çıkarma kararı alındı — plan executor tercihini kabul ediyordu; duplicate kod yerine DRY yaklaşım seçildi
- `resolvedRules` nesnesinde `scope` alanı `'global' | 'project'` union type ile explicit annotated yapıldı — TypeScript hata (TS2322) düzeltildi
- `projeler/[id]/page.tsx`'te Separator import mevcut olduğu için ek import gerekmedi (plan notu doğrulandı)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS2322: resolvedRules scope tipi**
- **Found during:** Task 1 (ProjeKurallarPage oluşturulması)
- **Issue:** `resolvedRules` map'inde `scope` alanı `string` olarak çıkarımlandı; `RuleToggleRow` props'u `'global' | 'project'` union bekliyordu — TS2322 hatası
- **Fix:** `const scope: 'global' | 'project' = hasOverride ? 'project' : 'global'` explicit annotation eklendi
- **Files modified:** src/app/(dashboard)/projeler/[id]/kurallar/page.tsx
- **Verification:** `npx tsc --noEmit` — sadece pre-existing stage-transition.tsx hatası kaldı
- **Committed in:** 9c7045b (Task 1 commit)

**2. [Rule 2 - Missing] RULE_META duplicate kodu rule-meta.ts'e çıkardı**
- **Found during:** Task 1 (ayarlar/kurallar/page.tsx'i inceleme)
- **Issue:** Plan her iki yaklaşımı kabul ediyordu; inline vs ortak dosya — duplicate 30 satır kod gözlemlendi
- **Fix:** `src/lib/rules/rule-meta.ts` oluşturuldu, `ayarlar/kurallar/page.tsx` güncellenerek import'a geçirildi
- **Files modified:** src/lib/rules/rule-meta.ts (yeni), src/app/(dashboard)/ayarlar/kurallar/page.tsx
- **Verification:** Her iki sayfa TypeScript hatasız derlendi
- **Committed in:** 9c7045b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Her iki düzeltme doğruluk için gerekliydi. Kapsam genişlemesi yok.

## Known Stubs

Yok — tüm navigasyon linkleri ve proje kural sayfası tamamen işlevsel.

## Threat Flags

Yok — tüm güven sınırları plan threat_model'inde belgelenmiş (T-03-03-01...T-03-03-05). Auth guard ve ownership check uygulandı.

## Issues Encountered

- TypeScript TS2322: scope union tip çıkarımı — explicit annotation ile giderildi (Rule 1)
- Pre-existing `stage-transition.tsx:71` TypeScript hatası (`'activeStage' is possibly 'null'`) bu plan kapsamı dışında; dokunulmadı

## User Setup Required

Yok — harici servis konfigürasyonu gerekmiyor.

## Next Phase Readiness

- Phase 3 (Rules Engine) tamamen tamamlandı — RULE-01, RULE-02, RULE-03 gereksinimleri karşılandı
- Global kurallar sayfası, proje kural override sayfası ve navigasyon tüm flow'ları bağladı
- Phase 4 için `RULE_META` sabiti `src/lib/rules/rule-meta.ts`'den import edilebilir
- Pre-existing `stage-transition.tsx` TypeScript hatası Phase 4 veya ayrı bir fix planında ele alınmalı

---
*Phase: 03-rules-engine*
*Completed: 2026-04-23*
