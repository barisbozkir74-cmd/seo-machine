---
phase: 08-page-planner-internal-links
verified: 2026-04-24T00:00:00Z
status: human_needed
score: 15/15 must-haves verified
overrides_applied: 0
human_verification:
  - test: "BulkEditPagesDialog'ı aç; birkaç satırın type/priority/keyword değerlerini değiştir; 'Değişiklikleri Kaydet'e tıkla; dialog kapanır, sayfa refresh olur ve değişiklikler sayfada görünür"
    expected: "Sadece değiştirilen satırlar (dirty Map) updatePageAttributes'a gönderilir; DB güncellenir; sayfada yeni değerler görünür"
    why_human: "Dirty state Map davranışı ve DB upsert'in gerçek ortamda doğru çalışıp çalışmadığını programatik olarak test edemiyorum"
  - test: "ic-link-haritasi sayfasına git; 'Link Öner' butonuna tıkla; yükleme sırasında 'Yükleniyor…' görünmeli; dialog açıldığında master checkbox ve per-row type select çalışmalı; 'Seçilenleri Ekle' sonrası orphan banner güncellenebilmeli"
    expected: "SuggestLinksDialog açılır; pillar→support önerileri listelenir; seçilen satırlar addLink ile eklenir; router.refresh() ile tablo ve orphan banner SSR'dan yenilenir"
    why_human: "Gerçek Supabase DB'de pages/links kaydı olmadan SuggestLinksButton akışını test edemiyorum"
  - test: "Hiç iç link olmayan bir projeye 2+ sayfa ekle, sonra bir kaç link ekle; orphan (linksiz) kalan sayfalar için amber banner görünmeli; tüm sayfalar linklendiğinde banner kaybolmalı"
    expected: "Orphan banner sadece links.length > 0 && orphanPages.length > 0 koşulunda görünür; amber styling doğru"
    why_human: "Orphan hesaplaması SSR'da çalışıyor; gerçek link/page durumunu simüle etmeden göremiyorum"
---

# Phase 8: Page Planner & Internal Links Doğrulama Raporu

**Phase Goal:** Site tree'deki her sayfanın type, focus keyword, intent ve önceliği atanmış olsun; sistem iç link haritası üretsin ve orphan sayfa tespiti yapsın

**Verified:** 2026-04-24
**Status:** human_needed
**Re-verification:** Hayır — ilk doğrulama

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Kanıt |
|---|-------|--------|-------|
| 1 | reorderPage swap güvenli: sentinel -1 ile iki satırın aynı sort_order paylaşması engellenir | ✓ VERIFIED | `sort_order: -1` satır 360'ta doğrulandı; Promise.all pattern kaldırıldı |
| 2 | addPage, slugify + uniqueness check ile slug çakışması önler | ✓ VERIFIED | `safeSlug` değişkeni satır 70-76'da; insert'te kullanılıyor |
| 3 | generatePagesFromClusters clusterIds'leri deduplicate eder | ✓ VERIFIED | `[...new Set(rows.map((r) => r.clusterId))]` satır 208 |
| 4 | GeneratePagesDialog, rows prop identity değiştiğinde state'i sıfırlar | ✓ VERIFIED | `useEffect(() => { setState(initialState) }, [initialState])` satır 73 |
| 5 | MenuEditor items, crypto.randomUUID() ile stable key kullanır | ✓ VERIFIED | satır 27, 42 randomUUID; JSX'te `key={item._key}` satır 79 |
| 6 | updatePageAttributes, page type/focus_keyword_id/priority için bulk upsert yapar | ✓ VERIFIED | `export async function updatePageAttributes` satır 96; `.upsert(payload, { onConflict: 'id' })` satır 142 |
| 7 | suggestInternalLinks, pillar→support çiftleri döner; mevcut source+target kombinasyonlarını hariç tutar; DB'ye yazmaz | ✓ VERIFIED | PILLAR_TYPES/SUPPORT_TYPES satır 91-92; existingPairs Set satır 139; insert/delete sadece addLink/deleteLink'te (satır 17, 55); suggestInternalLinks 94-167 arası sadece SELECT + return |
| 8 | sayfalar/page.tsx header'ında pages.length === 0 iken disabled olan 'Toplu Düzenle' butonu var | ✓ VERIFIED | BulkEditPagesDialog import satır 16; `disabled={pages.length === 0}` satır 106; `allKeywords` query satır 172 |
| 9 | BulkEditPagesDialog, 4 kolonlu scrollable tabloda sayfaları render eder (Tip, Focus Keyword, Öncelik native select) | ✓ VERIFIED | `max-h-[70vh] overflow-y-auto` satır 126; 4 kolon: Sayfa Adı, Tip, Focus Keyword, Öncelik — tüm native select doğrulandı |
| 10 | Sadece dirty satırlar updatePageAttributes'a gönderilir | ✓ VERIFIED | `Map<string, Partial<PageAttributeUpdate>>` dirty state; `Array.from(dirty.entries())` satır 73; `dirty.size === 0` early return satır 71 |
| 11 | ic-link-haritasi/page.tsx, links.length > 0 && orphanPages.length > 0 iken amber orphan banner gösterir | ✓ VERIFIED | `linkedPageIds` Set satır 95; `orphanPages` satır 99-100; amber banner koşulu satır 144-145 |
| 12 | SuggestLinksButton, useTransition ile suggestInternalLinks server action'ı çağırır; fetch sırasında 'Yükleniyor…' gösterir | ✓ VERIFIED | `useTransition` satır 14; `suggestInternalLinks` import+call satır 5, 22; 'Yükleniyor…' text satır 45 |
| 13 | suggestInternalLinks boş array dönerse SuggestLinksButton inline metin gösterir; dialog açılmaz | ✓ VERIFIED | `noResults` state; `"Önerilecek yeni link bulunamadı."` satır 49; dialog sadece `suggestions.length > 0` durumunda açılıyor |
| 14 | SuggestLinksDialog, per-row link type select ve indeterminate state'li master checkbox ile öneri satırları gösterir | ✓ VERIFIED | `masterCheckboxRef` ile indeterminate satır 32-44; per-row select satır 654 civarı; 5 kolonlu tablo |
| 15 | Seçilenleri Ekle, her seçili öneri satırı için addLink çağırır; dialog kapanır ve router.refresh() çağrılır | ✓ VERIFIED | for loop + `addLink` satır 68; `onClose()` satır 79; `router.refresh()` satır 80 |

