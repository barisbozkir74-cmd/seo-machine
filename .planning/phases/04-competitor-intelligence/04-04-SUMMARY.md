---
phase: 04-competitor-intelligence
plan: "04"
subsystem: competitor-intelligence
tags: [gap-closure, content-areas, opportunity-score, own-domain-persist, input-validation]
dependency_graph:
  requires: [04-01, 04-02, 04-03]
  provides: [COMP-03, COMP-04, CR-01-fix, CR-02-fix, WR-01-fix, WR-02-fix, WR-03-fix]
  affects: [rakipler-page, actions-competitors, own-domain-analyze]
tech_stack:
  added: []
  patterns:
    - "SSR DB-first pattern: own_category_structure DB'den okunuyor, SSR'da DataForSEO çağrısı yok"
    - "Server Action persist + revalidatePath: OwnDomainAnalyzeButton artık kalıcı state değişikliği üretiyor"
    - "Set<string> for opportunityCategories — SSR'da hesaplanıyor, serialize edilmiyor"
key_files:
  created:
    - supabase/migrations/20260424000001_add_own_category_structure.sql
  modified:
    - src/app/(dashboard)/projeler/[id]/rakipler/actions.ts
    - src/app/(dashboard)/projeler/[id]/rakipler/OwnDomainAnalyzeButton.tsx
    - src/app/(dashboard)/projeler/[id]/rakipler/page.tsx
decisions:
  - "own_category_structure JSONB olarak projects tablosuna eklendi — fetchOwnDomainData artık DB'ye yazıyor"
  - "OwnDomainAnalyzeButton statik import kullanıyor — dynamic import kaldırıldı"
  - "content_areas 'Diğer' kategorisi hariç tutarak CategoryStructure ile aynı shape kullanıyor"
  - "opportunityCategories: Set<string> — SSR'da hesaplanıyor, JSON serialization sorunu yok"
  - "addCompetitors MAX_DOMAINS=20 hard cap + 253 char RFC 1035 filter + ignoreDuplicates:true"
metrics:
  duration: "12 min"
  completed: "2026-04-23T22:25:02Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 4 Plan 4: Gap Closure Summary

**One-liner:** VERIFICATION.md blocker'larının tamamı kapatıldı — content_areas DB'ye yazılıyor, OwnDomainAnalyzeButton kalıcı state üretiyor, Fırsat Skoru sütunu eklendi, addCompetitors güvenlik validasyonu tamamlandı.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DB migration + actions.ts gap düzeltmeleri | f7be8f5 | supabase/migrations/20260424000001_add_own_category_structure.sql, actions.ts |
| 2 | OwnDomainAnalyzeButton yeniden yazım + page.tsx güncellemesi | a9c9a8b | OwnDomainAnalyzeButton.tsx, page.tsx |

## What Was Built

### Task 1: DB Migration + Actions Gap Fixes

**Migration — `20260424000001_add_own_category_structure.sql`:**
- `projects` tablosuna `own_category_structure JSONB` kolonu eklendi (`IF NOT EXISTS` guard ile)

**actions.ts değişiklikleri:**

- **COMP-03 FIX:** `fetchCompetitorData` içinde `contentAreas` hesaplanıyor — `categoryStructure`'dan "Diğer" hariç tüm kategoriler; `competitors.update()` çağrısına `content_areas: contentAreas` eklendi
- **CR-01 FIX:** `fetchOwnDomainData` artık DataForSEO sonucunu `projects.own_category_structure`'a persist ediyor + `revalidatePath` çağırıyor
- **CR-02 FIX:** `addCompetitors` — `domains.length > MAX_DOMAINS (20)` early return eklendi
- **WR-01 FIX:** `.insert(rows)` → `.upsert(rows, { onConflict: 'project_id,domain', ignoreDuplicates: true })`
- **WR-02 FIX:** `catch { return null }` → `catch (err) { console.error('[fetchOwnDomainData] DataForSEO error:', err); return null }`
- **WR-03 FIX:** `fetchOwnDomainData` başına null domain guard — `!domain || domain.trim() === '' || domain === 'null'` → erken return

### Task 2: OwnDomainAnalyzeButton + page.tsx

