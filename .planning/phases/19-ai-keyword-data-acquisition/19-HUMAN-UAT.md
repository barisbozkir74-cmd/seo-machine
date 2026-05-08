---
status: partial
phase: 19-ai-keyword-data-acquisition
source: [19-VERIFICATION.md]
started: 2026-05-08T19:05:00Z
updated: 2026-05-08T19:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Proje rakiplerinden keyword çekme akışı
expected: Butona basılınca spinner görünür; liste yenilenir; yeni keywordler 'Rakip' badge'iyle tabloda görünür
result: [pending]

### 2. Manual kayıtların source korunması (E2E)
expected: CSV ile daha önce eklenmiş bir keyword, AI acquisition sonrasında 'Manual' badge'ini korur — 'Rakip' veya 'Genişletme'ye dönüşmez
result: [pending]

### 3. DataForSEO credentials yokken 503 hatası
expected: DATAFORSEO_LOGIN env var silindiğinde butona basmak 503 + kırmızı hata mesajı 'DataForSEO credentials yapılandırılmamış.' göstermeli
result: [pending]

### 4. DB CHECK constraint canlı ortamda
expected: Supabase Studio > keywords tablosu > Constraints sekmesinde 'keywords_source_check' görünüyor
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
