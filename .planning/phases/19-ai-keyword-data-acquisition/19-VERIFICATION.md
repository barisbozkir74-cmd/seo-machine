---
phase: 19-ai-keyword-data-acquisition
verified: 2026-05-08T19:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Proje rakiplerinden keyword çekme akışı"
    expected: "Butona basılınca spinner görünür; liste yenilenir; yeni keywordler 'Rakip' badge'iyle tabloda görünür"
    why_human: "DataForSEO API gerçek credentials + canlı proje verisi gerektiriyor; birim testleri mock kullandı"
  - test: "Manual kayıtların source korunması (E2E)"
    expected: "CSV ile daha önce eklenmiş bir keyword, AI acquisition sonrasında 'Manual' badge'ini korur — 'Rakip' veya 'Genişletme'ye dönüşmez"
    why_human: "ignoreDuplicates:true birim testinde doğrulandı ancak canlı DB üzerindeki davranış gözlemlenmelid"
  - test: "DataForSEO credentials yokken 503 hatası"
    expected: "DATAFORSEO_LOGIN env var silindiğinde butona basmak 503 + kırmızı hata mesajı 'DataForSEO credentials yapılandırılmamış.' göstermeli"
    why_human: "Env var manipülasyonu gerektiriyor; live app ortamında test edilmeli"
  - test: "DB CHECK constraint canlı ortamda"
    expected: "Supabase Studio > keywords tablosu > Constraints sekmesinde 'keywords_source_check' görünüyor"
    why_human: "Plan 01 SUMMARY'de belgelendiği gibi 'npx supabase db push' manuel token gerektirdi; migration dosyası hazır ancak push otomatik doğrulanamadı"
---

# Phase 19: AI Keyword Data Acquisition Verification Report

