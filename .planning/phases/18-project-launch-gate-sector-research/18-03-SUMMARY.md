---
phase: 18
plan: "03"
subsystem: launch-gate-ui
tags: [ui, launch-gate, research-trigger, client-component, gate-logic]
dependency_graph:
  requires:
    - "18-01: sector-research.ts pipeline"
    - "18-02: POST /api/research/trigger route"
    - "research_reports table (Phase 16 schema)"
  provides:
    - "ProjectInfoSection launch gate (canLaunch + disabled hint + completed block)"
    - "ResearchRerunButton — Yeniden Araştır client component"
    - "hasResearch SSR doluluk kontrolü — page.tsx"
  affects:
    - "Proje detay sayfası (/projeler/[id]) — launch gate görünür"
    - "Araştırma sayfası (/projeler/[id]/arastirma) — Yeniden Araştır butonu"
tech_stack:
  added: []
  patterns:
    - "inline error state (launchError + setLaunchError) — sonner yok, projede mevcut pattern"
    - "researchDone state initializes from SSR (initialHasResearch prop)"
    - "canLaunch boolean gate — 3 zorunlu alan trim kontrolü"
    - "router.refresh() — SSR veri yenileme sonrası"
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/arastirma/ResearchRerunButton.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/page.tsx
    - src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx
    - src/app/(dashboard)/projeler/[id]/arastirma/page.tsx
decisions:
  - "D-01: sonner toast yerine inline error state kullanıldı — projede sonner paketi yok; text-destructive + role=alert pattern mevcut kodla tutarlı"
  - "D-02: researchDone optimistik state — SSR'dan initialHasResearch ile başlar, fetch başarısında true olur; sayfa yenilenince DB'den doğrulanan değer gelir"
metrics:
  duration: "~7 dakika"
  completed: "2026-05-08T09:18:57Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 3
requirements:
  - PROJ-06
  - PROJ-07
  - SRCH-03
---

# Phase 18 Plan 03: Launch Gate UI & Yeniden Araştır Summary

**One-liner:** ProjectInfoSection'a 3-alan gate logic (canLaunch), loading spinner, emerald tamamlandı bloğu ve /arastirma linki eklendi; ResearchRerunButton ile araştırma sayfasında h1 yanında yeniden tetikleme butonu sağlandı.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | page.tsx hasResearch + userId prop | 53ee281 | src/app/(dashboard)/projeler/[id]/page.tsx |
| 2 | ProjectInfoSection launch gate UI | 4eb5b0e | src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx |
| 3 | ResearchRerunButton + arastirma/page.tsx | 13fcf3d | arastirma/ResearchRerunButton.tsx, arastirma/page.tsx |
| Fix | Inline error state + missing worktree deps | 872b519 | ProjectInfoSection.tsx, ResearchRerunButton.tsx, projeler/actions.ts, CompetitorsTagInput.tsx, KeywordsTagInput.tsx, alert-dialog.tsx |

## Implementation Summary

### Task 1: page.tsx — hasResearch doluluk kontrolü

`research_reports` tablosuna `.select('section').eq('project_id', id).eq('user_id', user.id).limit(1)` sorgusu eklendi. `hasResearch = (researchCheck?.length ?? 0) > 0` boolean'ı `ProjectInfoSection`'a `userId={user.id}` ile birlikte prop olarak geçildi.

### Task 2: ProjectInfoSection.tsx — Launch Gate

