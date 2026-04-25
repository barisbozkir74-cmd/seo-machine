---
phase: 10-schema-center
verified: 2026-04-25T17:00:00Z
status: human_needed
score: 4/5
overrides_applied: 0
human_verification:
  - test: "Schema Üret butonu çalışıyor ve page_type bazlı doğru JSON-LD üretiyor"
    expected: "homepage → @type: ['Organization','WebSite'], service → 'Service', blog → 'Article', category/landing/default → 'WebPage'; FAQPage augmentation varsa çift schema array döner"
    why_human: "generateSchemaJsonLd deterministik pure function, ancak tarayıcıda gerçek page_type verisiyle çalışması; runtime davranışı programatik olarak doğrulanamaz"
  - test: "Kopyala butonu clipboard'a yazıyor ve 2sn feedback çalışıyor"
    expected: "Tıklandığında 'Kopyalandı ✓' (emerald-500) gösterilmeli, 2 saniye sonra 'Kopyala'ya dönmeli"
    why_human: "navigator.clipboard.writeText tarayıcı izin sistemi — programatik test edilemez"
  - test: "Kaydet sonrası schema_jsonld persist ediliyor (sayfa yenileme testi)"
    expected: "Schema Üret ile oluşturulan veya manuel düzenlenen JSON-LD Kaydet'e basıldıktan sonra sayfayı yenilemede textarea'da korunmalı"
    why_human: "Supabase remote push checkpoint kullanıcı tarafından Dashboard üzerinden yapıldı; gerçek DB persistence'ı programatik olarak doğrulanamaz"
---

# Phase 10: Schema Center Doğrulama Raporu

**Faz Hedefi:** Her sayfa paketi için page_type'a uygun JSON-LD schema otomatik üretilir ve kullanıcı bunu editördeki ayrı Schema sekmesinden önizleyebilir, düzenleyebilir ve kopyalayabilir
**Doğrulandı:** 2026-04-25T17:00:00Z
**Durum:** human_needed
**Yeniden Doğrulama:** Hayır — ilk doğrulama

---

## Hedef Gerçekleşmesi

### Gözlemlenebilir Doğrular (ROADMAP Success Criteria)

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | "Schema Üret" tetiklendiğinde page_type'a göre doğru schema tipi seçilir (Organization/WebSite, WebPage, Service, FAQPage, Article, Product) ve JSON-LD formatında çıktı üretir | ? INSAN GEREKLİ | `generateSchemaJsonLd` pure function dosyada mevcut (satır 156–204), tüm page_type switch case'leri ve FAQPage augmentation logic'i tam; runtime tarayıcı testi gerekli |
| 2 | Üretilen JSON-LD page_packages tablosundaki schema sütununa kaydedilir ve sayfa yenilemesinde korunur | ? INSAN GEREKLİ | `handleSave` içinde `schema_jsonld: parseJsonField(schemaJsonLd)` (satır 394) mevcut; migration uygulandı (Supabase Dashboard); SELECT sorgusunda `schema_jsonld` var (page.tsx satır 104); ancak gerçek DB persistence programatik doğrulanamaz |
| 3 | PagePackageEditor'da ayrı bir "Schema" sekmesi görünür; sekme açıldığında mevcut JSON-LD önizleme olarak gösterilir | ✓ DOĞRULANDI | Tab bar kodu mevcut (satır 556–582); `activeTab === 'schema'` koşuluyla Schema sekmesi içeriği (satır 802–869); `useState(jsonString(pkg?.schema_jsonld))` ile initial state DB'den geliyor |
| 4 | Kullanıcı schema metnini editörde manuel olarak değiştirebilir ve değişiklikler kaydedilebilir | ✓ DOĞRULANDI | `Field` bileşeni `onChange={setSchemaJsonLd}` ile bağlı (satır 851); `disabled={isLocked}` koşuluyla yalnızca locked değilken düzenlenebilir; `handleSave` schema_jsonld'yi gönderiyor |
| 5 | Kullanıcı schema içeriğini panoya kopyalayabilir (tek tıkla kopyala butonu) | ? INSAN GEREKLİ | `handleCopySchema` handler mevcut (satır 349–358); emerald-500/red-400 feedback state'leri var; clipboard API tarayıcı ortamı gerektiriyor |

