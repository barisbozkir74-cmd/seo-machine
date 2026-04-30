---
phase: 16-recovery-engine
plan: "03"
subsystem: monitoring-ui
tags:
  - ui
  - components
  - recovery
  - client-component
dependency_graph:
  requires:
    - "src/lib/monitoring/recovery-tasks.ts (RecoveryTaskRow type — Plan 16-02)"
    - "src/components/ui/table.tsx (existing)"
    - "src/components/ui/badge.tsx (existing)"
    - "src/components/ui/button.tsx (existing)"
    - "src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx (structural analog)"
  provides:
    - "ContentTabBar component (3-tab content switcher with period threading)"
    - "RecoveryTaskTable component (status badges, dismiss toggle, action buttons)"
    - "actions.ts stub (compile gate for Plan 16-04)"
  affects:
    - "Plan 16-04 (izleme/page.tsx wire-up — imports ContentTabBar + RecoveryTaskTable)"
    - "Plan 16-04 (overwrites actions.ts stub with real implementation)"
tech_stack:
  added: []
  patterns:
    - "'use client' directive — useState, useTransition, useRouter"
    - "useTransition + disabled={isPending} double-submit prevention"
    - "STATUS_BADGE_CLASS record — className-direct badge coloring (no variant prop)"
    - "Conditional empty state: activeCount === 0 && !showDismissed"
    - "targetRoute() builds URL from constants + projectId only (T-16-03-01 mitigation)"
key_files:
  created:
    - "src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx"
    - "src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx"
    - "src/app/(dashboard)/projeler/[id]/izleme/actions.ts"
  modified: []
decisions:
  - "actions.ts is a compile-gate stub — returns failure until Plan 16-04 overwrites it (fails closed by design)"
  - "Aksiyon column width w-40 (not w-24 from UI-SPEC) — two side-by-side actions (Güncelle + Görmezden Gel) need extra space"
  - "dismissed badge uses bg-slate-700 text-slate-400 (UI-SPEC §Badge Color Contract) — no border class for dismissed"
  - "Empty state activeCount check only counts open+in_progress, not dismissed — dismissed togglable separately"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-30"
  tasks: 3
  files: 3
---

# Phase 16 Plan 03: Recovery UI Components Summary

**One-liner:** `ContentTabBar` (3-sekme, period-korumalı URL navigasyonu) ve `RecoveryTaskTable` (durum badge'leri, dismiss toggle, Güncelle/Görmezden Gel aksiyonları) client bileşenleri oluşturuldu; `actions.ts` stub derleme geçidi sağlıyor.

## What Was Built

Üç dosya oluşturuldu:

### 1. `content-tab-bar.tsx`

`PeriodTabBar` ile aynı yapısal pattern'i uygular. `ContentTab = 'clusters' | 'pages' | 'recovery'` tipi export eder. Her tab tıklamasında `?period=${period}&tab=${t.id}` URL'i oluşturarak period parametresini korur (UI-SPEC §URL State Machine). Aktif tab: `bg-secondary text-foreground font-medium`, pasif: `text-muted-foreground hover:text-foreground`, her ikisi de `min-h-[44px]` dokunma hedefi.

### 2. `recovery-task-table.tsx`

`page-metrics-table.tsx` ile aynı tablo yapısını kullanır. Özellikler:

| Özellik | Uygulama |
|---------|----------|
| Boş durum | activeCount === 0 && !showDismissed → 2 satırlı kart |
| Durum badge | STATUS_BADGE_CLASS record — 4 durum, UI-SPEC className'leri |
| Pozisyon kaybı | formatPositionLoss(before, after) — "+N.N pozisyon" |
| Güncelle | variant="outline" size="sm" → updateRecoveryTaskStatus('in_progress') + router.push |
| Görmezden Gel | plain button → updateRecoveryTaskStatus('dismissed') + router.refresh() |
| Toggle | showDismissed state — "Dismissed görevleri göster/gizle" |
| Double-submit guard | useTransition + disabled={isPending} (T-16-03-06) |

### 3. `actions.ts` (Stub)

Plan 16-03 ile 16-04 arasındaki derleme penceresini kapatır. Fonksiyon imzası 16-04 ile eşleşir, ancak güvenli kapanış prensibiyle her zaman hata döner.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ContentTabBar | `f3bfb53` | `src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx` |
| 2 | Create RecoveryTaskTable | `9e5ad89` | `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx` |
| 3 | Create actions.ts stub | `71d328c` | `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` |

## Deviations from Plan

### Auto-adjusted (not a deviation, documented for clarity)

**Aksiyon column width:** UI-SPEC §Recovery Task Table belirtir `w-24`, ancak iki aksiyon (Güncelle butonu + Görmezden Gel bağlantısı) yan yana renderlanınca `w-40` kullanıldı. Plan'ın Task 2 Critical Rule 10 bu durumu öngörür ve `w-40` kullanımını açıkça onaylar. Plan spec'inden sapma değil.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `updateRecoveryTaskStatus` stub | `izleme/actions.ts` | 11-21 | Derleme geçidi — Plan 16-04 gerçek implementasyonu yazar. Güvenli kapanış: her zaman hata döner. |

## Threat Surface Scan

Yeni dosyalar yalnızca client-side UI bileşeni ve 'use server' stub içeriyor. Yeni ağ endpoint, auth yolu veya şema değişikliği yok. Plan `<threat_model>` kapsamındaki tüm tehditler ele alındı:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-16-03-01 | targetRoute() sabitlerden URL üretir — kullanıcı girdisi yok |
| T-16-03-02 | projectId SSR-render edilmiş prop, server action (16-04) ownership doğrular |
| T-16-03-03 | React children escape — dangerouslySetInnerHTML kullanılmadı |
| T-16-03-04 | Stub fails closed — 16-04 geçek implementasyonla override eder |
| T-16-03-05 | Accept — UI-SPEC §Görmezden Gel Dismiss Action modal gerektirmez |
| T-16-03-06 | useTransition + disabled={isPending} double-submit engeller |

## TypeScript Compilation

`npx tsc --noEmit` — yeni dosyalarda sıfır hata. Görülen 2 hata önceden var olan `HtmlReadyBanner.tsx` içinde (`GscIndexBadge` ve `sayfa-paketi/actions` eksik modüller), bu plan tarafından dokunulmamış.

## Self-Check: PASSED

- [x] `src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx` exists
- [x] `export type ContentTab = 'clusters' | 'pages' | 'recovery'` present
- [x] `export function ContentTabBar` present
- [x] Turkish labels: Cluster Performansı, Sayfa Performansı, Recovery — all present
- [x] `?period=${period}&tab=` threading present
- [x] `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx` exists
- [x] `export function RecoveryTaskTable` present
- [x] Empty state strings present
- [x] `bg-red-500/15 text-red-400 border border-red-500/30` present
- [x] `bg-yellow-500/15 text-yellow-400 border border-yellow-500/30` present
- [x] `bg-slate-700 text-slate-400` present
- [x] `/projeler/${projectId}/sayfalar` route present
- [x] `/projeler/${projectId}/site-analizi` route present
- [x] `import { updateRecoveryTaskStatus } from './actions'` present
- [x] `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` exists
- [x] `'use server'` directive present
- [x] `export type RecoveryTaskActionResult` present
- [x] `export async function updateRecoveryTaskStatus` present
- [x] Commit `f3bfb53` exists in git log
- [x] Commit `9e5ad89` exists in git log
- [x] Commit `71d328c` exists in git log
- [x] tsc --noEmit: zero errors in new files
