---
phase: 22
name: Polish & Carry-overs
requirements: MON-03, PAGE-05
discussion_date: 2026-05-10
status: complete
---

# Phase 22 — Discussion Context

## Goal

Monitoring dashboard imported page verileriyle zenginleştirilir ve her sayfa
paketinin geçmiş versiyonları revision history olarak izlenebilir hale gelir.

---

## Decisions

### D-01: MON-03 — Imported Pages UI Yeri

Imported pages, izleme sayfasındaki **mevcut 'Sayfalar' sekmesine** eklenir.
Ayrı bir sekme oluşturulmaz; cluster özetleri sekmesine dahil edilmez.

**Rationale:** Kullanıcı zaten "Sayfa Performansı" sekmesini takip ediyor.
Ayrı sekme sayfa sayısını artırır ve bağlam kaybına neden olur.

---

### D-02: MON-03 — GSC Gate'i Kaldır (Pages Tab için)

GSC bağlantısı olmayan projelerde de imported pages `pages` sekmesinde görünür.

**Mevcut davranış:** `gscConnected === false` → tüm içerik gizlenir, "GSC verisi
bulunamadı" mesajı gösterilir.

**Yeni davranış:** `gscConnected === false` iken kümeler ve recovery sekmeleri
gizlenebilir (mevcut mantık), ancak **pages sekmesi açıksa imported pages yine
de listelenir**. Pratik uygulama: default tab `pages` değil `clusters` olduğu için
GSC'siz kullanıcı `tab=pages` ile manuel gidebilir ve imported pages'i görür.

**Implementasyon notu:** `project_imported_pages` fetchi `gscConnected` koşulundan
bağımsız her zaman yapılır. `pages` tab renderı ya gscConnected koşulundan çıkartılır
ya da imported pages ayrıca eklenir.

---

### D-03: MON-03 — Cluster Özetlerine Dahil Edilmez

`ClusterSummaryTable` (kümeler sekmesi) imported pages'i hesaba katmaz.
"Bağlanmamış" satırı eklenmez.

**Rationale:** Cluster özetleri GSC metriği gerektiriyor. Imported pages'in
cluster bağlantısı olmayabilir veya farklı bir intent grubu oluşturabilir.
Sayısal bozulmayı önlemek için kümeler sekmesi dokunulmaz bırakılır.

---

### D-04: PAGE-05 — Revision Tetikleyici

Her **"Kaydet"** aksiyonunda (sayfa paketi kaydedildiğinde) **otomatik** olarak
bir revision snapshot'ı oluşturulur.

**Davranış:** Kaydet çağrılmadan önce mevcut `page_packages` verisi `page_package_revisions`
tablosuna yazılır, ardından asıl UPDATE çalışır.

**DB şeması (yeni tablo):**
```sql
CREATE TABLE page_package_revisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  uuid NOT NULL REFERENCES page_packages(id) ON DELETE CASCADE,
  page_id     uuid NOT NULL,
  project_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  snapshot    jsonb NOT NULL,     -- page_packages satırının o anki hali
  version_num integer NOT NULL,  -- 1-based, auto-increment per package
  created_at  timestamptz DEFAULT now()
);
```

---

### D-05: PAGE-05 — Geçmiş Listesi UI Yeri — Drawer/Sheet

"Geçmiş" butonu editor'ün sağ üstüne eklenir. Tıklanınca sağdan bir
**Sheet (drawer)** açılır; revision listesini gösterir.

**Avantaj:** Editor kapanmaz, kullanıcı geçmiş ile editörü aynı anda
görebilir. Sayfa layout'u bozulmaz.

**Bileşen:** `RevisionHistorySheet.tsx` — shadcn/ui `Sheet` bileşenini kullanır.

---

### D-06: PAGE-05 — Geri Yükleme Davranışı — Preview → Yükle → Manual Kaydet

Revision listesinde her satıra "Önizle" butonu eklenir. Tıklanınca
**read-only preview modal** açılır. Modal içinde **"Bunu Yükle"** butonu:
- Modal kapanır
- İlgili revision verisi editor'e yüklenir (state'e set edilir — kaydedilmez)
- Kullanıcı değişiklik yapabilir veya doğrudan "Kaydet" butonuna basabilir
- "Kaydet" aksiyonu normal revision oluşturma akışını çalıştırır (D-04)

**Bileşen:** `RevisionPreviewDialog.tsx` — içeriği read-only gösterir,
"Bunu Yükle" callback'ini üst bileşene (Sheet) iletir.

---

## Implementation Notes

### MON-03 Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` | `project_imported_pages` fetch eklenir (gscConnected'dan bağımsız); `pages` tab renderı imported pages dahil olacak şekilde güncellenir |
| `src/app/(dashboard)/projeler/[id]/izleme/page-metrics-table.tsx` | Imported pages satırları eklenir — GSC verisi olmadığında sütunlar boş/dash gösterir |
| `src/lib/monitoring/aggregation.ts` | `getPageMetrics` imported pages'i de döndürecek şekilde güncellenir veya ayrı `getImportedPageMetrics` fonksiyonu eklenir |

### PAGE-05 Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `supabase/migrations/` | `page_package_revisions` tablosu migration |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (veya mevcut save action) | Kaydet öncesi revision insert |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionHistorySheet.tsx` | YENİ — Sheet + revision listesi |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/RevisionPreviewDialog.tsx` | YENİ — Preview modal + "Bunu Yükle" |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | "Geçmiş" butonu eklenir, yükleme callback'i işlenir |

---

## Out of Scope (Deferred)

- Revision saklama limiti (ilk iterasyonda unlimited — cleanup job ileride)
- Imported pages'i bir cluster'a bağlama akışı
- Kümeler sekmesinde imported pages sayısı (D-03 — dahil edilmez)
- GSC'siz projelerde clusters/recovery sekmeleri gösterimi değişmez