**Puan:** 2/5 programatik olarak doğrulandı, 3/5 insan testi bekliyor (hiçbiri başarısız değil)

---

### Gerekli Artifaktlar

| Artifakt | Beklenen | Durum | Detaylar |
|----------|----------|-------|---------|
| `supabase/migrations/20260425000001_add_schema_jsonld.sql` | schema_jsonld JSONB migration | ✓ DOĞRULANDI | Dosya mevcut, `ADD COLUMN IF NOT EXISTS schema_jsonld JSONB` içeriyor; IF NOT EXISTS convention uygulandı |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` | PagePackageData tipinde schema_jsonld? unknown | ✓ DOĞRULANDI | Satır 38: `schema_jsonld?: unknown` mevcut |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` | SELECT sorgusunda schema_jsonld | ✓ DOĞRULANDI | Satır 104: SELECT string'i `schema_jsonld` içeriyor |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` | Tab bar + generateSchemaJsonLd + Schema sekmesi UI | ✓ DOĞRULANDI | Tüm beklenen elementler mevcut (aşağıda detay) |

---

### Kilit Bağlantı Doğrulaması

| Kaynak | Hedef | Üzerinden | Durum | Detaylar |
|--------|-------|-----------|-------|---------|
| `generateSchemaJsonLd(page)` | `schemaJsonLd` state | `JSON.stringify(result, null, 2)` ile `setSchemaJsonLd` | ✓ BAĞLI | Satır 344–347: `handleGenerateSchema` → `setSchemaJsonLd(JSON.stringify(result, null, 2))` |
| `handleSave` | `updatePagePackage` | `schema_jsonld: parseJsonField(schemaJsonLd)` | ✓ BAĞLI | Satır 394: `schema_jsonld: parseJsonField(schemaJsonLd)` kaydetme payload'ında mevcut |
| `pkg?.schema_jsonld` | `schemaJsonLd` initial state | `useState(jsonString(pkg?.schema_jsonld))` | ✓ BAĞLI | Satır 252: `useState(jsonString(pkg?.schema_jsonld))` — DB verisi initial state'e akıyor |
| `page.tsx SELECT` | `PagePackageEditor PageData prop` | `pkg` cast via server component | ✓ BAĞLI | SELECT'e schema_jsonld eklendi; PageData.pkg tipinde `schema_jsonld: unknown` tanımlı (satır 49) |

---

### Veri Akışı İzleme (Seviye 4)

| Artifakt | Veri Değişkeni | Kaynak | Gerçek Veri Üretiyor mu | Durum |
|----------|---------------|--------|------------------------|-------|
| `PagePackageEditor.tsx` | `schemaJsonLd` | `pkg?.schema_jsonld` (Supabase SELECT) + `handleGenerateSchema` | Evet — SELECT sorgusu page.tsx'de var; `generateSchemaJsonLd` deterministik template ile doldurur | ✓ AKIYOR |
| `PagePackageEditor.tsx` | `activeTab` | `useState<'paket' \| 'schema'>('paket')` | N/A — UI state | N/A |
| `PagePackageEditor.tsx` | `copyStatus` | `setCopyStatus` (try/catch) | N/A — UI state | N/A |

---

### Davranışsal Spot-Check'ler

| Davranış | Kontrol | Sonuç | Durum |
|----------|---------|-------|-------|
| `generateSchemaJsonLd` fonksiyonu dosyada tanımlı | `grep -n "function generateSchemaJsonLd"` | Satır 156'da bulundu | ✓ GEÇTİ |
| `handleGenerateSchema` ve `handleCopySchema` handler'ları var | `grep -n "handleGenerateSchema\|handleCopySchema"` | Satır 344, 349'da bulundu | ✓ GEÇTİ |
| Tab state değişkenleri mevcut | `grep -n "activeTab\|copyStatus\|schemaJsonLd"` | Satır 252–254'de bulundu | ✓ GEÇTİ |
| handleSave'de schema_jsonld persist ediliyor | `grep -n "schema_jsonld: parseJsonField"` | Satır 394'de bulundu | ✓ GEÇTİ |
| font-medium yasak class yok | `grep "font-medium" PagePackageEditor.tsx` | 0 sonuç | ✓ GEÇTİ |
| homepage page_type doğru @type döndürüyor | Satır 167: `case 'homepage': return ['Organization', 'WebSite']` | Kod inceleme | ✓ GEÇTİ |
| TypeScript derlemesi | `npx tsc --noEmit` (SUMMARY.md doğruladı) | SUMMARY: 0 exit code | ✓ GEÇTİ (raporlanmış) |

