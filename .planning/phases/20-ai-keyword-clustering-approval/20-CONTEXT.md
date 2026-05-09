# Phase 20: AI Keyword Clustering & Approval - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Mevcut `ClusterButton` akışının önüne bir "önizleme + onay" adımı eklenir. AI keyword gruplarını önce önerir; kullanıcı full-page overlay üzerinde inceler, cluster bazında onaylar/reddeder ve isteğe bağlı olarak bireysel keyword'leri çıkarır. Onaylanan gruplar `keyword_clusters` tablosuna işlenir. Kullanıcı "Stratejiyi Onayla" butonuyla stratejiyi kilitler ve `projects.keyword_strategy_approved = true` olur — Phase 21'deki "Sistemi Kur" gate'ini bu flag tetikler.

Bu faz mevcut `/keyword-stratejisi` sayfası üzerine inşa eder; yeni bir route açılmaz.

</domain>

<decisions>
## Implementation Decisions

### D-01: Öneri Arayüzü — Overlay
- **D-01:** AI kümeleme önerileri **full-page overlay** olarak gösterilir. Mevcut sayfa üzerinde tam ekran panel açılır.
  - Sol panel: Önerilen cluster'lar listesi (her biri için onay/red butonu)
  - Sağ panel: Seçilen cluster'daki keyword listesi (bireysel keyword'leri kaldırma seçeneği)
  - Üst kısım: "Tümünü Onayla" + "Tümünü Reddet" kısayol butonları
  - Alt kısım: "Kapat / İptal" (herhangi bir değişiklik olmadan çıkar)

### D-02: Cluster İsmi Düzenlenebilir
- **D-02:** Overlay içinde cluster adına tıklanınca **inline edit** aktif olur. Kullanıcı ismi değiştirip onaylayabilir. İsim değişikliği o cluster'ın onay kararından bağımsızdır (değiştir, sonra onayla veya reddet).

### D-03: Onay Granularitesi — İkili Seviye
- **D-03:** Kullanıcı **cluster düzeyinde** onay/red yapabilir; aynı zamanda cluster içinden **bireysel keyword'leri kaldırabilir**. Kaldırılan keyword'ler `cluster_id = null` olarak kalır (clustersız havuzda).

### D-04: Reddedilen Cluster'lar
- **D-04:** Reddedilen cluster'lar **arşivlenir** — `keyword_clusters` tablosunda `status = 'rejected'` olarak kalır. Silinmez. Keyword'leri `cluster_id = null` olan havuza döner. Kullanıcı ileride bu cluster'ı geri alabilir.

### D-05: Mevcut Onaylı Cluster'lara Dokunma
- **D-05:** Sistemde zaten `status = 'approved'` cluster'lar varken kullanıcı yeniden kümelendirme başlatırsa **onaylı cluster'lara dokunulmaz**. Yalnızca `status = 'draft'` veya `cluster_id = null` (atanmamış) keyword'ler için yeni öneri üretilir.

### D-06: Gate — "Stratejiyi Onayla" Butonu
- **D-06:** `keyword-stratejisi` sayfasının **toolbar'ına** "Stratejiyi Onayla" butonu eklenir. En az 1 onaylı cluster varsa aktif olur.
- Tıklanınca `projects.keyword_strategy_approved = true` yazar.
- Bu flag Phase 21'de "Sistemi Kur" gate'i için kontrol edilir.
- Onay verildikten sonra buton "✓ Strateji Onaylandı" olarak görünür; tekrar tıklanabilir (onayı geri alabilir).

### D-07: DB Şeması Değişiklikleri
- **D-07:** Gerekli şema güncellemeleri:
  1. `keyword_clusters` tablosuna `status` kolonu eklenir: `'draft' | 'approved' | 'rejected'` — yeni oluşturulan cluster'lar `'draft'` başlar
  2. `projects` tablosuna `keyword_strategy_approved boolean DEFAULT false` kolonu eklenir
  3. Migration dosyası: `supabase/migrations/20260509000010_clustering_approval.sql`

