---
phase: 06-keyword-clustering-scoring
plan: "02"
subsystem: keyword-clustering-ui
tags: [clustering, scoring, ui, client-components, view-toggle, dialog]
dependency_graph:
  requires:
    - "06-01 (clusterAndScoreKeywords, moveKeywordToCluster, setPrimaryKeyword Server Actions)"
    - "src/components/ui/dialog.tsx (@base-ui/react Dialog)"
    - "src/components/ui/button.tsx, badge.tsx, table.tsx"
  provides:
    - "ClusterButton — 'Kümelere Böl' / 'Yeniden Kümeleme' primary CTA"
    - "ViewToggle — URL query param tabanlı Düz Liste / Küme Görünümü toggle"
    - "PrimaryKeywordStar — setPrimaryKeyword Server Action tetikleyen yıldız butonu"
    - "MoveKeywordDialog — moveKeywordToCluster Server Action tetikleyen dialog"
    - "ClusterPanel — cluster kart listesi, keyword satırları, primary yıldız, taşı"
    - "ClusterDeleteButton — deleteCluster Server Action tetikleyen hover-reveal buton"
    - "page.tsx güncellemesi — Skor sütunu, searchParams view routing, enrichment banner"
  affects:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx"
tech_stack:
  added: []
  patterns:
    - "DialogTrigger render prop (@base-ui/react pattern — asChild desteklenmez)"
    - "URL query param view routing — searchParams Promise ile Server Component SSR"
    - "group className + group-hover:opacity-100 — hover-reveal interaktif butonlar"
    - "useTransition + startTransition async — Server Action loading state"
    - "Badge className renk ataması — variant prop kullanılmaz (D-11)"
key_files:
  created:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
decisions:
  - "ClusterDeleteButton sıfırdan oluşturuldu — worktree'de Phase 5 bileşeni yoktu (Rule 3)"
  - "ClusterPanel Server Component olarak bırakıldı — parent'tan prop alıyor, kendi state'i yok; child Client Components kendi state'ini yönetiyor"
  - "DialogTitle'da font-medium shadcn default var — DialogTitle kendi className override ile font-semibold kullandı"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-24"
  tasks_completed: 3
  files_created: 6
  files_modified: 1
---

# Phase 06 Plan 02: Keyword Clustering & Scoring UI Summary

5 yeni Client Component (ClusterButton, ViewToggle, PrimaryKeywordStar, MoveKeywordDialog, ClusterPanel) ve güncellenmiş page.tsx ile keyword clustering kullanıcı arayüzü tamamlandı.

## What Was Built

### Task 1: ClusterButton + ViewToggle + PrimaryKeywordStar (commit: 2936041)

**ClusterButton.tsx** oluşturuldu:
- `useTransition` + `startTransition(async)` — Server Action loading state
- Küme yokken "Kümelere Böl", varken "Yeniden Kümeleme" text
- Loading: `opacity-50` + animate-spin SVG + "Kümeleniyor..."
- Inline error: `<p className="text-sm text-destructive">`
- shadcn default Button (bg-primary text-primary-foreground)

**ViewToggle.tsx** oluşturuldu:
- `useRouter` + `usePathname` ile `?view=flat` / `?view=cluster` URL push
- Aktif tab: `bg-secondary text-foreground`, diğeri: `text-muted-foreground`
- `flex rounded-md border border-border overflow-hidden` container

**PrimaryKeywordStar.tsx** oluşturuldu:
- `useTransition` — pending durumda animate-spin SVG
- `isPrimary=true`: `text-primary` dolu yıldız (★), `disabled=true`
- `isPrimary=false`: `opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary` boş yıldız (☆)
- Tooltip: "Primary keyword (en yüksek hacim)" / "Primary yap"

### Task 2: ClusterDeleteButton (Rule 3) + MoveKeywordDialog + ClusterPanel (commit: 400255a)

