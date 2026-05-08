---
phase: 18-project-launch-gate-sector-research
verified: 2026-05-08T10:30:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Zorunlu alanlar eksikken buton disabled, tüm alanlar dolunca aktif"
    expected: "sector, initial_competitors, target_keywords alanlarından en az biri boşken buton disabled görünür; tümü dolunca enabled olur"
    why_human: "canLaunch boolean'ı doğru kod akışına sahip ancak CompetitorsTagInput ve KeywordsTagInput bileşenleri kendi state'lerini yönetiyor — data['initial_competitors'] ve data['target_keywords'] state değerlerinin bu custom bileşenlerden güncellenmesini programatik doğrulayamıyorum"
  - test: "'Projeyi Başlat' tıklandığında araştırma tetikleniyor ve loading state çalışıyor"
    expected: "Tıklama sonrası 'Araştırılıyor...' spinner görünür, sayfa değişmez; tamamlanınca emerald 'Araştırma tamamlandı ✓' bloğu belirir ve /arastirma linki gösterilir"
    why_human: "SERPAPI_KEY ve ANTHROPIC_API_KEY env var gerektiriyor — canlı dış servis çağrısı; test ortamında key olmadan uçtan uca akış doğrulanamaz"
  - test: "Hata durumunda inline error görünür, buton enabled state'e döner"
    expected: "SerpAPI yapılandırılmamışsa 'SerpAPI anahtarı yapılandırılmamış...' mesajı görünür; genel hatalarda 'Araştırma başarısız oldu...' mesajı görünür; her iki durumda buton tekrar tıklanabilir hale gelir"
    why_human: "Hata yolunu test etmek için kasıtlı hatalı key yapılandırması gerekiyor — live environment gereksinimi"
  - test: "/arastirma sayfasında 'Yeniden Araştır' butonu h1 sağında görünüyor"
    expected: "flex justify-between layout'ta h1 solda, ResearchRerunButton sağda; tıklanınca araştırma yeniden başlıyor ve router.refresh() ile veriler yenileniyor"
    why_human: "UI render ve layout görsel doğrulama"
---

# Phase 18: Project Launch Gate & Sector Research Doğrulama Raporu

**Phase Goal:** Proje bilgileri eksiksiz girildiğinde kullanıcı 'Projeyi Başlat' butonuna tıklayabilir; sistem sektör araştırmasını otomatik yapar ve sonuçları /arastirma sayfasında gösterir.
**Doğrulandı:** 2026-05-08T10:30:00Z
**Durum:** human_needed
**Yeniden Doğrulama:** Hayır — ilk doğrulama

---

## Hedef Başarısı

### Gözlemlenebilir Doğrular (Roadmap Success Criteria)

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | Kullanıcı zorunlu alanlar eksikken "Projeyi Başlat" disabled görür; tüm alanlar dolduğunda aktifleşir | ✓ DOĞRULANDI | `ProjectInfoSection.tsx:244-254` — `canLaunch` boolean'ı sector + initial_competitors + target_keywords trim kontrolü yapıyor; `Button disabled={!canLaunch \|\| isResearching}` (satır 339) |
| 2 | "Projeyi Başlat" tetiklenince sistem Google arama sorguları oluşturur ve sektör araştırmasını başlatır | ✓ DOĞRULANDI | `handleLaunch` → `/api/research/trigger` POST → `runSectorResearch()` → `buildSearchQueries()` + `fetchSerpResults()` zinciri eksiksiz |
| 3 | Sistem sektör + rakipler + ana keywordlerden otomatik arama sorguları üretir | ✓ DOĞRULANDI | `sector-research.ts:52-85` — `buildSearchQueries()`: sektör sorgusu + max 3 rakip sorgusu + max 2 keyword sorgusu + genel fırsat sorgusu, toplam max 7 sorgu |
| 4 | Araştırma tamamlandığında pazar özeti, rakip konumları, sektör açıkları ve fırsatlar içeren rapor oluşur | ✓ DOĞRULANDI | `analyzeWithClaude()` claude-sonnet-4-6 ile 5 bölümlü JSON üretiyor: market_structures, competitor_strengths, competitor_weaknesses, quick_wins, high_value_opportunities; `saveReport()` research_reports'a upsert ediyor |
| 5 | Kullanıcı araştırma raporunu projeye ait dedicated bölümde görüntüler | ✓ DOĞRULANDI | `arastirma/page.tsx` research_reports'tan 5 bölümü çekip ResearchSection ile render ediyor; ResearchRerunButton mevcut |

**Puan:** 5/5 doğru doğrulandı

---

### Gerekli Artifaktlar