**Score:** 15/15 truth verified

---

### Required Artifacts

| Artifact | Beklenti | Status | Detaylar |
|----------|----------|--------|----------|
| `src/app/(dashboard)/projeler/[id]/site-blueprint/actions.ts` | WR-01 sentinel swap, WR-02 safeSlug, WR-03 dedup | ✓ VERIFIED | 3 fix de doğrulandı; `sort_order: -1`, `safeSlug`, `new Set(rows.map...)` |
| `src/app/(dashboard)/projeler/[id]/site-blueprint/GeneratePagesDialog.tsx` | useEffect state reset | ✓ VERIFIED | useEffect import satır 3; body satır 73 |
| `src/app/(dashboard)/projeler/[id]/site-blueprint/MenuEditor.tsx` | crypto.randomUUID() stable key | ✓ VERIFIED | randomUUID 2 yerde; `key={item._key}` JSX'te; index key kaldırıldı |
| `src/app/(dashboard)/projeler/[id]/sayfalar/actions.ts` | updatePageAttributes export | ✓ VERIFIED | export async function satır 96; PageAttributeUpdate type satır 85 |
| `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/actions.ts` | suggestInternalLinks + InternalLinkSuggestion export | ✓ VERIFIED | her ikisi de doğrulandı; satır 80, 94 |
| `src/app/(dashboard)/projeler/[id]/sayfalar/BulkEditPagesDialog.tsx` | BulkEditPagesDialog export | ✓ VERIFIED | 226 satır; substantive; updatePageAttributes import+call |
| `src/app/(dashboard)/projeler/[id]/sayfalar/page.tsx` | BulkEditPagesDialog render | ✓ VERIFIED | import satır 16; render satır 202; allKeywords query satır 172 |
| `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksDialog.tsx` | SuggestLinksDialog export | ✓ VERIFIED | 194 satır; substantive; addLink import+call; indeterminate master checkbox |
| `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/SuggestLinksButton.tsx` | SuggestLinksButton export | ✓ VERIFIED | 57 satır; suggestInternalLinks import+call; useTransition |
| `src/app/(dashboard)/projeler/[id]/ic-link-haritasi/page.tsx` | orphanPages + SuggestLinksButton | ✓ VERIFIED | linkedPageIds Set; orphanPages; amber banner; SuggestLinksButton render |

---

### Key Link Verification

