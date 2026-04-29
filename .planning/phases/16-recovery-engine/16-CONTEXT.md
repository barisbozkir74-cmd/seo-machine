# Phase 16: Recovery Engine — Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Pozisyon düşüşü yaşayan sayfaları otomatik tespit ederek `recovery_tasks` tablosuna kaydetmek, kullanıcıya izleme dashboard'unun Recovery sekmesinde sunmak ve güncelleme akışını başlatmak.

**Scope:**
- n8n daily workflow → decay detection → recovery_tasks INSERT
- `page_packages` kaynaklı decay (GSC delta_position)
- `project_imported_pages` kaynaklı recovery (flag_weak_page + gsc_avg_position)
- İzleme sayfasında Recovery sekmesi (3. sekme)
- Güncelle butonu → Page Package editor → task in_progress

**Kesinlikle kapsam dışı:**
- Decay eşiğinin UI'dan kullanıcı tarafından ayarlanması (Phase 17+)
- Otomatik page_package draft oluşturma (imported pages için — manuel aksiyon)
- Date range picker (Phase 16+ — ertelenmiş)
- Revision history, yeni WP credential UI

</domain>

<decisions>
## Implementation Decisions

### D-01: Recovery Tasks DB Şeması
- **D-01:** Yeni `recovery_tasks` tablosu oluşturulur — `page_packages` üzerine kolon eklenmez.
- **D-02:** Tablo alanları: `id`, `project_id`, `source` ('page_package' | 'imported_page'), `source_id` (UUID — hangi tabloya bağlı olduğu `source` ile belirlenir), `title` (sayfa başlığı snapshot), `page_url` (URL snapshot), `position_before`, `position_after`, `detected_at`, `status`, `created_at`, `updated_at`.
- **D-03:** `status` 4 değer: `open` | `in_progress` | `resolved` | `dismissed`.
  - `open` = decay tespit edildi, aksiyon alınmadı
  - `in_progress` = kullanıcı Güncelle'ye bastı, paket düzenleniyor
  - `resolved` = WP'ye tekrar publish edildi (wp_published_at güncellendi) → **otomatik** olarak resolved
  - `dismissed` = kullanıcı "görmezden gel" dedi, listeden kalkar
- **D-04:** `resolved` geçişi otomatiktir — `publishToWordPress` aksiyonunda aynı `page_packages.id` için open/in_progress recovery task varsa → resolved güncellenir.

### D-05: Decay Detection Eşiği (page_packages için)
- **D-05:** Phase 15 ile tutarlı: `delta_position >= +5` AND `impressions > 10`. Kullanıcı bu eşiği UI'dan değiştiremez (Phase 17+ scope).
- **D-06:** n8n workflow günlük çalışır; son 7 gün ile önceki 7 günü karşılaştırır (ROADMAP.md REC-01 tanımına göre).
- **D-07:** Aynı sayfa için birden fazla decay kaydı oluşabilir (her günlük çalışmada). n8n ekleme öncesinde mevcut `open` kaydı kontrol eder — zaten open ise yeni kayıt açmaz (duplicate prevention).

### D-06: Kullanıcı UX
- **D-08:** Recovery görevleri `/projeler/[id]/izleme` sayfasında görünür — ayrı route yok.
- **D-09:** İzleme sayfasına 3. içerik sekmesi eklenir: **"Recovery"**. Mevcut "Cluster Performansı" ve "Sayfa Performansı" bölümleri de sekme yapısına taşınır (veya Recovery ayrı section olarak eklenir — planner karar verir, sekme sayısı 3 olacak şekilde).
- **D-10:** Recovery sekmesinde her satır: sayfa başlığı + URL + pozisyon kaybı (`+N.N`) + durum badge (open/in_progress/dismissed) + **"Güncelle"** butonu.
- **D-11:** "Güncelle" butonu: `page_packages` kaynaklı task → Page Package editor'a yönlendirir (`/projeler/[id]/sayfalar` veya doğrudan editor route'u); task status → `in_progress`.
- **D-12:** "Güncelle" butonu için imported_page kaynaklı task: `/projeler/[id]/site-analizi` sayfasına yönlendirir (import edilmiş sayfanın kaydı orada görünür).
- **D-13:** Dismissed görevler varsayılan olarak gizlenir; "Dismissed'ı göster" toggle ile görüntülenebilir.

### D-07: REC-03 — Imported Pages Recovery
- **D-14:** Eşik: `flag_weak_page = true` VE `gsc_avg_position > 20`. Bu, Phase 15.5 D-10 ile tutarlıdır (`weak_page` zaten bu iki koşuldan hesaplanıyor — pozisyon threshold aynı kalıyor).
- **D-15:** n8n (veya API route) `project_imported_pages` tablosunu tarar; eşiği karşılayan sayfaları `recovery_tasks`'a `source='imported_page'`, `source_id = project_imported_pages.id` ile kaydeder.
- **D-16:** Otomatik `page_package` draft oluşturulmaz — kullanıcı Recovery sekmesinde "Güncelle"ye basarsa site-analizi sayfasına yönlendirilir, oradan manuel aksiyon başlatabilir.