**ClusterDeleteButton.tsx** oluşturuldu (Rule 3 — worktree'de eksikti):
- KeywordDeleteButton pattern: `opacity-0 group-hover:opacity-100`, `hover:text-destructive`
- `deleteCluster(projectId, clusterId)` Server Action çağırır
- useTransition loading state

**MoveKeywordDialog.tsx** oluşturuldu:
- `DialogTrigger render={<button>}` — base-ui render prop pattern (asChild değil)
- "Taşı →" trigger: `opacity-0 group-hover:opacity-100 transition-opacity`
- Cluster radio listesi: `button.w-full` + `bg-secondary` aktif seçim
- `IntentBadge` + keyword_count badge her cluster satırında
- Inline hata: `<p className="text-sm text-destructive">`
- Boş küme durumu: "Başka küme yok. Önce 'Kümelere Böl' ile yeni kümeler oluşturun."
- `useState(false)` ile kontrollü dialog, reset on close

**ClusterPanel.tsx** oluşturuldu:
- Server Component (kendi 'use client' yok; child Client Components kendi state'ini yönetiyor)
- Cluster kart: `rounded-md border border-border bg-card overflow-hidden`
- Header: `group flex items-center bg-secondary/40` + ClusterDeleteButton hover-reveal
- Keyword satırı: `group flex items-center hover:bg-secondary/20` + PrimaryKeywordStar + MoveKeywordDialog
- Primary keyword: `font-semibold`, diğerleri: `font-normal`
- ScoreBadge: violet ≥70, amber ≥40, secondary <40 (variant prop yok)
- Footer: keyword sayısı
- Boş durum: "Henüz küme oluşturulmadı." mesajı

### Task 3: page.tsx güncelle (commit: 6267005)

**page.tsx** genişletildi:
- `searchParams: Promise<{ view?: string }>` prop eklendi
- `isClusterView = view === 'cluster'` koşullu render
- `opportunity_score` Supabase select'e ve `KeywordRow` tipine eklendi
- Cluster sorgusu genişletildi: `intent, primary_keyword_id` eklendi
- `clustersWithKeywords` ve `allClusters` hesaplanıyor (client-side grouping)
- Düz tablo 8. sütun: "Skor" — violet/amber/secondary badge, null → "—"
- Enrichment amber banner: `border-amber-500/30 bg-amber-500/10` (pendingEnrichment > 0)
- ViewToggle + ClusterButton section header sağına entegre
- ClusterPanel `?view=cluster` durumunda render

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ClusterDeleteButton sıfırdan oluşturuldu**
- **Found during:** Task 2
- **Issue:** Plan ClusterPanel'de `<ClusterDeleteButton>` kullanımını belirtiyor; ancak bu bileşen worktree'de mevcut değildi (Phase 5 bileşeni, farklı worktree'de oluşturulmuş).
- **Fix:** ClusterDeleteButton.tsx sıfırdan oluşturuldu. KeywordDeleteButton'dan aynı pattern: `opacity-0 group-hover:opacity-100`, `hover:text-destructive`, `useTransition`, `deleteCluster` Server Action.
- **Files modified:** src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx (yeni)
- **Commit:** 400255a

**2. [Rule 2 - Pre-existing] TypeScript pre-existing hatalar — kapsam dışı**
- **Found during:** Tüm task'larda tsc --noEmit
- **Issue:** KeywordImport.tsx, ProjectNav.tsx, SeoFetchButton.tsx, CompetitorDeleteButton.tsx bu worktree'de eksik. stage-transition.tsx TS18047. Plan 01 SUMMARY'de de belgelenmişti.
- **Fix:** Yeni dosyalara (ClusterButton, ViewToggle, PrimaryKeywordStar, MoveKeywordDialog, ClusterPanel, ClusterDeleteButton) ait TypeScript hatası yok — doğrulandı.
- **Scope:** Pre-existing, kapsam dışı. Deferred.

## Known Stubs

Yok — tüm bileşenler gerçek Server Action'ları çağırıyor; ClusterPanel gerçek prop'larla render ediliyor.

## Threat Surface Scan

`<threat_model>` kapsamındaki tüm alanlar implementasyona yansıdı:
- T-06-UI-01: page.tsx her Supabase sorgusunda `.eq('user_id', user.id)` — başka kullanıcının verisi SSR'da görünmez
- T-06-UI-02: MoveKeywordDialog client-state sadece UI; gerçek ownership doğrulama Plan 01 Server Action'da
- T-06-UI-03: view param Server Component'te `=== 'cluster'` boolean kontrolü — injection riski yok

Yeni threat surface bulunamadı.

## Self-Check: PASSED

### Created files exist:
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx: FOUND (2936041)
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx: FOUND (2936041)
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx: FOUND (2936041)
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx: FOUND (400255a)
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx: FOUND (400255a)
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterDeleteButton.tsx: FOUND (400255a)
- src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx: UPDATED (6267005)

### Commits exist:
- 2936041: feat(06-02): ClusterButton, ViewToggle, PrimaryKeywordStar — FOUND
- 400255a: feat(06-02): MoveKeywordDialog, ClusterPanel, ClusterDeleteButton — FOUND
- 6267005: feat(06-02): page.tsx — FOUND