**OwnDomainAnalyzeButton.tsx:**
- Dynamic import (`import('./actions')`) kaldırıldı → statik `import { fetchOwnDomainData } from './actions'`
- Artık `await fetchOwnDomainData(projectId, domain)` çağrısı persist + revalidate tetikliyor; `window.location.reload()` sonrasında SSR DB'den güncel veri okuyor

**page.tsx değişiklikleri:**

- **SSR DB-first:** `fetchOwnDomainData()` SSR çağrısı kaldırıldı → `project.own_category_structure` DB'den okunuyor; `projects` select listesine `own_category_structure` eklendi
- **`fetchOwnDomainData` import kaldırıldı** — artık page.tsx'de SSR'da çağrılmıyor
- **Competitor type:** `content_areas: Record<string, unknown> | null` eklendi
- **Supabase sorgusu:** `content_areas` select listesine eklendi
- **"İçerik Alanları" sütunu:** Rakip tablosunda; ilk 3 kategori badge olarak gösteriliyor, fazlası `+N` ile
- **GapMatrix type:** `opportunityCategories: Set<string>` eklendi
- **`buildGapReport`:** Fırsat kategorilerini hesaplıyor (kullanıcı yok ama 2+ rakip var)
- **Gap tablosunda "Fırsat" sütunu:** `opportunityCategories.has(cat)` ile amber badge

## Success Criteria Verification

| Kriter | Durum | Kanıt |
|--------|-------|-------|
| SC-3 (COMP-03): content_areas DB'ye yazılıyor ve "İçerik Alanları" sütununda görünüyor | TAMAMLANDI | `content_areas: contentAreas` actions.ts satır 225; page.tsx TableHead "İçerik Alanları" |
| SC-4 (COMP-04) CR-01: OwnDomainAnalyzeButton tıklandıktan sonra "Sizin Siteniz" sütunu doluyor | TAMAMLANDI | `own_category_structure` persist, revalidatePath, SSR DB okuma |
| SC-4 (COMP-04) Fırsat: Gap tablosunda "Fırsat" sütunu; 2+ rakip var kullanıcı yok kategoriler işaretleniyor | TAMAMLANDI | `opportunityCategories` + `gapReport.opportunityCategories.has(cat)` |
| CR-02: addCompetitors max 20 domain, max 253 char | TAMAMLANDI | `MAX_DOMAINS=20` + `.filter((d) => d.trim().length > 0 && d.length <= 253)` |
| WR-01: ignoreDuplicates:true | TAMAMLANDI | `.upsert(rows, { onConflict: 'project_id,domain', ignoreDuplicates: true })` |
| WR-02: catch bloğu console.error | TAMAMLANDI | `console.error('[fetchOwnDomainData] DataForSEO error:', err)` |
| WR-03: null domain guard | TAMAMLANDI | `if (!domain || domain.trim() === '' || domain === 'null') return null` |
| TypeScript hataları yok | TAMAMLANDI | `npx tsc --noEmit` çıktı üretmedi |

## Deviations from Plan

### Pre-existing Changes

Planın çoğu değişikliği (actions.ts, OwnDomainAnalyzeButton.tsx, page.tsx) daha önceki çalışmada zaten uygulanmıştı. Bu plan yürütmesinde:
- Yalnızca migration dosyası (`20260424000001_add_own_category_structure.sql`) yeni oluşturuldu
- Tüm kod değişiklikleri mevcut durumu doğrulandı ve commit edildi

### Rule Deviations

None - plan tam olarak belirtildiği şekilde uygulandı.

## Known Stubs

None — tüm veri akışları wired, stub yok.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: data-write | actions.ts | `projects.own_category_structure` yazma: `.eq('user_id', user.id)` ownership filtresi mevcut (T-04-13 mitigate edildi) |
| threat_flag: data-read | page.tsx | `own_category_structure` SSR okuma: `eq('user_id', user.id)` filtresi mevcut (T-04-14 mitigate edildi) |
| threat_flag: dos | actions.ts | addCompetitors MAX_DOMAINS=20 + 253 char filtresi (T-04-12 mitigate edildi) |

## Self-Check: PASSED

- `supabase/migrations/20260424000001_add_own_category_structure.sql` — FOUND
- `actions.ts` commit f7be8f5 — FOUND
- `page.tsx` + `OwnDomainAnalyzeButton.tsx` commit a9c9a8b — FOUND
- TypeScript: `npx tsc --noEmit` — no errors