| Artifakt | Beklenen | Durum | Detay |
|----------|----------|-------|-------|
| `src/lib/supabase/vault.ts` | getSerpApiKey() — env var önce, vault fallback | ✓ DOĞRULANDI | Satır 104-119: env var öncelikli, vault.decrypted_secrets fallback, throw on miss |
| `src/lib/research/sector-research.ts` | runSectorResearch() — tam pipeline | ✓ DOĞRULANDI | 242 satır; import 'server-only'; tüm sub-fonksiyonlar mevcut; stub yok |
| `src/app/api/research/trigger/route.ts` | POST handler — IDOR korumalı | ✓ DOĞRULANDI | 71 satır; tam implementasyon; IDOR + gate + runSectorResearch çağrısı |
| `src/app/(dashboard)/projeler/[id]/ProjectInfoSection.tsx` | Launch gate butonu + hint + completed block | ✓ DOĞRULANDI | canLaunch (satır 244), handleLaunch (satır 256), emerald completed block (satır 326-334), Eksik: hint (satır 352-354) |
| `src/app/(dashboard)/projeler/[id]/page.tsx` | hasResearch prop + userId aktarımı | ✓ DOĞRULANDI | research_reports sorgusu (satır 35-41), hasResearch prop (satır 80-81), userId prop (satır 79) |
| `src/app/(dashboard)/projeler/[id]/arastirma/ResearchRerunButton.tsx` | Yeniden Araştır client component | ✓ DOĞRULANDI | 69 satır; 'use client'; variant="outline" size="sm"; router.refresh() |
| `src/app/(dashboard)/projeler/[id]/arastirma/page.tsx` | ResearchRerunButton entegrasyonu | ✓ DOĞRULANDI | Import satır 6; flex justify-between satır 112; ResearchRerunButton satır 114 |

---

### Kritik Bağlantı Doğrulaması

| Kaynak | Hedef | Üzerinden | Durum | Detay |
|--------|-------|-----------|-------|-------|
| `vault.ts` | env var / vault.decrypted_secrets | `process.env.SERPAPI_KEY` önce, tablo fallback | ✓ WIRED | getSerpApiKey() satır 104-119 |
| `sector-research.ts` | `https://serpapi.com/search.json` | fetchSerpResults() + getSerpApiKey() | ✓ WIRED | Satır 95: URL pattern doğrulandı |
| `sector-research.ts` | `research_reports` tablosu | saveReport() upsert | ✓ WIRED | Satır 193-207: onConflict: 'project_id,section' |
| `trigger/route.ts` | `sector-research.ts` | runSectorResearch(input) çağrısı | ✓ WIRED | Satır 50-56 |
| `ProjectInfoSection.tsx` | `/api/research/trigger` | fetch POST | ✓ WIRED | handleLaunch satır 261-265 |
| `page.tsx` | `research_reports` | supabase.select().eq().limit(1) | ✓ WIRED | Satır 35-41 |
| `arastirma/page.tsx` | `ResearchRerunButton` | import + JSX render | ✓ WIRED | Satır 6 ve 114 |

---

### Veri Akışı İzleme (Seviye 4)

| Artifakt | Veri Değişkeni | Kaynak | Gerçek Veri Üretiyor mu | Durum |
|----------|---------------|--------|------------------------|-------|
| `arastirma/page.tsx` | `rowsMap` (5 bölüm) | `supabase.from('research_reports').select('section, rows')` | Evet — DB sorgusu | ✓ FLOWING |
| `ProjectInfoSection.tsx` | `researchDone` | SSR'dan `hasResearch` prop → `initialHasResearch` → state | Evet — research_reports doluluk kontrolü | ✓ FLOWING |
| `sector-research.ts` | `report` (ClaudeReport) | `analyzeWithClaude()` → Anthropic API → JSON parse | Evet — gerçek AI çıktısı | ✓ FLOWING |

---

### Gereksinim Kapsamı

| Gereksinim | Kaynak Plan | Açıklama | Durum | Kanıt |
|-----------|-------------|---------|-------|-------|
| PROJ-06 | 18-03 | Zorunlu alanlar dolunca "Projeyi Başlat" aktif | ✓ KARŞILANDI | canLaunch boolean + disabled prop + Eksik: hint |
| PROJ-07 | 18-02, 18-03 | "Projeyi Başlat" → sektör araştırması otomatik | ✓ KARŞILANDI | ProjectInfoSection → /api/research/trigger → runSectorResearch() zinciri |
| SRCH-01 | 18-01 | Sektör + rakipler + keyword → otomatik Google sorguları | ✓ KARŞILANDI | buildSearchQueries() eksiksiz — 4 sorgu tipi, max 7 |
| SRCH-02 | 18-01 | Arama sonuçları → pazar özeti + rakip konumları + fırsatlar raporu | ✓ KARŞILANDI | analyzeWithClaude() → 5 bölümlü JSON → research_reports upsert |
| SRCH-03 | 18-03 | Araştırma raporu dedicated bölümde görüntülenir | ✓ KARŞILANDI | arastirma/page.tsx — 5 ResearchSection bileşeni + ResearchRerunButton |