| From | To | Via | Status | Detaylar |
|------|----|-----|--------|---------|
| `sayfalar/BulkEditPagesDialog.tsx` | `sayfalar/actions.ts` | updatePageAttributes import | ✓ WIRED | import satır 14; call satır 78 |
| `sayfalar/page.tsx` | `sayfalar/BulkEditPagesDialog.tsx` | import + render | ✓ WIRED | import satır 16; render satır 202 |
| `ic-link-haritasi/SuggestLinksButton.tsx` | `ic-link-haritasi/actions.ts` | suggestInternalLinks import+call | ✓ WIRED | import satır 5; call satır 22 |
| `ic-link-haritasi/SuggestLinksDialog.tsx` | `ic-link-haritasi/actions.ts` | addLink import + sequential call | ✓ WIRED | import satır 13; call satır 68 |
| `ic-link-haritasi/page.tsx` | `ic-link-haritasi/SuggestLinksButton.tsx` | import + render | ✓ WIRED | import satır 16; render satır 166 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Gerçek Veri | Status |
|----------|--------------|--------|-------------|--------|
| `BulkEditPagesDialog.tsx` | `pages`, `keywords` props | `sayfalar/page.tsx` SSR Supabase queries | pages query + allKeywords query DB'den çekiliyor | ✓ FLOWING |
| `ic-link-haritasi/page.tsx` orphan banner | `orphanPages` | `linkedPageIds` Set — DB'den çekilen `internal_links` | links SSR query; pages SSR query; Set farkı | ✓ FLOWING |
| `SuggestLinksButton.tsx` | `suggestions` | `suggestInternalLinks` server action | DB'den pages + keywords + existing links çekiliyor; pillar/support mantığı | ✓ FLOWING |
| `SuggestLinksDialog.tsx` | `rows` state | `suggestions` prop (SuggestLinksButton'dan) | Yukarıdaki suggestInternalLinks verisi | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Uygulama Supabase bağlantısı olmadan çalışamadığından canlı HTTP testleri yapılamadı. Temel dosya/pattern kontrolleri yukarıda tamamlandı.

---

### Requirements Coverage

| Requirement | Kaynak Plan | Açıklama | Status | Kanıt |
|-------------|------------|---------|--------|-------|
| BLUE-04 | 08-01, 08-02 | Sayfa planner: her sayfa için page type, focus keyword, intent ve öncelik atanır | ✓ SATISFIED | updatePageAttributes bulk upsert; BulkEditPagesDialog 4 kolonlu edit tablosu |
| BLUE-05 | 08-01, 08-02 | Internal link haritası üretilir — pillar/support ilişkileri, anchor text önerileri; orphan sayfa tespit edilir | ✓ SATISFIED | suggestInternalLinks pillar→support engine; SuggestLinksDialog; orphanPages SSR computation + amber banner |

**BLUE-04 ve BLUE-05 her ikisi de karşılandı.**

---

### Anti-Patterns Found

| Dosya | Satır | Pattern | Ciddiyet | Etki |
|-------|-------|---------|----------|------|
| — | — | — | — | Tespit edilmedi |

`font-medium` yasak pattern: BulkEditPagesDialog, SuggestLinksButton, SuggestLinksDialog dosyalarının hiçbirinde bulunamadı. ✓

TODO/FIXME/placeholder: Hiçbir yeni dosyada bulunamadı. ✓

`DialogTrigger render={}` pattern (asChild yasak): BulkEditPagesDialog'da doğrulandı satır 102. SuggestLinksDialog programatik `open` prop ile açılıyor — DialogTrigger yok, plan kararına uygun. ✓

---

### Human Verification Required

#### 1. BulkEditPagesDialog — Dirty State & Save Flow

**Test:** Sayfalar sekmesine git → "Toplu Düzenle" butonuna tıkla → birkaç satırın Tip ve Öncelik değerlerini değiştir → "Değişiklikleri Kaydet" butonuna bas
**Expected:** Dialog kapanır; router.refresh() çalışır; sayfada güncel değerler görünür; sadece değiştirilen satırlar DB'ye yazılır (network logunda updatePageAttributes payload'ını gözlemle)
**Why human:** Dirty Map state'in gerçek etkileşimde doğru çalışması ve DB upsert'in başarılı olması canlı ortamda test gerektirir

#### 2. SuggestLinksButton → SuggestLinksDialog → addLink Akışı

**Test:** İç Link Haritası sekmesine git → sayfa tiplerini atanmış pillar (kategori/ana-sayfa) ve support (hizmet/blog) sayfaları bulunan bir projede "Link Öner" butonuna tıkla → dialog açıldıktan sonra birkaç satır seç → "Seçilenleri Ekle" ye bas
**Expected:** Fetch sırasında "Yükleniyor…" görünür; dialog öneri listesiyle açılır; master checkbox indeterminate state çalışır; "Seçilenleri Ekle" sonrası linkler tabloya eklenir ve orphan banner güncellenir
**Why human:** Gerçek Supabase DB'de page_type atanmış pages ve existing links olmadan pillar→support suggestion engine çıktısını test edemiyorum

#### 3. Orphan Banner — Koşullu Gösterim

**Test:** Projeye hiç link eklenmemişken ic-link-haritasi sayfasını aç (banner görünmemeli); ardından bazı linkler ekle ve bazı sayfaları linksiz bırak (amber banner görünmeli ve orphan sayfaları listele); tüm sayfaları linkle (banner kaybolmalı)
**Expected:** Amber banner doğru koşulda görünür ve kaybolur; `links.length > 0 && orphanPages.length > 0` mantığı doğru
**Why human:** SSR state kontrolü canlı ortamda page/link manipülasyonu gerektirir

---

### Gaps Summary

Gap yok. Tüm 15 must-have doğrulandı. Tüm artifactlar var, substantive ve wired. Human verification 3 davranışsal test için gereklidir.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
