---
phase: 08-page-planner-internal-links
created: 2026-04-24
status: ready
---

# Phase 8 Context — Page Planner & Internal Links

## What's Already Built

### `sayfalar/` route
- `sayfalar/page.tsx` — page list table: title, slug, page_type, priority, focus_keyword, AddPageDialog, PageDeleteButton
- `sayfalar/actions.ts` — `createPage`, `deletePage` Server Actions
- `PAGE_TYPE_LABELS` constant: ana-sayfa, kategori, hizmet, urun, blog, landing, hakkimizda, iletisim, sss, fiyatlandirma
- `PriorityBadge` — yüksek (red) / orta (yellow) / düşük (green)

### `ic-link-haritasi/` route
- `ic-link-haritasi/page.tsx` — link table: Kaynak Sayfa | Hedef Sayfa | Anchor Text | Tip badge; AddLinkDialog, LinkDeleteButton
- `ic-link-haritasi/actions.ts` — `addLink`, `deleteLink` Server Actions; link_type: contextual / navigation / footer / breadcrumb

### Database schema (already exists)
- `pages`: id, project_id, user_id, title, slug, page_type, priority, status, focus_keyword_id, parent_id, cluster_id, sort_order
- `internal_links`: id, project_id, user_id, source_page_id, target_page_id, anchor_text, link_type
- `keywords`: id, keyword, intent

**Phase 8 builds on this foundation — no rebuilding of existing features.**

---

## Decisions

### D-01: Sayfa özellik düzenleme UX — Toplu edit tablosu

