---
phase: 12-content-studio
plan: "03"
subsystem: content-studio-actions
tags:
  - server-actions
  - content-sections
  - html-assembly
  - page-packages
dependency_graph:
  requires:
    - 12-01 (page_packages migration — content_sections JSONB + html_content TEXT kolonları)
  provides:
    - approveSection server action
    - rejectSection server action
    - saveContentSections server action
    - ContentSection type
    - assembleHtml helper
  affects:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
tech_stack:
  added: []
  patterns:
    - verifyOwnership + locked guard pattern (actions.ts canonical pattern)
    - dual revalidatePath (icerik-studio + sayfa-paketi)
    - JSONB array mutation via DB read → mutate → write cycle
    - allApproved trigger for html_content assembly
key_files:
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
decisions:
  - ContentSection tipi actions.ts'e eklendi (12-CONTEXT.md D-04 şeması)
  - assembleHtml private helper olarak tutuldu (export edilmedi — yalnızca server-side assembly)
  - saveContentSections locked guard: paket kilitli değilse early return
  - approveSection allApproved kontrolü: her onay sonrası tüm bölümler kontrol edilir, html_content conditional olarak yazılır
  - PagePackageData tipi content_sections + html_content ile genişletildi (tip bütünlüğü)
metrics:
  duration: "~5 minutes"
  completed: "2026-04-26"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 12 Plan 03: Content Studio Server Actions Summary

ContentSection tipi ve üç yeni server action (approveSection, rejectSection, saveContentSections) `sayfa-paketi/actions.ts` dosyasına eklendi; tüm bölümler onaylandığında WordPress-ready HTML otomatik birleştiriliyor.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ContentSection tipi + approveSection + rejectSection + saveContentSections | 5a4caf7 | src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts |

## What Was Built

### ContentSection Tipi
`actions.ts` dosyasına `ActionResult` tipinin hemen altına eklendi:
- `heading`, `level`, `sub_headings`, `content`, `status` alanları
- Status union: `'pending' | 'generating' | 'draft' | 'approved' | 'rejected'`

### assembleHtml() Helper
Private (non-export) fonksiyon — tüm bölümler approved olduğunda çağrılır:
- `<h2>` + `<p>` yapısı temel; `sub_headings` varsa `<h3>` blokları araya eklenir
- Bölümler `\n\n` ile ayrılır

### saveContentSections Action
- Stream tamamlandıktan sonra client tarafından çağrılır
- `sections[]` dizisini (status='draft') bulk JSONB olarak yazar
- locked guard + ownership verify (project + page_package üçlü filtre)
- Dual revalidatePath: icerik-studio/[pageId] + sayfa-paketi

### approveSection Action
- `sections[sectionIndex].status = 'approved'` + content güncelleme
- `allApproved` kontrolü: tüm bölümler onaylandıysa `assembleHtml()` çağrılır
- `html_content` conditional olarak updatePayload'a eklenir
- sectionIndex bounds check (T-12-03-03 mitigation)

### rejectSection Action
- `sections[sectionIndex].status = 'rejected'` yazar
- Client bölümü `pending`'e döndürebilir, yeniden üretebilir

## Security (Threat Model)
Tüm tehdit mitigasyonları uygulandı:
- T-12-03-01: `supabase.auth.getUser()` + `verifyOwnership()` her action'da
- T-12-03-02: `page_packages` sorgusu `.eq('project_id').eq('user_id')` üçlü filtre (IDOR önleme)
- T-12-03-03: `sectionIndex < 0 || sectionIndex >= sections.length` bounds check
- T-12-03-04: UPDATE `.eq('id', pkg.id).eq('user_id', user.id)` — başka user'ın paketi güncellenemez
- T-12-03-05: `pkg.status !== 'locked'` kontrolü üç action'da da mevcut

## Deviations from Plan

None — plan tam olarak uygulandı. Ekleme noktaları planla birebir eşleşti.

## Known Stubs

None — server action'lar tam implementasyon; client tarafı (ContentStudioShell) 12-02 kapsamında ayrı plan.

## Threat Flags

Yeni tehdit yüzeyi bulunmadı — tüm yeni endpoint'ler plan'ın threat model'inde kapsandı.

## Self-Check

- [x] `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` mevcut
- [x] Commit `5a4caf7` git log'da mevcut
- [x] `export type ContentSection` grep doğrulandı
- [x] `export async function approveSection` grep doğrulandı
- [x] `export async function rejectSection` grep doğrulandı
- [x] `export async function saveContentSections` grep doğrulandı
- [x] `assembleHtml` ve `html_content` grep doğrulandı
- [x] TypeScript hataları actions.ts kapsamında yok (diğer modüllerdeki hatalar bu plan'ın scope'u dışında)

## Self-Check: PASSED