### Claude's Discretion
- n8n workflow implementasyon detayı: Supabase REST API mi yoksa custom webhook endpoint mi kullanılacak? Claude araştırır.
- Decay detection: n8n bir Supabase Edge Function / Next.js API route çağırır mı, yoksa doğrudan Supabase REST üzerinden mi veri okur? Claude karar verir.
- `recovery_tasks` RLS politikaları: standart `project_id` + `user_id` ownership pattern uygulanır.
- Imported page resolved geçişi: imported_page recovery task'ın ne zaman resolved olacağı net değil (WP publish yok). "Dismissed" = çözüm yolu. Claude araştırır.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 15 — Decay Detection Logic (analog)
- `src/lib/monitoring/aggregation.ts` — `getPageMetrics()` içindeki `isDecayed` hesaplama mantığı; `delta_position >= 5 && impressions > 10` pattern. Phase 16 bu mantığı n8n workflow'a taşır.
- `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` — İzleme sayfası SSR yapısı; Recovery sekmesi buraya eklenir.
- `src/app/(dashboard)/projeler/[id]/izleme/period-tab-bar.tsx` — PeriodTabBar UI pattern; içerik sekme yapısı için analog.

### Phase 15.5 — Imported Pages
- `supabase/migrations/20260428000001_imported_pages.sql` — `project_imported_pages` şeması (flag_weak_page, gsc_avg_position, gsc_impressions)
- `src/lib/wp/audit-flags.ts` — `flag_weak_page` hesaplama mantığı (tıklama < 10 AND pozisyon > 20)

### Phase 13 — WP Publish (resolved trigger)
- `src/app/(dashboard)/projeler/[id]/actions.ts` — `publishToWordPress` server action; bu aksiyon recovery task'ı resolved'a çevirecek.

### GSC Metrics Schema
- `supabase/migrations/20260427000002_gsc_schema.sql` — `gsc_metrics` tablo şeması (page_id, date, clicks, impressions, avg_position)

### Page Packages Schema
- `supabase/migrations/20260424000005_create_page_packages.sql` — `page_packages` şeması
- `supabase/migrations/20260426000002_add_wp_columns.sql` — `wp_post_url`, `wp_post_id`, `wp_published_at` kolonları

### ROADMAP
- `.planning/ROADMAP.md` §Phase 16 — Success criteria, requirements (REC-01, REC-02, REC-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/monitoring/aggregation.ts`: `buildDateRanges()` ve `reduceMetrics()` helper'ları — n8n veya API route için decay detection'da doğrudan kullanılabilir.
- `src/app/(dashboard)/projeler/[id]/izleme/page.tsx`: SSR sayfa; Recovery sekmesi content tab olarak buraya eklenir.
- `src/app/(dashboard)/projeler/[id]/sayfalar/`: Page list + editor pattern (Güncelle yönlendirmesi için referans).
- `src/lib/supabase/server.ts` `createClient()`: Tüm server-side DB işlemleri.

### Established Patterns
- 4 durum (status) pattern: `page_packages.status` ('draft' | 'approved' | 'locked') ile analoji — `recovery_tasks.status` ('open' | 'in_progress' | 'resolved' | 'dismissed').
- RLS ownership: `project_id` + `auth.uid() = user_id` (tüm tablolarda).
- Türkçe UI: tüm kullanıcıya gösterilen metin Türkçe.
- Badge className direkt renk ataması: `flag_weak_page` badge pattern'ine benzer.

### Integration Points
- `publishToWordPress` server action: `wp_published_at` güncellendiğinde recovery_tasks resolved tetiklemesi eklenir.
- `gsc_metrics` tablosu: decay comparison için kaynak (page_id, date, avg_position).
- `project_imported_pages` tablosu: flag_weak_page + gsc_avg_position kaynak veri.
- İzleme sayfası: Recovery sekmesi SSR'da `recovery_tasks` tablosunu okur.

</code_context>

<specifics>
## Specific Ideas

- Recovery sekmesi boş durum: "Tespit edilen pozisyon düşüşü yok — sayfalar sağlıklı görünüyor." mesajı.
- `dismissed` badge rengi: gri. `open` badge: kırmızı. `in_progress` badge: sarı.
- n8n workflow: önce `gsc_metrics` üzerinden decay hesaplar → sonra `project_imported_pages` üzerinden weak page tarar → her iki kaynaktan da recovery_tasks'a INSERT atar.
- Pozisyon kaybı gösterimi: "+5.3 pozisyon" şeklinde (daha büyük sayı = daha kötü).

</specifics>

<deferred>
## Deferred Ideas

- **Decay eşiği UI'dan ayarlanabilir** — Phase 17+ scope.
- **Date range picker** — Phase 15'ten ertelenmiş, Phase 16+ scope.
- **Toplu dismiss / toplu resolve** — Recovery sekmesinde bulk aksiyon; Phase 16 scope dışı.
- **Recovery e-posta bildirimi** — Otomatik email alert istenmedi; Phase 17+ scope.
- **Imported page → otomatik page_package draft** — Kullanıcı istemedi; manuel aksiyon yeterli.

</deferred>

---

*Phase: 16-recovery-engine*
*Context gathered: 2026-04-29*
