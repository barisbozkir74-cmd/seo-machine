---
phase: 04-competitor-intelligence
plan: "01"
subsystem: competitor-lib
tags: [dataforseo, server-only, lib, nav]
dependency_graph:
  requires: []
  provides:
    - getDataForSeoCredentials (src/lib/supabase/vault.ts)
    - fetchSerpDomains (src/lib/dataforseo/client.ts)
    - fetchTopPages (src/lib/dataforseo/client.ts)
    - extractCategories (src/lib/competitors/url-categories.ts)
  affects:
    - 04-02-PLAN.md (actions.ts bu lib'leri import edecek)
    - 04-03-PLAN.md (page.tsx bu lib'leri kullanacak)
tech_stack:
  added:
    - src/lib/dataforseo/ (DataForSEO HTTP client katmanı)
    - src/lib/competitors/ (URL kategori analizi)
  patterns:
    - server-only import guard (DataForSEO credentials güvenliği)
    - env var fallback pattern (Vault yoksa doğrudan env)
    - www. normalizasyonu pattern (domain deduplication)
    - pure function utility (extractCategories — test edilebilir)
key_files:
  created:
    - src/lib/supabase/vault.ts
    - src/lib/dataforseo/client.ts
    - src/lib/competitors/url-categories.ts
  modified:
    - src/app/(dashboard)/projeler/[id]/page.tsx (sol sütun nav)
    - .env.local.example (DATAFORSEO_LOGIN/PASSWORD eklendi)
decisions:
  - "vault.ts env var fallback öncelikli — Supabase Vault kurulmamışsa DATAFORSEO_LOGIN/PASSWORD env var yeterli (RESEARCH.md Pitfall 4)"
  - "DataForSEO client fonksiyonları credentials parametre alıyor — getDataForSeoCredentials() ayrı çağrılır (separation of concerns)"
  - ".env.example yerine .env.local.example kullanıldı — .gitignore .env* pattern'ı nedeniyle"
  - "extractCategories() server-only değil — pure function, test edilebilir, client da kullanabilir"
metrics:
  duration: "3 dakika"
  completed_date: "2026-04-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 4 Plan 01: DataForSEO Lib Katmanı ve Navigasyon Güncellemesi

**One-liner:** DataForSEO API entegrasyonu için server-only vault.ts + client.ts lib dosyaları ve rakip navigasyon linki ile Wave 2-3 altyapısı oluşturuldu.

## What Was Built

3 yeni lib dosyası oluşturuldu (Wave 1 altyapısı) ve proje detay sayfasının sol sütununa Rakipler navigasyon linki eklendi. Bu plan Wave 2 (`actions.ts`) ve Wave 3 (`rakipler/page.tsx`) için bağımlılık olarak hizmet eder.

### Dosyalar

**`src/lib/supabase/vault.ts`** — DataForSEO credentials okuma (server-only)
- `import 'server-only'` ile client bundle'a girme engellendi (T-04-01)
- Env var fallback: `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` mevcut ise Vault sorgusu yapılmaz
- Supabase Vault fallback: `vault.decrypted_secrets` tablosundan `dataforseo_login` ve `dataforseo_password` okunur
- Service role client kullanılıyor — anon key'in erişemeyeceği Vault tablosu için gerekli

**`src/lib/dataforseo/client.ts`** — DataForSEO HTTP client (server-only)
- `fetchSerpDomains(keywords, credentials)` → `string[]`: SERP Organic Live endpoint, Turkey (2792), www. normalizasyonu
- `fetchTopPages(domain, credentials)` → `TopPageItem[]`: Labs Relevant Pages endpoint, top 10 sayfa ETV'ye göre sıralı
- Basic Auth header: `Buffer.from('login:password').toString('base64')`
- `TopPageItem` tipi export ediliyor (Wave 3'te kullanılacak)

**`src/lib/competitors/url-categories.ts`** — URL pattern → kategori (pure function)
- 15 URL pattern: Blog, Ürün Sayfaları, Hizmetler, Kategori Sayfaları, Mağaza, Haberler, Hakkında, İletişim, Fiyatlandırma
- `extractCategories(pages)` → `CategoryStructure`: Her kategori için pageCount, sampleUrls (max 3), totalEtv
- `'Diğer'` fallback: Pattern eşleşmeyenleri toplar
- server-only değil — test edilebilir, client da kullanabilir

**`src/app/(dashboard)/projeler/[id]/page.tsx`** — Sol sütun nav güncellendi
- Rakipler linki (`/projeler/[id]/rakipler`) Kurallar linkinin üstüne eklendi (D-02 kararı)
- Aynı stil sınıfları: `text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary`

**`.env.local.example`** — Env var şablonu güncellendi
- `DATAFORSEO_LOGIN` ve `DATAFORSEO_PASSWORD` satırları eklendi

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .env.example yerine .env.local.example**
- **Found during:** Task 1
- **Issue:** Plan `.env.example` dosyasına ekleme yapmayı öngörüyordu; dosya mevcut değildi. Alternatif olarak `.env.example` oluşturuldu ancak `.gitignore`'daki `.env*` pattern'ı commit edilmesini engelledi.
- **Fix:** Mevcut `.env.local.example` dosyasına DataForSEO satırları eklendi (bu dosya zaten `.gitignore`'da istisna olarak tanımlı: `!.env.local.example`)
- **Files modified:** `.env.local.example` (ekleme), `.env.example` (silindi — commit edilemezdi)
- **Commit:** e747440

## Known Stubs

Yok — bu plan lib dosyaları ve navigasyon içeriyor, UI stub'ı içermiyor.

## Threat Flags

Yok — yeni network endpoint veya auth path oluşturulmadı. Mevcut threat model kapsamında:
- T-04-01 (vault.ts + client.ts server-only): MITIGATED — `import 'server-only'` her iki dosyada mevcut
- T-04-02 (.env.example placeholder): ACCEPTED — `.env.local.example` sadece placeholder değerler içeriyor

## Self-Check: PASSED

- [x] `src/lib/supabase/vault.ts` FOUND
- [x] `src/lib/dataforseo/client.ts` FOUND
- [x] `src/lib/competitors/url-categories.ts` FOUND
- [x] `.env.local.example` DATAFORSEO satırları FOUND
- [x] `projeler/[id]/page.tsx` rakipler linki FOUND
- [x] Commit e747440 FOUND
- [x] Commit bde245c FOUND