### D-08: Overlay Tetikleme
- **D-08:** Mevcut `ClusterButton` ("AI ile Kümelendirme") tıklanınca:
  1. AI kümeleme çalışır (mevcut `clusterKeywordsWithAI` fonksiyonu)
  2. Sonuçlar `keyword_clusters` tablosuna `status = 'draft'` ile yazılır (DB'ye kaydedilir ama "onaysız")
  3. Overlay açılır — kullanıcı draft cluster'ları görür
  4. Kullanıcı onay/red yapar → status güncellenir

### D-09: Tümünü Onayla Kısayolu
- **D-09:** Overlay'in üstünde "Tümünü Onayla" butonu tüm draft cluster'ları `approved` yapar. "Tümünü Reddet" tümünü `rejected` yapar. Bireysel kararlar bu kısayolların ardından da değiştirilebilir.

### Claude's Discretion
- Overlay animasyonu / transition stili — mevcut UI pattern'e uygun
- "Tümünü Onayla" sonrasında overlay açık kalır mı kapanır mı — Claude karar verir
- Yeniden kümelendirmede draft cluster'ların ne olacağı (eski draft'lar silinir mi, replace mi edilir) — Claude belirler
- keyword_clusters'da `status` kolonu `DEFAULT 'draft'` olur; mevcut cluster'lara migration'da `approved` atanır

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Kümeleme Altyapısı
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` — SSR yapısı, toolbar ve view toggle
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — `clusterAndScoreKeywords` server action (mevcut kümeleme akışı)
- `src/lib/keywords/clustering.ts` — `clusterKeywordsWithAI` + `clusterEnrichedKeywords` implementasyonu
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` — mevcut kümeleme tetikleyici

### Mevcut UI Bileşenleri
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` — cluster görünümü, ScoreBadge pattern
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx` — fetch + router.refresh() pattern referansı

### DB Şeması
- `supabase/migrations/20260422000001_create_tables.sql` — temel tablo şeması
- `supabase/migrations/20260423000003_product_layers_schema.sql` — keyword_clusters ve projects güncel şema

### Requirements
- `KWST-03`, `KWST-04` — `.planning/REQUIREMENTS.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `clusterKeywordsWithAI()` — GPT-4o-mini semantic clustering, zaten production'da
- `ClusterButton` — useTransition + server action pattern; overlay tetikleyici olarak extend edilecek
- `ClusterPanel` — cluster display pattern, ScoreBadge, intent gösterimi — overlay sol paneli için referans
- `Badge` (shadcn/ui) — status badge (draft/approved/rejected) için

### Established Patterns
- Server action → `revalidatePath` → React server component yenileme
- `useTransition` ile optimistic UI
- Full-page overlay henüz yok ama modal pattern mevcut (KeywordImportDialog, MoveKeywordDialog)

### Integration Points
- `keyword_clusters.status` yeni kolon — overlay onay işlemleri bunu günceller
- `projects.keyword_strategy_approved` yeni kolon — "Stratejiyi Onayla" butonu bunu yazar
- `clusterAndScoreKeywords` action genişletilecek: çıktıları `status = 'draft'` ile kaydedecek

</code_context>

<specifics>
## Specific Ideas

- Overlay sol panel: cluster listesi — her satırda isim (inline edit), keyword sayısı, hacim, "Onayla ✓" / "Reddet ✗" butonları
- Overlay sağ panel: seçili cluster'ın keyword'leri — her satırda "✕ Kaldır" butonu
- Üst kısım: "Tümünü Onayla" (yeşil) + "Tümünü Reddet" (kırmızı) kısayolları
- "Stratejiyi Onayla" toolbar butonu: en az 1 approved cluster varken aktif; tıklanınca `projects.keyword_strategy_approved = true`
- Migration: mevcut cluster'lar `status = 'approved'` ile başlar (geriye dönük uyumluluk)

</specifics>

<deferred>
## Deferred Ideas

- Cluster'lar arasında keyword sürükle-bırak (drag & drop) — gelecek UX iyileştirme
- "Strateji versiyonu" — önceki onay geçmişi kayıt — Phase 22 carry-over ile birleştirilebilir
- AI'ın cluster önerisiyle birlikte açıklama/gerekçe vermesi — gelecek milestone

</deferred>

---

*Phase: 20-ai-keyword-clustering-approval*
*Context gathered: 2026-05-09*
