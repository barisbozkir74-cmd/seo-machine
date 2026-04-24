---
status: partial
phase: 05-keyword-import-enrichment
source: [05-VERIFICATION.md]
started: 2026-04-24T12:00:00Z
updated: 2026-04-24T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. DataForSEO canlı enrichment akışı
expected: Keyword import edince (text paste) importKeywords Server Action çalışır; insert tamamlandıktan sonra DataForSEO'dan volume/CPC/KD/intent otomatik çekilir; tablo yenilenince dolu verilerle gösterilir (enriched_at IS NOT NULL olan satırlar opacity normal, tüm sütunlar dolu)
result: [pending]

### 2. Küme otomatik temizleme
expected: Bir kümedeki son keyword silindiğinde keyword_clusters tablosundan küme kaydı da silinir; tablo yenilenince o küme badge'i kaybolur
result: [pending]

### 3. Enrichment graceful failure
expected: DataForSEO credential'ı geçersiz veya kota aşılmışsa bile import success:true döner; satırlar enriched_at=null kalır; tablo yenilenince o satırlar opacity-50 + spinner gösterir
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