**Yeni props:** `userId: string`, `hasResearch: boolean` (signature: `initialHasResearch` olarak alınıp state'e atandı)

**Gate logic:**
- `canLaunch`: sector + initial_competitors + target_keywords trim kontrolü
- `missingFields`: eksik alanları Türkçe label ile listeler

**handleLaunch:** `/api/research/trigger` POST çağrısı. `SERPAPI_NOT_CONFIGURED` code için özel hata mesajı, diğerleri için genel mesaj. `launchError` inline state ile gösterim.

**UI:**
- Separator + buton (`disabled={!canLaunch || isResearching}`)
- Loading: `<Loader2 className="animate-spin h-4 w-4" /> Araştırılıyor...`
- Disabled hint: `Eksik: {missingFields.join(', ')}`
- Completed block: emerald-500/30 border + emerald-500/5 bg, "Araştırma tamamlandı ✓" + araştırma link

### Task 3: ResearchRerunButton + arastirma/page.tsx

`ResearchRerunButton.tsx` — bağımsız client component:
- `variant="outline" size="sm"` Button
- `handleRerun`: fetch → SERPAPI check → `router.refresh()` başarıda
- Inline error state (sonner yok)

`arastirma/page.tsx`:
- `import { ResearchRerunButton }` eklendi
- h1 `<div className="flex justify-between items-center">` ile sarıldı
- `<ResearchRerunButton projectId={id} userId={user.id} />` h1 sağına eklendi

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sonner paketi projede mevcut değil**
- **Found during:** TypeScript kontrolü
- **Issue:** Plan bağlamında "Projede toast için 'sonner' kullanılıyor" belirtilmiş ancak proje package.json'da `sonner` paketi yok; mevcut hata gösterimi inline state (text-destructive) pattern kullanıyor
- **Fix:** `toast.success/toast.error` çağrıları kaldırıldı; `launchError` state + `<p role="alert" className="text-xs text-destructive">` pattern uygulandı (site-import-section.tsx ile aynı pattern)
- **Files modified:** ProjectInfoSection.tsx, ResearchRerunButton.tsx
- **Commit:** 872b519

**2. [Rule 3 - Blocking] Worktree'de eksik bağımlı dosyalar**
- **Found during:** TypeScript kontrolü — Task 2 ve 3 sonrası
- **Issue:** Worktree bağımsız git ağacı; ProjectInfoSection.tsx'in import ettiği `CompetitorsTagInput`, `KeywordsTagInput`, `@/components/ui/alert-dialog`, `../actions` (updateProjectField) worktree'de eksikti
- **Fix:** Ana repo'dan kopyalandı
- **Files modified:** CompetitorsTagInput.tsx, KeywordsTagInput.tsx, alert-dialog.tsx, projeler/actions.ts
- **Commit:** 872b519

**3. [Rule 2 - Pattern] AlertDialog onOpenChange implicit any**
- **Found during:** TypeScript kontrolü
- **Issue:** `onOpenChange={(open) => ...}` — `open` parametresi implicit any
- **Fix:** `(open: boolean) =>` explicit type annotation eklendi
- **Files modified:** ProjectInfoSection.tsx
- **Commit:** 872b519

## Known Stubs

None — tüm bileşenler `/api/research/trigger` endpoint'ine gerçek fetch bağlantısıyla tam işlevsel.

## Threat Flags

Plan'daki threat model uygulandı:
- T-18-10: userId SSR'dan user.id olarak geçiyor (accept)
- T-18-11: Hata mesajları genel ifadeler; SERPAPI_NOT_CONFIGURED dışında internal hata detayı kullanıcıya gösterilmiyor
- T-18-12: researchDone optimistik state (accept); sayfa yenilenince SSR'dan doğru değer

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx exists | FOUND |
| src/app/(dashboard)/projeler/[id]/arastirma/ResearchRerunButton.tsx exists | FOUND |
| src/app/(dashboard)/projeler/[id]/page.tsx hasResearch | FOUND (line 41, 80) |
| canLaunch in ProjectInfoSection | FOUND (line 244) |
| Eksik: hint | FOUND (line 353) |
| emerald completed block | FOUND (line 326) |
| ResearchRerunButton export | FOUND (line 13) |
| justify-between in arastirma/page.tsx | FOUND (line 112) |
| commit 53ee281 | FOUND |
| commit 4eb5b0e | FOUND |
| commit 13fcf3d | FOUND |
| commit 872b519 | FOUND |
| TypeScript errors in plan files | 0 errors |
