---
phase: 03-rules-engine
plan: 01
subsystem: ui
tags: [shadcn, switch, supabase, server-actions, rules, next.js]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: rules tablosu şeması (id, user_id, project_id, scope, rule_key, rule_value)
  - phase: 02-project-core
    provides: Server Action pattern (auth guard, revalidatePath), tablo bileşeni, createClient()
provides:
  - src/components/ui/switch.tsx — shadcn Switch bileşeni
  - src/app/(dashboard)/ayarlar/kurallar/actions.ts — seedGlobalRules + toggleRule Server Actions
  - src/app/(dashboard)/ayarlar/kurallar/page.tsx — Global SEO kuralları sayfası (Server Component)
affects:
  - 03-02 (RuleToggleRow Client Component page.tsx'e entegre edilecek)
  - 03-03 (proje bazlı kural sayfası aynı RULE_META'yı referans alacak)

# Tech tracking
tech-stack:
  added: [shadcn Switch bileşeni]
  patterns:
    - Seed guard pattern: ilk açılışta boş sayfa yerine otomatik seed
    - upsert ile idempotent global kural oluşturma (onConflict: user_id,rule_key,scope)
    - Server Component veri çekimi + statik render (toggle interaktivitesi Plan 03-02'de)

key-files:
  created:
    - src/components/ui/switch.tsx
    - src/app/(dashboard)/ayarlar/kurallar/actions.ts
    - src/app/(dashboard)/ayarlar/kurallar/page.tsx
  modified: []

key-decisions:
  - "Seed guard pattern: rules tablosu boşsa seedGlobalRules() page.tsx içinde otomatik çağrılıyor — boş sayfa görünmez"
  - "toggleRule ve seedGlobalRules her çağrıda supabase.auth.getUser() ile auth doğrulaması yapıyor (T-03-01-01)"
  - "upsert onConflict: user_id,rule_key,scope — idempotent seed, duplicate kayıt oluşmuyor"
  - "Toggle interaktivitesi (RuleToggleRow) Plan 03-02'de eklenecek — bu planda statik değer gösterimi yeterli"

patterns-established:
  - "Seed guard: Server Component içinde veri yoksa action çağır, tekrar fetch et — hiçbir zaman boş sayfa"
  - "Rule value string olarak saklanıyor (rule_value: 'true' | 'false'), boolean'a dönüşüm page.tsx'de yapılıyor"

requirements-completed: [RULE-01, RULE-02]

# Metrics
duration: 12min
completed: 2026-04-23
---

# Phase 03 Plan 01: Switch Bileşeni + Global Kurallar Sayfası Summary

**shadcn Switch kurulumu, 12 boolean global SEO kuralı için seedGlobalRules/toggleRule Server Actions ve seed guard'lı /ayarlar/kurallar Server Component sayfası**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-23T00:00:00Z
- **Completed:** 2026-04-23T00:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- shadcn Switch bileşeni kuruldu (`src/components/ui/switch.tsx`)
- 12 global SEO kuralı için `seedGlobalRules` (upsert idempotent) ve `toggleRule` (auth guard + RLS) Server Actions yazıldı
- Global SEO kuralları sayfası oluşturuldu: 4 kategori altında 12 kural, seed guard ile boş sayfa engelleme, önerilen değerden sapan kurallar `text-amber-400` ile işaretleniyor

## Task Commits

Her task atomik olarak commit edildi:

1. **Task 1: Switch bileşeni + Server Actions** - `faad787` (feat)
2. **Task 2: Global kurallar sayfası** - `0f6274f` (feat)

## Files Created/Modified
- `src/components/ui/switch.tsx` - shadcn Switch bileşeni (npx shadcn add switch)
- `src/app/(dashboard)/ayarlar/kurallar/actions.ts` - seedGlobalRules (12 kural, upsert) ve toggleRule (auth guard, RLS korumalı inline güncelleme)
- `src/app/(dashboard)/ayarlar/kurallar/page.tsx` - GlobalKurallarPage Server Component: seed guard, RULE_META (12 kural), CATEGORIES (4 kategori), tablo render

## Decisions Made
- Seed guard pattern seçildi: `if (!rules || rules.length === 0)` kontrolü page.tsx Server Component içinde yapılıyor — kullanıcı hiçbir zaman boş sayfa görmüyor
- Toggle interaktivitesi (RuleToggleRow Client Component) bu plana dahil edilmedi — statik değer gösterimi şimdilik yeterli, Plan 03-02'de eklenecek

## Deviations from Plan

None — plan tam olarak belirtildiği şekilde uygulandı.

**Not:** `npx tsc --noEmit` çalıştırıldığında `stage-transition.tsx` dosyasında pre-existing TypeScript hatası (`'activeStage' is possibly 'null'`) tespit edildi. Bu hata bu planın kapsamı dışında, mevcut dosyada; deferred items'a kaydedildi.

## Known Stubs

- **page.tsx — Toggle Durum Sütunu:** `<span className="text-xs text-muted-foreground">{currentValue ? 'Açık' : 'Kapalı'}</span>` satırı Plan 03-02'de `RuleToggleRow` Client Component ile değiştirilecek. Değer doğru gösteriliyor ancak toggle interaktivitesi henüz yok.

## Issues Encountered

- Pre-existing TypeScript hatası `src/app/(dashboard)/projeler/[id]/stage-transition.tsx:71` — `'activeStage' is possibly 'null'`. Bu plan kapsamı dışında; kapsam dışı olduğu için fix edilmedi. Deferred items'a kaydedildi.

## User Setup Required

None — harici servis konfigürasyonu gerekmiyor. Supabase `rules` tablosu Phase 1'de oluşturuldu; `upsert onConflict: user_id,rule_key,scope` unique constraint Phase 1 migration'ında tanımlı olmalı.

## Next Phase Readiness

- Plan 03-02: `RuleToggleRow` Client Component oluşturulacak, page.tsx'deki statik span değiştirilecek
- Plan 03-03: Proje bazlı kural override sayfası — `RULE_META` ve `CATEGORIES` constants bu planın dosyasından import edilebilir

---
*Phase: 03-rules-engine*
*Completed: 2026-04-23*
