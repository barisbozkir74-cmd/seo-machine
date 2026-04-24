---
status: partial
phase: 09-page-package-generator
source: [09-VERIFICATION.md]
started: 2026-04-24T22:05:00Z
updated: 2026-04-24T22:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. AI Streaming akışı
expected: "AI ile Üret" butonu tıklandığında streaming başlar, Anthropic'ten gelen chunks decode edilip JSON parse edilir, form alanları gerçek zamanlı dolar; işlem bitince draft olarak kaydedilir
result: [pending]

### 2. Status workflow görsel davranışı
expected: Sayfa paketi draft durumunda "Onayla" ve "Kilitle" butonları görünür; approved'da "Kilitle" ve "Taslağa Al" görünür; locked'da "Kilidini Aç" görünür; PackageStatusBadge her durumda doğru renk ve etiket gösterir
result: [pending]

### 3. Kilidini Aç Dialog
expected: Locked pakette "Kilidini Aç" butonuna tıklandığında base-ui Dialog açılır, onay verilince `updatePackageStatus('approved')` çağrılır, iptal edilince hiçbir şey değişmez
result: [pending]

### 4. QaBadge reaktivitesi
expected: Field'lara yazıldıkça QaBadge anlık güncellenir — seo_title 60 karakteri geçince hata, meta_description 155'i geçince hata, h1 dolunca uyarı kalkar, focus keyword başlıkta varsa QA geçer
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
