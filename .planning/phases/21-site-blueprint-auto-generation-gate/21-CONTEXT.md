---
phase: 21
name: Site Blueprint Auto-Generation Gate
requirement: BLUE-06
discussion_date: 2026-05-10
status: complete
---

# Phase 21 — Discussion Context

## Goal

Kullanıcı keyword stratejisini onayladıktan sonra "Sistemi Kur" tetiklenince
site blueprint onaylanan gruplardan otomatik olarak oluşturulur.

---

## Decisions

### D-01: "Sistemi Kur" Butonu Yeri — Keyword Stratejisi Sayfası

"Sistemi Kur" butonu **keyword stratejisi sayfasının** araç çubuğuna eklenir
(`KeywordStratejisiToolbar.tsx`) — `StratejiOnaylaButton` yanında.

**Rationale:** Akış sırayla ilerler: stratejiyi onayla → butonu gör → blueprint oluştur.
Proje dashboard'a gitmek araya fazladan adım katar. Blueprint sayfasında zaten
"Kümelerden Oluştur" (manuel akış) var; "Sistemi Kur" AI akışının natural devamıdır.

**Gate:** `isStrategyApproved = false` iken buton disabled ve tooltip gösterir.

---

### D-02: Generation Modu — Mevcut Dialog ile Onaylı Kümeler

"Sistemi Kur" tıklanınca `GeneratePagesDialog` açılır, yalnızca
`status = 'approved'` cluster'ları listeler.

**Rationale:** Dialog, kullanıcının sayfa adlarını / tiplerini son kez gözden
geçirmesine olanak tanır. Onay aşamasında cluster ismi belirlendi ama sayfa
tipi (`hizmet` vs `blog`) burada teyit edilir.

**Filter:** `keyword_clusters.status = 'approved' AND primary_keyword_id IS NOT NULL`
(primary_keyword_id yoksa dialog'a dahil edilmez — focusKeyword zorunlu değil ama
page type önerisi için gerekli).

**Dialog rows hesaplanma yeri:** `keyword-stratejisi/page.tsx` (SSR) — clusters
zaten sorgulanıyor, approved olanlar `approvedDialogRows: DialogRow[]` olarak
`KeywordStratejisiToolbar`'a prop geçilir.

---

### D-03: Çakışma Yönetimi — Güncelle Seçeneği

Cluster_id'si zaten bir sayfaya bağlıysa (`alreadyExists = true`) dialog bu
satırı tamamen disable etmez; kullanıcı "Dahil Et" checkbox'ını işaretleyerek
o sayfayı **güncelleyebilir** (`overwrite: true`).

**Overwrite semantiği:**
- Mevcut sayfa **silinmez**
- `title`, `page_type`, `focus_keyword_id` **güncellenir** (UPDATE)
- Sayfa ID, sort_order, parent_id korunur
- Bağlı page package / içerik kaybolmaz

**Server action değişikliği:** `GenerateRowInput.overwrite?: boolean` eklenir.
Action içinde: overwrite=true + mevcut sayfa var → UPDATE; overwrite=false + mevcut
sayfa var → skip (önceki davranış korunur).

**Result tipi genişler:** `{ created: number; updated: number; skipped: number }`

---

### D-04: Navigasyon — Blueprint Sayfasına Yönlendir

Dialog "Oluştur / Güncelle" butonuna basılıp işlem tamamlandığında
`router.push('/projeler/${id}/site-blueprint')` ile blueprint sayfasına gidilir.

**Toast:** `${created} sayfa oluşturuldu${updated > 0 ? `, ${updated} güncellendi` : ''}`

---

### D-05: `intentToPageType` ve `stripIntentSuffix` Paylaşımı

`intentToPageType` → `site-blueprint/page-utils.ts`'den import edilir.
`stripIntentSuffix` → inline kopyalanır (3 satır, DRY feda edilebilir).

Her ikisi de `keyword-stratejisi/page.tsx`'de `approvedDialogRows` hesaplanırken kullanılır.

---

### D-06: `alreadyExists` Hesaplama — Küçük Ek Sorgu

`keyword-stratejisi/page.tsx`'de `alreadyExists` hesabı için:

```sql
SELECT cluster_id FROM pages
WHERE project_id = $id AND user_id = $userId AND cluster_id IS NOT NULL
```

Dönen `cluster_id` listesi `Set<string>` olarak tutulur;
`approvedDialogRows` hesaplanırken `alreadyExists: clusterIdsWithPages.has(c.id)` olarak kullanılır.

---

### D-07: Blueprint Sayfasındaki "Kümelerden Oluştur" Butonuna Dokunulmaz

Mevcut `GenerateFromClustersButton` (site-blueprint sayfası) olduğu gibi kalır —
sadece `primary_keyword_id !== null` filtresini kullanır, tüm enriched cluster'ları gösterir.
Bu manuel fallback akışıdır; Phase 21 onu değiştirmez.

---

### D-08: `GeneratePagesDialog` Değişikliği Kapsamı

`alreadyExists = true` satırlar için:
- Checkbox **disabled değil**, aktif kalır (kullanıcı dahil edebilir)
- "Zaten var" badge korunur (uyarı rengi)
- `include = true` AND `alreadyExists = true` → payload'da `overwrite: true`
- `include = false` AND `alreadyExists = true` → payload'a eklenmez (skip)
- Dialog footer butonu: "Oluştur" → "Oluştur / Güncelle" (her zaman bu label; mevcut dialog'u bozmaz)

---

## Wave Plan

| Wave | Plan | Kapsam |
|------|------|--------|
| 0 | 21-01-PLAN.md | `generatePagesFromClusters` overwrite desteği + `GenerateResult.updated` + vitest |
| 1 | 21-02-PLAN.md | `GeneratePagesDialog` güncelleme + `KeywordStratejisiToolbar` "Sistemi Kur" + `keyword-stratejisi/page.tsx` `approvedDialogRows` |

---

## Files to Change / Create

| File | Change |
|------|--------|
| `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` | `GenerateRowInput.overwrite?: boolean`, UPDATE path, `GenerateResult.updated` |
| `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` | alreadyExists rows interactive, overwrite toggle, footer label |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordStratejisiToolbar.tsx` | "Sistemi Kur" button, open dialog, router.push on success |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | approvedDialogRows computation, pages query for alreadyExists, pass to toolbar |

---

## Out of Scope (Deferred)

- Blueprint sayfasındaki "Kümelerden Oluştur" değiştirilmez (D-07)
- Hierarchy / parent-child page generation (Phase 21 sadece flat list üretir)
- Rejected cluster'lardan "geri al" akışı
- Keyword strategy sayfasındaki "Sistemi Kur" butonu Phase 23 AI katmanıyla entegrasyon