**Tüm 5 gereksinim kapsandı. Orphaned gereksinim yok.**

---

### Anti-Pattern Taraması

| Dosya | Satır | Pattern | Önem | Etki |
|-------|-------|---------|------|------|
| Taramada sorun bulunamadı | — | — | — | — |

Tarama sonuçları:
- `sector-research.ts`: TODO/FIXME yok, `throw 'Not implemented'` yok (Plan 02 SUMMARY'deki stub override edilmiş)
- `trigger/route.ts`: Placeholder veya boş implementasyon yok
- `ProjectInfoSection.tsx`: `return null` veya `return {}` yok; tüm conditional render gerçek logic ile
- `ResearchRerunButton.tsx`: `router.refresh()` sadece başarı durumunda — doğru pattern

---

### İnsan Doğrulaması Gerekiyor

#### 1. Gate Logic — CompetitorsTagInput / KeywordsTagInput State Senkronizasyonu

**Test:** Rakipler ve Hedef Kelimeler alanlarını (custom TagInput bileşenler) doldurup boşalt; "Projeyi Başlat" butonunun disabled/enabled durumunun güncellendiğini gözlemle.

**Beklenen:** TagInput bileşenlerine veri girilince buton enabled hale gelir; temizlenince tekrar disabled olur.

**Neden insan:** `CompetitorsTagInput` ve `KeywordsTagInput` kendi state'lerini yönetiyor. `ProjectInfoSection`'daki `data['initial_competitors']` ve `data['target_keywords']` değerleri; bu bileşenlerin `updateProjectField()` server action'ını çağırarak DB'ye yazmasına rağmen local `data` state'ine geri yazılıp yazılmadığı — yani `canLaunch`'un otomatik güncellenip güncellenmediği programatik olarak doğrulanamıyor.

---

#### 2. Uçtan Uca Araştırma Akışı

**Test:** SERPAPI_KEY ve ANTHROPIC_API_KEY env var'larını yapılandır. Tüm zorunlu alanları dolu bir proje üzerinde "Projeyi Başlat"a tıkla.

**Beklenen:**
- Buton "Araştırılıyor..." spinner'a dönüşür
- Sayfa değişmez
- 30-60 saniye içinde emerald "Araştırma tamamlandı ✓" bloğu belirir
- "Araştırma sayfasına git →" linki görünür
- /arastirma sayfasında 5 bölüm dolu veri ile görüntülenir

**Neden insan:** Gerçek SerpAPI ve Anthropic API key gerektiriyor; test ortamında dış servis çağrısı yapılamıyor.

---

#### 3. Hata Yolları

**Test:** Geçersiz SERPAPI_KEY ile test et.

**Beklenen:** `SERPAPI_NOT_CONFIGURED` code gelince "SerpAPI anahtarı yapılandırılmamış. Lütfen sistem ayarlarını kontrol edin." inline mesajı görünür; buton tekrar tıklanabilir hale gelir.

**Neden insan:** Kasıtlı hatalı key yapılandırması gerekiyor.

---

#### 4. "Yeniden Araştır" Butonu Layout ve İşlevselliği

**Test:** /projeler/[id]/arastirma sayfasını aç.

**Beklenen:** "Araştırma" h1 başlığının sağında outline/sm "Yeniden Araştır" butonu görünür. Tıklanınca araştırma yeniden tetiklenir, sayfa router.refresh() ile güncellenir.

**Neden insan:** UI layout ve render görsel doğrulama.

---

### Boşluk Özeti

Programatik doğrulama açısından **tüm 5 başarı kriteri karşılandı**. Artifaktlar eksiksiz, bağlantılar çalışıyor, veri akışı DB'ye bağlı. Plan 02 SUMMARY'de belgelenen stub (`throw 'Not implemented'`) Plan 01 tarafından gerçek implementasyonla override edilmiş ve doğrulandı.

**Bekleyen durumlar:**
- SERPAPI_KEY ve ANTHROPIC_API_KEY dış servis gereksinimleri nedeniyle uçtan uca akış canlı ortamda test edilmeli
- CompetitorsTagInput/KeywordsTagInput → canLaunch senkronizasyonu UI etkileşimiyle doğrulanmalı

---

_Doğrulandı: 2026-05-08T10:30:00Z_
_Doğrulayan: Claude (gsd-verifier)_
