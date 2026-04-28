---
status: partial
phase: 15-monitoring-dashboard
source: [15-VERIFICATION.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Period tab değişimi
expected: 7G tab'ına tıklandığında URL `?period=7` olur ve sayfa yeni aggregation verileriyle yeniden render edilir. 28G varsayılan olarak seçili gelir.
result: [pending]

### 2. GSC bağlı değil boş durum
expected: `gsc_property_url=null` olan projede `/projeler/[id]/izleme`'ye gidildiğinde tablo yerine "GSC verisi bulunamadı" Türkçe metni ve "Proje Bilgileri →" linki görünür.
result: [pending]

### 3. Decay badge görsel onayı
expected: `isDecayed=true` olan sayfa satırında kırmızı "Düşüş" badge görünür; diğer satırlarda "—" gösterilir.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
