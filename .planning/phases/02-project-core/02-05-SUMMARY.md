---
phase: 02-project-core
plan: "05"
subsystem: stage-engine
tags: [next.js, server-action, client-component, supabase, dialog, stage-transition, auth-guard]

# Dependency graph
requires:
  - phase: 02-04
    provides: "projeler/[id]/page.tsx — StageTransition placeholder ile detay sayfası"
  - phase: 02-01
    provides: "dialog.tsx, button.tsx bileşenleri"
provides:
  - "src/app/(dashboard)/projeler/[id]/actions.ts — advanceStage Server Action"
  - "src/app/(dashboard)/projeler/[id]/stage-transition.tsx — StageTransition Client Component"
affects: [02-06-notes, page.tsx sağ sütun alt bölümü]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action auth guard: supabase.auth.getUser() + user_id eq filter — kullanıcı sahipliği doğrulaması"
    - "Idempotent stage transition: .eq('status', 'active') filtresi double-click'i no-op yapar"
    - "maybeSingle() kullanımı: son stage'de pending row olmadığında hata vermez"
    - "DialogTrigger render prop pattern (base-ui): asChild desteklenmiyor, render={<Button />} kullanılıyor"
    - "revalidatePath sonrası client state güncelleme: Server Action revalidate ediyor, Client Component setOpen(false) ile dialog kapatıyor"

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/actions.ts
    - src/app/(dashboard)/projeler/[id]/stage-transition.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/page.tsx

key-decisions:
  - "maybeSingle() tercih edildi — .single() son stage'de pending row bulamayınca hata fırlatır; maybeSingle() null döner"
  - "DialogTrigger asChild yerine render prop: @base-ui/react asChild prop desteklemiyor (önceki planlarda da belirlendi)"
  - "Son stage kontrolü: stageList.every(s => s.status === 'completed') AND stageList.length > 0 — boş liste false döner"

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 2 Plan 05: Stage Geçiş Mantığı + Onay Dialogu Summary

**Auth + ownership guard'lı advanceStage Server Action ve Dialog onay akışlı StageTransition Client Component oluşturuldu; detay sayfasına entegre edildi**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T22:20:00Z
- **Completed:** 2026-04-22T22:32:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `src/app/(dashboard)/projeler/[id]/actions.ts` Server Action oluşturuldu
  - `advanceStage(projectId, currentStageId)` export'u
  - Auth: `supabase.auth.getUser()` — oturum yoksa erken return
  - Ownership: tüm UPDATE sorgularında `.eq('user_id', user.id)` filtresi (T-02-05-01, T-02-05-02)
  - Idempotency: `.eq('status', 'active')` ile sadece aktif stage tamamlanır, double-click no-op (T-02-05-03)
  - `maybeSingle()` ile son stage tespiti — hatasız null dönüşü
  - `revalidatePath` ile sayfa yenileme
- `src/app/(dashboard)/projeler/[id]/stage-transition.tsx` Client Component oluşturuldu
  - "Sonraki Aşamaya Geç" butonu + Dialog onay akışı
  - "Aşamayı Tamamla" başlıklı Dialog: stage adı dinamik, "Bu işlem geri alınamaz." uyarısı
  - "Evet, Tamamla" / "Vazgeç" butonları, `isPending` loading state
  - Son stage tamamlandığında: "Tüm aşamalar tamamlandı. Proje yayın sonrası takibindedir." mesajı
- `page.tsx` güncellendi:
  - `activeStage` ve `isLastStage` hesaplama eklendi
  - Placeholder `<div>` yerine `<StageTransition />` bileşeni yerleştirildi
- TypeScript hatasız — `npx tsc --noEmit` temiz

## Task Commits

Her görev atomik olarak commit edildi:

1. **Task T-02-05-01: advanceStage Server Action oluştur** — `d1d10ae` (feat)
2. **Task T-02-05-02: StageTransition Client Component + page.tsx entegrasyonu** — `10b5658` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/actions.ts` — Server Action; advanceStage(projectId, currentStageId), auth guard, ownership doğrulama, idempotent stage completion, revalidatePath
- `src/app/(dashboard)/projeler/[id]/stage-transition.tsx` — Client Component; Dialog onay akışı, isPending state, son stage tamamlanma mesajı
- `src/app/(dashboard)/projeler/[id]/page.tsx` — StageTransition import + activeStage/isLastStage hesaplama + bileşen entegrasyonu

## Decisions Made

- `maybeSingle()` kullanıldı: `.single()` son stage'de pending row bulamayınca Supabase hatası fırlatır; `maybeSingle()` `null` döner ve `isLastStage = true` doğru çalışır
- `DialogTrigger render prop` pattern: `@base-ui/react` `asChild` prop desteklemiyor (STATE.md'de kayıtlı önceki karar) — `render={<Button className="w-full h-11" />}` ile eşdeğer davranış
- `isLastStage` hesaplaması: `stageList.length > 0 && stageList.every(...)` — boş stage listesi (edge case) yanlışlıkla "tamamlandı" göstermez

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] .single() yerine maybeSingle() kullanımı**
- **Found during:** T-02-05-01 — Server Action implementasyonu
- **Issue:** Plan'daki kod örneğinde `.single()` kullanılmıştı. Pending stage olmadığında (son stage geçişi) `.single()` Supabase'den hata döndürür ve `isLastStage` asla `true` olmaz.
- **Fix:** `.maybeSingle()` kullanıldı — null döner, hata yok, `isLastStage = true` doğru çalışır.
- **Files modified:** `src/app/(dashboard)/projeler/[id]/actions.ts`
- **Commit:** `d1d10ae`

**2. [Rule 1 - Bug] DialogTrigger asChild prop TypeScript hatası**
- **Found during:** T-02-05-02 — TypeScript tip kontrolü
- **Issue:** `<DialogTrigger asChild>` şablonu TypeScript TS2322 hatası verdi — `@base-ui/react` `asChild` prop desteklemiyor.
- **Fix:** `render={<Button className="w-full h-11" />}` render prop pattern kullanıldı (STATE.md'de kayıtlı önceki karar).
- **Files modified:** `src/app/(dashboard)/projeler/[id]/stage-transition.tsx`
- **Commit:** `10b5658`

---

**Total deviations:** 2 auto-fixed (1 runtime bug, 1 TypeScript hata)
**Impact on plan:** Davranış plan ile tamamen tutarlı — düzeltmeler TypeScript tip sistemi ve Supabase API sözleşmesine uygunluk için gereklidir.

## Known Stubs

Yok — bu plan'ın hedefi olan stage geçiş butonu ve onay dialogu tam olarak uygulandı. Stub bırakılmadı.

## Threat Flags

Yeni tehdit yüzeyi eklenmedi — tüm tehditler plan'ın threat_model'inde tanımlanmış ve mitigate edildi:
- T-02-05-01: User ownership doğrulaması `user.id` eq filter ile uygulandı
- T-02-05-02: currentStageId manipülasyonu `project_id + user_id + status='active'` filtresi ile engellendi
- T-02-05-03: Double-click idempotency `.eq('status', 'active')` ile sağlandı
- T-02-05-04: Rate limiting — MVP için kabul edildi

## User Setup Required

None — harici servis konfigürasyonu gerekmiyor.

## Next Phase Readiness

- 02-06 (Notlar): `page.tsx` sağ sütunda "Notlar" bölümü placeholder hâlâ mevcut — 02-06-PLAN hazır
- Stage geçiş döngüsü tamamlandı: Intake → Discovery → ... → Post-Launch arası geçiş çalışıyor

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/projeler/[id]/actions.ts
- FOUND: src/app/(dashboard)/projeler/[id]/stage-transition.tsx
- FOUND: commit d1d10ae
- FOUND: commit 10b5658

---
*Phase: 02-project-core*
*Completed: 2026-04-22*
