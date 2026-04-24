---
status: partial
phase: 08-page-planner-internal-links
source: [08-VERIFICATION.md]
started: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. BulkEditPagesDialog dirty save flow
expected: Sadece kullanıcının değiştirdiği satırlar updatePageAttributes'a gönderilir; değiştirilmeyen satırlar payload'a dahil edilmez. Kaydet sonrası router.refresh() sayfayı güncel DB değerleriyle yeniden render eder.
result: [pending]

### 2. SuggestLinksButton → SuggestLinksDialog → addLink akışı
expected: Pillar (kategori/ana-sayfa) sayfalarından support (hizmet/blog/landing/ürün) sayfalarına öneriler üretilir. Mevcut linkler öneri listesinden çıkarılır. Kullanıcı seçip onayladıktan sonra seçilen satırlar addLink ile DB'ye kaydedilir; dialog kapanır ve sayfa yenilenir.
result: [pending]

### 3. Orphan banner koşullu gösterim
expected: Hiç link yokken banner görünmez. En az bir link varken linke bağlı olmayan sayfalar için amber banner gösterilir. Orphan sayfaya link eklenince banner güncellenir.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