**Seçim:** Tüm sayfalar tek bir dialog tablosunda gösterilir. Her satırda:
- Sayfa adı (read-only label)
- Type select (mevcut PAGE_TYPE_LABELS değerleri)
- Focus Keyword select (projenin keyword'leri — `keyword` text aranabilir)
- Priority select (yüksek / orta / düşük)

Tek "Kaydet" butonu tüm değiştirilmiş satırları bulk olarak kaydeder.

**Trigger:** `sayfalar/` sayfasında header'da "Toplu Düzenle" butonu → `BulkEditPagesDialog` açılır.

**Server Action:** `updatePageAttributes(projectId, updates: PageAttributeUpdate[])` — tek sorguda tüm satırları günceller (`supabase.from('pages').upsert()`).

**Rationale:** Sayfaların type/keyword/priority'sini tek tek açıp kaydetmek yerine tüm blueprint'i tek seferde doldurmak ajans workflow'unda çok daha hızlı. Toplu edit tablosu mevcut UI diline (tablo ağırlıklı) uygun.

---

### D-02: İç link oluşturma yöntemi — Sistem önerir, kullanıcı onaylar

**Seçim:** Sistem pillar→support ilişkisine göre link önerisi üretir. Kullanıcı önerileri gözden geçirip onaylar veya siler.

**Öneri algoritması:**
- Pillar sayfalar: `page_type IN ('kategori', 'ana-sayfa')`
- Support sayfalar: `page_type IN ('hizmet', 'blog', 'landing', 'urun')`
- Her pillar sayfa için tüm support sayfalara bir önerilen link: pillar → support
- Anchor text: support sayfanın `focus_keyword` değeri (varsa), yoksa `title`
- link_type: 'contextual' (varsayılan)
- Zaten mevcut linkler (aynı source+target) öneri listesinden çıkarılır

**Server Action:** `suggestInternalLinks(projectId)` — önerileri DB'ye yazmaz; `InternalLinkSuggestion[]` döner. Kullanıcı "Hepsini Ekle" veya tek tek onaylayınca `addLink` ile kaydedilir.

**UI:** `ic-link-haritasi/` sayfasında header'da "Öner" butonu → `SuggestLinksDialog` açılır; öneri tablosu gösterilir; her satırda checkbox; "Seçilenleri Ekle" ile `addLink` çağrılır.

**Rationale:** Tamamen otomatik (onaysız) oluşturmak ajans müşterisine gösterilmeden önce hatalı linkler üretebilir. Manuel eklemek ise 20+ sayfalı bir site için çok zahmetli. Öneri + onay dengeli.

---

### D-03: Link haritası görünümü — Tablo

**Seçim:** Mevcut `ic-link-haritasi/page.tsx` tablo yapısı korunur ve genişletilir.

**Tablo kolonları:** Kaynak Sayfa | Hedef Sayfa | Anchor Text | Tip | Durum

**Durum kolonu:** Mevcut önerilen (pending) vs onaylı (confirmed) ayrımı yok — Phase 8'de tüm kayıtlı linkler "aktif" kabul edilir. HTTP status kontrolü ileriki milestone'a ertelendi.

**Orphan uyarısı:** Hiç gelen veya giden linki olmayan sayfalar için amber uyarı banner'ı sayfanın üstünde — "Şu sayfalar hiçbir linke bağlı değil: [liste]".

**Rationale:** React Flow / D3 visual graph Phase 8 kapsamında gereksiz karmaşıklık. Tablo, mevcut UI diline uygun ve hızlı taranabilir. Görsel ağaç vizyon için bir sonraki milestone'a (kullanıcının Phase 8+ vizyonu — Screaming Frog tarzı interaktif ağaç) ertelendi.

---

### D-04: Pillar sayfa tespiti — Otomatik page_type'a göre

**Seçim:** `page_type IN ('kategori', 'ana-sayfa')` olan sayfalar otomatik pillar sayılır. Ek kullanıcı işareti gerekmez.

**Rationale:** Phase 7'de her sayfanın page_type değeri zaten atandı (D-02 intent→page_type kuralı). Mevcut veriyi kullanmak ek UI adımı gerektirmez; kullanıcı Phase 7'yi bitirdiğinde Phase 8 öneri motoru hemen çalışabilir.

**Edge case:** page_type henüz atanmamış (NULL) sayfalar support olarak değil "belirsiz" olarak işaretlenir — öneri tablosunda amber "Tip Atanmamış" uyarısı gösterilir; D-01 toplu düzenleme ile önce tipler atanmalı.

---

### D-05: Orphan page detection

**Tanım:** Projedeki sayfalar arasında `source_page_id` VEYA `target_page_id` olarak hiç görünmeyen sayfa = orphan.

**Gösterim yeri:** `ic-link-haritasi/` sayfasının üstünde amber uyarı banner'ı:
```
⚠ 3 sayfa hiçbir linke bağlı değil: [Hakkımızda], [SSS], [Blog Yazısı 1]
```

**Hesaplama:** SSR'da pure function olarak — `internal_links` sorgusu sonrası, pages listesi ile fark alınır. DB'ye yazılmaz.

**Rationale:** Orphan tespiti için ayrı bir sorgu veya tablo gerektirmez; SSR'da hesaplanır ve anlık gösterilir.

---

## What Phase 8 Must Build

| Item | Route | Type | Note |
|---|---|---|---|
| `updatePageAttributes` Server Action | sayfalar/actions.ts | New | Bulk upsert: type + focus_keyword_id + priority |
| `suggestInternalLinks` Server Action | ic-link-haritasi/actions.ts | New | Returns suggestions, does NOT write to DB |
| `BulkEditPagesDialog` Client Component | sayfalar/ | New | Dialog tablosu: tüm sayfalar, select/input per row, bulk save |
| `SuggestLinksDialog` Client Component | ic-link-haritasi/ | New | Öneri tablosu, checkbox, "Seçilenleri Ekle" |
| `SuggestLinksButton` Client Component | ic-link-haritasi/ | New | useTransition, calls suggestInternalLinks |
| Orphan detection + banner | ic-link-haritasi/page.tsx | Edit | SSR, amber warning banner above table |
| "Toplu Düzenle" button | sayfalar/page.tsx | Edit | Header button → opens BulkEditPagesDialog |

---

## What Phase 8 Must NOT Touch

- `site-blueprint/` route — Phase 7 code, untouched
- `keyword-stratejisi/` route — Phase 6 code, untouched
- `AddLinkDialog` — manual link add still works alongside suggestion flow
- `AddPageDialog` — manual page add still works
- Existing `createPage`, `deletePage`, `addLink`, `deleteLink` actions — extend, don't replace

---

## Open Questions (Resolved)

**Q: Öneri motoru link_type'ı nasıl belirlesin?**
A: Varsayılan 'contextual'. Kullanıcı `SuggestLinksDialog`'da her satırda type'ı değiştirebilir.

**Q: focus_keyword_id olmayan sayfalar için anchor text ne olsun?**
A: Sayfanın `title` değeri kullanılır.

**Q: Öneriler sırada mevcut linklerle çakışırsa ne olsun?**
A: `suggestInternalLinks` action zaten mevcut olan (source+target çifti) linkleri öneri listesinden çıkarır.

**Q: D-01 toplu edit 20+ sayfa için scroll'lanabilir mi?**
A: Dialog `max-h-[70vh] overflow-y-auto` ile scroll destekli yapılır.