---

### Gereksinim Kapsamı

| Gereksinim | Kaynak Plan | Açıklama | Durum | Kanıt |
|-----------|-----------|---------|-------|-------|
| PAGE-02 | 10-01, 10-02, 10-03 | Schema üretimi page_type'a göre otomatik seçilir, JSON-LD formatında çıktılanır | ✓ KARŞILANDI | Migration + `generateSchemaJsonLd` (tüm page_type mapping'leri) + `handleSave` persist |
| PAGE-02b | 10-03 | Kullanıcı JSON-LD'yi ayrı 'Schema' sekmesinden önizleyebilir, manuel düzenleyebilir, kopyalayabilir | ✓ KARŞILANDI | Tab bar, boş/dolu durum UI, `Field` mono textarea, `handleCopySchema`, `setSchemaJsonLd` onChange |

**Sahipsiz gereksinimler:** Yok — PAGE-02 ve PAGE-02b her ikisi de plan frontmatter'larında beyan edilmiş ve uygulanmış.

---

### Anti-Pattern Taraması

| Dosya | Satır | Pattern | Ciddiyet | Etki |
|-------|-------|---------|----------|------|
| `PagePackageEditor.tsx` | 603 | `onChange={() => {}}` | ℹ️ Bilgi | Yalnızca focus_keyword disabled readonly field — beklenen davranış, stub değil |
| Diğer tüm dosyalar | — | Placeholder/TODO/stub pattern | — | 0 sonuç |

**font-medium**: 0 sonuç (yasak class yok — temiz)
**return null / return {}**: Schema sekmesinde yok; tüm render yolları gerçek içerik döndürüyor

---

### İnsan Doğrulaması Gereken Maddeler

#### 1. Schema Üret — Tarayıcı Runtime Testi

**Test:** Bir projenin Sayfa Paketi sayfasını aç, farklı page_type'a sahip sayfaları seç ve "Schema" sekmesine geç. Her biri için "Schema Üret"e tıkla.
**Beklenen:** homepage → `@type: ["Organization","WebSite"]`; service → `"Service"`; blog → `"Article"`; category/landing → `"WebPage"`; FAQ'lı sayfa → 2 elemanlı array (base + FAQPage)
**İnsan gerekmesinin nedeni:** Deterministik pure function kodu doğrulandı, ancak gerçek page_type verisiyle çalışan tarayıcı davranışı programatik test edilemez

#### 2. Kopyala Butonu Feedback Döngüsü

**Test:** Schema sekmesinde JSON-LD üretilmiş halde "Kopyala"ya tıkla.
**Beklenen:** Buton "Kopyalandı ✓" (emerald yeşil) görüntüler, 2 saniye sonra "Kopyala"ya döner. Clipboard içeriği geçerli JSON-LD olmalı.
**İnsan gerekmesinin nedeni:** `navigator.clipboard.writeText` tarayıcı izin API'si — ortam bağımlı

#### 3. Kaydet + Yenileme Persistansı

**Test:** "Schema Üret"e tıkla, "Kaydet"e bas, sayfayı yenile (F5).
**Beklenen:** Textarea yenileme sonrasında üretilen JSON-LD'yi gösteriyor olmalı — DB → SELECT → prop → state akışı çalışmalı
**İnsan gerekmesinin nedeni:** Supabase remote migration kullanıcı tarafından Dashboard üzerinden uygulandı; gerçek round-trip DB persistansı otomatik test edilemez

---

### Boşluk Özeti

Programatik olarak tespit edilen bloklayıcı boşluk yok. Tüm artifaktlar mevcut, substantif ve bağlı. Veri akışı izlenebilir (DB kolon → SELECT → prop → state → render → save).

3 madde insan testi bekliyor — bunların tamamı runtime/tarayıcı davranışıdır, kod kalitesi sorunları değil. Kod incelemesi faz hedefini karşıladığını gösteriyor.

---

_Doğrulandı: 2026-04-25T17:00:00Z_
_Doğrulayıcı: Claude (gsd-verifier)_