**Phase Goal:** AI-powered keyword data acquisition — kullanıcı proje rakiplerinin keyword verilerini otomatik olarak çekip keyword stratejisi tablosuna ekleyebilir; mevcut manual kayıtlar korunur; her kayıt için kaynak (manual/competitor/expansion) ayrımı görüntülenir.
**Verified:** 2026-05-08T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Sistem proje rakiplerinin kullandığı keywordleri DataForSEO API üzerinden otomatik çeker | VERIFIED | `ai-acquisition.ts` satır 251-258: `competitors` tablosundan domainleri çeker; `fetchCompetitorKeywords` fonksiyonu `fetchRankedKeywords(domain, credentials, 50, location)` çağırır; route.ts IDOR-korumalı POST ucu tetikliyor |
| 2 | Çekilen rakip keywordleri + CSV import keywordleri + ilişkili genişletmeler birleşik keyword havuzunda toplanır | VERIFIED | `upsertKeywordPool` `onConflict: 'project_id,keyword'` ile tek tabloya yazar; `fetchSeedExpansion` source='expansion' satırları ekler; CSV `importKeywords` aynı tabloya yazıyor |
| 3 | Mevcut CSV import akışı bozulmadan çalışmaya devam eder ve AI akışıyla paralel kullanılabilir | VERIFIED | `page.tsx` satır 14 ve 168: `KeywordImport` bileşeni import edilmiş ve render ediliyor; `actions.ts` dosyasına dokunulmamış; `ai-acquisition.ts` ayrı bir servis |
| 4 | Kullanıcı birleşik keyword havuzunun kaynaklarını (CSV vs rakip vs genişletme) ayırt edebilir | VERIFIED | `page.tsx` satır 85: SELECT sorgusunda `source` kolonu var; satır 289-295: Manual/Rakip/Genişletme badge'leri render ediliyor; TableHead'de "Kaynak" sütunu (satır 254) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Beklenen | Durum | Detay |
|----------|----------|-------|-------|
| `supabase/migrations/20260509000001_keywords_source_check.sql` | keywords.source CHECK constraint | VERIFIED | Dosya mevcut; `keywords_source_check` constraint adı var; `CHECK (source IN ('manual', 'competitor', 'expansion'))` literal mevcut; DROP IF EXISTS idempotent |
| `src/lib/keywords/ai-acquisition.ts` | runKeywordAcquisition tam implementasyon | VERIFIED | 284 satır tam gövde; `ignoreDuplicates: true` satır 159; `import 'server-only'` satır 1; MAX_COMPETITORS=5, RELATED_DEPTH=1 |
| `src/lib/dataforseo/client.ts` | fetchRelatedKeywords + RelatedKeywordItem export | VERIFIED | Satır 189-252: `RelatedKeywordItem` tipi ve `fetchRelatedKeywords` fonksiyonu mevcut; endpoint URL `dataforseo_labs/google/related_keywords/live` |
| `src/app/api/keywords/acquire/route.ts` | POST /api/keywords/acquire IDOR korumalı | VERIFIED | export async function POST; IDOR check: `.eq('id', projectId).eq('user_id', userId).single()` → 404; UUID regex; 503 + DATAFORSEO_NOT_CONFIGURED |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx` | Client buton | VERIFIED | `'use client'` direktifi; fetch '/api/keywords/acquire'; `router.refresh()`; "AI ile Keyword Çek" etiketi |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | AiAcquireButton + Kaynak sütunu | VERIFIED | AiAcquireButton import ve render; SELECT'te source; TableHead "Kaynak"; Manual/Rakip/Genişletme badge'leri |
| `src/lib/keywords/ai-acquisition.test.ts` | 6 entegrasyon testi | VERIFIED | 6 test, 0 skip; ignoreDuplicates, cap≤5, silent fail expansion, silent fail enrichment |
| `src/lib/dataforseo/client.test.ts` | 4 unit test fetchRelatedKeywords | VERIFIED | 4 test; boş input, 200 parse, 500 error, options forwarding |

### Key Link Verification

| From | To | Via | Durum | Detay |
|------|----|-----|-------|-------|
| `AiAcquireButton.tsx` | `/api/keywords/acquire` | fetch POST | WIRED | Satır 24: `fetch('/api/keywords/acquire', { method: 'POST' })` |
| `/api/keywords/acquire/route.ts` | `runKeywordAcquisition` | import + await | WIRED | Satır 3: import; Satır 47: `await runKeywordAcquisition(...)` |
| `ai-acquisition.ts` | keywords tablosu | upsert ignoreDuplicates:true | WIRED | Satır 155-160: `.upsert(rows, { onConflict: 'project_id,keyword', ignoreDuplicates: true })` |
| `ai-acquisition.ts` | fetchRankedKeywords + fetchRelatedKeywords | named imports | WIRED | Satır 6-12: tüm fonksiyon ve tipler `@/lib/dataforseo/client`'tan import ediliyor |
| `page.tsx` | keywords.source kolonu | SELECT + Badge render | WIRED | Satır 85 SELECT'te `source`; satır 289-295 badge render |

### Data-Flow Trace (Level 4)

| Artifact | Veri Değişkeni | Kaynak | Gerçek Veri Üretiyor mu | Durum |
|----------|---------------|--------|--------------------------|-------|
| `page.tsx` | `keywords: KeywordRow[]` | Supabase `.from('keywords').select(...)` satır 83-88 | Evet — gerçek DB sorgusu, proje + kullanıcı filtreli | FLOWING |
| `AiAcquireButton.tsx` | `lastResult` (state) | API response `totalAdded` | API pipeline tamamlandıktan sonra set ediliyor | FLOWING |
| `ai-acquisition.ts:upsertKeywordPool` | `data` (upsert sonucu) | Supabase upsert + `.select('id')` | Gerçek upsert sonucu; DataForSEO API verisi upstream | FLOWING |

### Behavioral Spot-Checks

| Davranış | Komut | Sonuç | Durum |
|---------|-------|-------|-------|
| ai-acquisition testleri | `npx vitest run src/lib/keywords/ai-acquisition.test.ts` | 6/6 passed, 0 skipped | PASS |
| client.test.ts testleri | `npx vitest run src/lib/dataforseo/client.test.ts` | 4/4 passed | PASS |
| export contract | `typeof runKeywordAcquisition === 'function'` | true | PASS |
| ignoreDuplicates:true test | vitest "upsertKeywordPool ignoreDuplicates:true..." | passed | PASS |
| DB constraint migration dosyası | grep keywords_source_check | mevcut | PASS |
| canlı DB push | `npx supabase db push` | PARTIAL — token gerektirdi; manuel push gerekiyor | HUMAN |

### Requirements Coverage

| REQ-ID | Kaynak Plan | Açıklama | Durum | Kanıt |
|--------|------------|---------|-------|-------|
| KWST-01 | 19-03-PLAN.md | Proje rakiplerinin kullandığı keywordler DataForSEO ile otomatik çekilir | SATISFIED | `fetchCompetitorKeywords` → `fetchRankedKeywords` → upsert source='competitor' |
| KWST-02 | 19-01-PLAN.md, 19-02-PLAN.md, 19-03-PLAN.md | Ana keywordler + rakip keywordler + ilişkili genişletmelerden birleşik keyword havuzu | SATISFIED | `fetchSeedExpansion` → `fetchRelatedKeywords` → upsert source='expansion'; Kaynak badge'leri sayfada gösterildi |
| KWST-05 | 19-01-PLAN.md, 19-03-PLAN.md | Mevcut CSV import akışı korunur ve AI akışıyla birlikte çalışır | SATISFIED | `ignoreDuplicates: true` ile manual source ezilmiyor; `KeywordImport` bileşeni page.tsx'te korundu; actions.ts değiştirilmedi |

### Anti-Patterns Found

| Dosya | Satır | Pattern | Önem | Etki |
|-------|-------|---------|------|------|
| — | — | — | — | Blocker anti-pattern yok |

Tüm implementation dosyalarında TODO/FIXME/placeholder taraması negatif sonuç verdi. Plan 01 iskeletindeki `throw new Error('Not implemented — Plan 03')` Plan 03'te tam implementasyonla değiştirilmiş; test dosyasındaki `it.skip` normal `it()` bloğuna dönüştürülmüş.

### Human Verification Required

#### 1. Gerçek DataForSEO API ile Keyword Çekme

**Test:** Geçerli DataForSEO credentials ile bir projenin keyword-stratejisi sayfasına git; "AI ile Keyword Çek" butonuna bas.
**Expected:** Spinner döner; pipeline tamamlandığında liste yenilenir; yeni keywordler "Rakip" ve/veya "Genişletme" badge'iyle tabloda görünür; konsol veya ağ sekmesinde 200 yanıtı.
**Why human:** DataForSEO Live API gerçek credentials + canlı rakip verisi gerektiriyor; birim testleri mock kullandı.

#### 2. Manual Source Korunması (E2E)

**Test:** Önce CSV ile bir keyword ekle (source='manual' olmalı). Ardından aynı projeyi hedefleyen bir competitor domain'i ekle ve "AI ile Keyword Çek" butonuna bas.
**Expected:** Daha önce CSV ile eklenen keyword, acquisition sonrasında "Manual" badge'ini korur — "Rakip" veya "Genişletme" olmaz.
**Why human:** `ignoreDuplicates: true` birim testiyle doğrulandı ancak Supabase upsert davranışı canlı DB üzerinde gözlemlenmelidir.

#### 3. DataForSEO Credentials Yokken 503

**Test:** `DATAFORSEO_LOGIN` env var'ı kaldır (ya da geçersiz yap); butona bas.
**Expected:** Butonun altında kırmızı hata mesajı görünür: "DataForSEO credentials yapılandırılmamış."
**Why human:** Env var manipülasyonu canlı ortamda test edilmeli.

#### 4. DB CHECK Constraint Canlı Doğrulama

**Test:** Supabase Studio > keywords tablosu > Constraints sekmesini aç.
**Expected:** `keywords_source_check` isimli bir CHECK constraint görünüyor; `(source = ANY (ARRAY['manual'::text, 'competitor'::text, 'expansion'::text]))` ifadesini içeriyor.
**Why human:** Plan 01 SUMMARY'de belgelendiği üzere `npx supabase db push` için `SUPABASE_ACCESS_TOKEN` gerekiyordu; token set edilmemiş olduğundan push otomatik doğrulanamadı. Migration dosyası diskte hazır (`supabase/migrations/20260509000001_keywords_source_check.sql`); kullanıcının manuel push yapması gerekiyor.

### Gaps Summary

Otomatik doğrulanabilen tüm must-have'ler geçti (4/4 truth VERIFIED). Tek açık madde: **Supabase DB constraint push'u** — migration dosyası hazır ama SUPABASE_ACCESS_TOKEN eksik olduğu için `npx supabase db push` çalıştırılamadı. Bu madde insan doğrulaması gerektiriyor.

Push için adımlar:
1. `export SUPABASE_ACCESS_TOKEN=<token>` (https://supabase.com/dashboard/account/tokens)
2. `npx supabase link --project-ref jmailuedcajgidfzigof`
3. `npx supabase db push`
4. `npx supabase migration list` çıktısında `20260509000001_keywords_source_check` satırının `Applied` göründüğünü doğrula.

---

_Verified: 2026-05-08T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
