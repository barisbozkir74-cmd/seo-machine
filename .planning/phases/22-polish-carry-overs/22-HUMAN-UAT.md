---
status: partial
phase: 22-polish-carry-overs
source: [22-VERIFICATION.md]
started: 2026-05-11T00:00:00Z
updated: 2026-05-11T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sayfalar sekmesi GSC bağlantısı olmadan açılmalı
expected: GSC bağlı olmayan bir projede `?tab=pages` URL'iyle izleme dashboard'u açıldığında, içe aktarılan sayfalar mavi "İçe Aktarıldı" badge ile listelenir; tüm GSC metrik sütunları em-dash (—) gösterir
result: [pending]

### 2. Kaydet → Geçmiş akışı (sayfa paketi)
expected: Sayfa paketi sayfasında "Kaydet" butonuna tıklandıktan sonra "Geçmiş" butonuna tıklandığında, Sheet açılır ve v1 revizyonu Türkçe tarih biçimiyle listelenir; "Önizle" tıklanınca salt okunur önizleme açılır ve tüm snapshot alanları görünür
result: [pending]

### 3. Bunu Yükle → editör güncellemesi (D-06 kontrolü)
expected: RevisionPreviewDialog'da "Bunu Yükle" tıklandığında editör form alanları revizyon snapshot değerleriyle güncellenir, ancak otomatik kaydetme gerçekleşmez; kullanıcının "Kaydet" butonuna basması gerekir
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
