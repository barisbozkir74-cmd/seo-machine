---
phase: 03-rules-engine
plan: 02
subsystem: ui
tags: [client-component, server-actions, optimistic-ui, rules, supabase, next.js]

# Dependency graph
requires:
  - phase: 03-01
    provides: switch.tsx, toggleRule Server Action, global kurallar sayfası (statik)
  - phase: 01-foundation
    provides: rules tablosu şeması (unique constraint user_id,project_id,rule_key,scope)
provides:
  - src/components/rules/RuleToggleRow.tsx — optimistic toggle + rollback + loading state Client Component
  - src/app/(dashboard)/projeler/[id]/kurallar/actions.ts — toggleProjectRule + resetProjectRule Server Actions
  - src/app/(dashboard)/ayarlar/kurallar/page.tsx — RuleToggleRow ile interactive toggle wire
affects:
  - 03-03 (proje kural sayfası toggleProjectRule.bind(null, projectId) ile aynı RuleToggleRow'u kullanacak)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic UI: useState(currentValue) → setLocalValue(checked) → rollback on error
    - Server Action prop injection: toggleAction prop ile global/proje sayfaları ayrı action geçiriyor
    - Ownership double-check: auth.getUser() + projects table query her project action'da
    - upsert onConflict: user_id,project_id,rule_key,scope — project-scope override idempotent

key-files:
  created:
    - src/components/rules/RuleToggleRow.tsx
    - src/app/(dashboard)/projeler/[id]/kurallar/actions.ts
  modified:
    - src/app/(dashboard)/ayarlar/kurallar/page.tsx

key-decisions:
  - "RuleToggleRow <td> döndürüyor (TableRow wrapper değil) — sayfa bileşeni <TableRow><RuleToggleRow /></TableRow> pattern kullanıyor; bu page-level table composition sağlıyor"
  - "toggleAction prop injection: global sayfada toggleRule, proje sayfasında toggleProjectRule.bind(null, projectId) — aynı bileşen iki context'te çalışıyor"
  - "Optimistic update + rollback: setLocalValue(prev) on failure — toggle hiç loading shimmer kullanmıyor, doğrudan değer geri dönüyor"
  - "resetProjectRule sadece scope='project' satırları siliyor — global kurallar etkilenmiyor (T-03-02-03)"

# Metrics
duration: 8min
completed: 2026-04-23
---

# Phase 03 Plan 02: RuleToggleRow Client Component + Toggle Wire Summary

**RuleToggleRow optimistic toggle Client Component, toggleProjectRule/resetProjectRule Server Actions ve global kurallar sayfasının interactive toggle'larla wire edilmesi**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-22T23:26:00Z
- **Completed:** 2026-04-22T23:34:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `RuleToggleRow` Client Component oluşturuldu: optimistic toggle, hata durumunda rollback, loading (opacity-50 cursor-wait), Global badge (slate), Proje badge (blue + ✕ reset butonu), önerilen değerden sapma uyarısı (amber)
- `toggleProjectRule` Server Action: auth guard + proje ownership check + upsert onConflict
- `resetProjectRule` Server Action: auth guard + ownership check + project-scope DELETE
- Global kurallar sayfasındaki statik `<span>` placeholder'lar kaldırıldı; `RuleToggleRow` ile wire edildi

## Task Commits

Her task atomik olarak commit edildi:

1. **Task 1: RuleToggleRow + proje Server Actions** - `84ecd3d` (feat)
2. **Task 2: Global kurallar sayfası wire** - `432c3f2` (feat)

## Files Created/Modified

- `src/components/rules/RuleToggleRow.tsx` — Client Component: optimistic toggle, rollback, loading state, Global/Proje scope badge
- `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` — toggleProjectRule (upsert onConflict) + resetProjectRule (DELETE project-scope)
- `src/app/(dashboard)/ayarlar/kurallar/page.tsx` — RuleToggleRow import + toggleRule prop injection + Kapsam TableHead eklendi, statik span kaldırıldı

## Decisions Made

- RuleToggleRow `<td>` elementleri döndürüyor (TableRow wrapper değil) — sayfa bileşeni `<TableRow><RuleToggleRow /></TableRow>` şeklinde sarmalıyor; bu pattern page-level table row composition sağlıyor
- `toggleAction` prop injection: global sayfada `toggleRule`, proje sayfasında `toggleProjectRule.bind(null, projectId)` — aynı bileşen iki context'te kullanılıyor
- Optimistic update + rollback: `setLocalValue(prev)` on failure — toggle loading shimmer yerine anında geri dönüş
- `resetProjectRule` yalnızca `scope='project'` satırlarını siliyor — global kurallar güvende (T-03-02-03)
- Global kurallar sayfasına "Kapsam" başlıklı 4. sütun eklendi (RuleToggleRow 4 `<td>` döndürdüğünden TableHeader da güncellendi)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] TableHeader'a Kapsam sütunu eklendi**
- **Found during:** Task 2
- **Issue:** RuleToggleRow 4 `<td>` döndürüyor (Kapsam, Kural, Önerilen, Toggle) ancak orijinal TableHeader sadece 3 sütun başlığı içeriyordu — tabloda sütun uyumsuzluğu oluşacaktı
- **Fix:** TableHeader'a "Kapsam" `<TableHead>` eklendi, mevcut "Kural" ve "Önerilen" başlıkları korundu
- **Files modified:** src/app/(dashboard)/ayarlar/kurallar/page.tsx
- **Commit:** 432c3f2

## Known Stubs

Yok — tüm toggle interaktivitesi tamamlandı. Proje bazlı kural sayfası (03-03) için `toggleProjectRule` ve `resetProjectRule` actions hazır.

## Threat Flags

Yok — tüm yeni Server Actions plan threat_model'inde belgelenmiş (T-03-02-01 ... T-03-02-05).

## Self-Check: PASSED

- `src/components/rules/RuleToggleRow.tsx` — FOUND
- `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` — FOUND
- `src/app/(dashboard)/ayarlar/kurallar/page.tsx` — FOUND (modified)
- Commit `84ecd3d` — FOUND
- Commit `432c3f2` — FOUND
- `npx tsc --noEmit` — Yalnızca pre-existing `stage-transition.tsx` hatası (bu plan kapsamı dışında)

## Next Phase Readiness

- Plan 03-03: Proje bazlı kural sayfası — `toggleProjectRule.bind(null, projectId)` ve `resetProjectRule.bind(null, projectId)` ile aynı `RuleToggleRow` kullanılacak
