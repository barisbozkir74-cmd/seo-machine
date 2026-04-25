---
status: partial
phase: 10-schema-center
source: [10-VERIFICATION.md]
started: 2026-04-25T17:00:00Z
updated: 2026-04-25T17:00:00Z
---

## Current Test

[awaiting human approval]

## Tests

### 1. Schema Üret butonu — page_type bazlı JSON-LD üretimi
expected: homepage → @type: ['Organization','WebSite'], service → 'Service', blog → 'Article', category/landing/default → 'WebPage'; FAQPage augmentation varsa çift schema array döner
result: [pending]

### 2. Kopyala butonu — clipboard feedback döngüsü
expected: Tıklandığında 'Kopyalandı ✓' (emerald-500) gösterilmeli, 2 saniye sonra 'Kopyala'ya dönmeli
result: [pending]

### 3. Kaydet + sayfa yenileme — schema_jsonld persistence
expected: Schema Üret ile oluşturulan veya manuel düzenlenen JSON-LD Kaydet'e basıldıktan sonra sayfayı yenilemede textarea'da korunmalı
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
