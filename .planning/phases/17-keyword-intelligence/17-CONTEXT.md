# Phase 17: Keyword Intelligence - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Her keyword cluster için niche selection skoru ve cluster-to-revenue gelir sınıflandırması hesaplanır. Skor ve sınıflandırma mevcut keyword-stratejisi sayfasındaki cluster görünümünde yeni sütunlar/rozetler olarak gösterilir. Kullanıcı hangi cluster'ların öncelikli yatırım hedefi olduğunu bu görünümden anlayabilir.

Bu faz yeni bir sayfa veya route açmaz — mevcut `/projeler/[id]/keyword-stratejisi` üzerine inşa eder.

</domain>

<decisions>
## Implementation Decisions

### D-01: Skor Hesaplama Zamanı
- **D-01:** Niche skoru **otomatik** hesaplanır — cluster'a keyword eklendiğinde veya çıkarıldığında tetiklenir. Skor DB'ye kaydedilir (`keyword_clusters.opportunity_score` kolonu zaten mevcut). Her sayfa yüklenişinde yeniden hesaplanmaz; kaydedilmiş skor gösterilir.
- **Uygulama:** Server action içinde cluster mutasyonlarının (keyword ekleme/çıkarma) ardından skor güncelleme çağrısı yapılır. Ayrı bir Supabase trigger'a gerek yok.

### D-02: Skor Formülü
- **D-02:** Basit 3 bileşen, sabit ağırlıklar. Tüm veriler mevcut tablolarda:
  - `total_volume` — cluster toplam hacmi (normalize edilmiş)
  - `avg_difficulty` — cluster keyword'lerinin ortalama KD (düşük = iyi, ters normalize)
  - `avg_cpc` — cluster keyword'lerinin ortalama CPC (yüksek = ticari değer)
- **Formül taslağı (planner detaylandırır):** `niche_score = (volume_score * 0.4) + (competition_score * 0.35) + (cpc_score * 0.25)` — 0-100 aralığında normalize edilmiş sonuç.
- **Not:** Formül sabit ağırlıklı — kullanıcı arayüzden ayarlayamaz.

### D-03: Revenue Sınıflandırması
- **D-03:** Cluster'daki keyword'lerin `search_intent` dağılımına göre **otomatik** atanır:
  - Çoğunluk `informational` → **bilgi trafiği** 🟢
  - Çoğunluk `commercial` veya `transactional` → **ticari** 🔴
  - Karma → **mixed** 🟡
- **Override:** Kullanıcı cluster başına manuel olarak revenue_type değerini değiştirebilir (dropdown). DB'deki `revenue_type` kolonu zaten mevcut.

### D-04: UI Yerleşimi
- **D-04:** Mevcut `keyword-stratejisi` sayfasındaki **cluster görünümüne** iki yeni sütun eklenir:
  - `Niche Skoru` — sayısal skor + renk kodu (≥70 violet, ≥40 amber, altı gri — mevcut ScoreBadge pattern'i kullanılır)
  - `Revenue` — bilgi/mixed/ticari rozeti (kullanıcı override dropdown'ı ile)
- Ayrı sayfa veya route açılmaz. Liste sıralama niche skoruna göre yapılabilir olmalı.

### Claude's Discretion
- Niche skor normalize etme algoritması (min-max vs. logaritmik) — planner seçer
- Revenue override dropdown component'i (inline edit vs. select) — mevcut pattern'e uygun seçilir
- Skor sütunu başlangıçta yüklenmemiş cluster'larda nasıl gösterilir (dash vs. skeleton) — Claude karar verir

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Schema
- `supabase/migrations/20260422000001_create_tables.sql` — keyword_clusters temel şema
- `supabase/migrations/20260423000003_product_layers_schema.sql` — keyword_clusters'a eklenen revenue_type, opportunity_score, build_priority, total_volume kolonları

### Mevcut UI
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` — keyword strateji sayfası SSR yapısı
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` — cluster görünümü bileşeni (ScoreBadge pattern içeriyor)
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — mevcut cluster server actions

### Mevcut Veri
- `keywords` tablosu: `volume`, `cpc`, `difficulty`, `search_intent`, `opportunity_score` kolonları kullanılacak
- `keyword_clusters` tablosu: `opportunity_score`, `revenue_type`, `total_volume` kolonları zaten var — yeni migration gerekmeyebilir

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScoreBadge` (ClusterPanel.tsx içinde) — opportunity_score için zaten var, niche skoru için doğrudan kullanılabilir
- `IntentBadge` (IntentBadge.tsx) — intent gösterimi pattern'i, revenue rozeti için referans alınabilir
- `Badge` (shadcn/ui) — revenue sınıflandırması rozeti için

### Established Patterns
- Server action'lar `actions.ts` içinde — cluster mutasyonları (ekleme/çıkarma) buraya skor güncelleme adımı eklenir
- Skor renk kodlaması: `≥70 violet, ≥40 amber, altı gri` — ScoreBadge zaten bu mantığı kullanıyor
- `revalidatePath` ile sayfa güncelleme — mevcut action pattern

### Integration Points
- Keyword ekleme/silme server action'larına `recalculateClusterScore(clusterId)` çağrısı eklenecek
- `keyword_clusters` tablosuna `opportunity_score` yazılacak (kolon mevcut)
- `revenue_type` kolonu otomatik atanacak, kullanıcı override edebilecek

</code_context>

<specifics>
## Specific Ideas

- Cluster listesi niche skoruna göre sıralanabilir olmalı (sütun başlığına tıklayınca)
- Revenue rozeti renk kodu: 🟢 Bilgi, 🟡 Mixed, 🔴 Ticari

</specifics>

<deferred>
## Deferred Ideas

- 6 bileşenli gelişmiş skor (programmatic potansiyel, sezonluk dalgalanma vb.) — Phase 17+ scope
- Ayrı Intelligence sayfası / cluster-to-revenue haritası görünümü — gelecek milestone
- Kullanıcı tarafından ağırlık ayarlama — kapsam dışı

</deferred>

---

*Phase: 17-keyword-intelligence*
*Context gathered: 2026-05-07*
