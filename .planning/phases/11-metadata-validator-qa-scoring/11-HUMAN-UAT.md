---
status: partial
phase: 11-metadata-validator-qa-scoring
source: [11-VERIFICATION.md]
started: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Kural ihlali diyaloğu
expected: Diyalog açılır, ihlal edilen kural isimleri listelenir, renk kodlaması (kırmızı hata / amber uyarı) doğrudur, İptal düğmesi çalışır
result: [pending]

### 2. QA loading → sonuç diyaloğu (Claude canlı API)
expected: Loading spinner görünür, Claude API çağrısı tamamlanır, 4 check sonucu (intent_drift, robotic_language, entity_gap, duplicate_risk) severity renkleriyle gösterilir, 'Anlayarak Kilitle' butonu çalışır
result: [pending]

### 3. Skor satırı kilitleme sonrasında görünür
expected: SEO | İçerik | İnsan | Schema | Hazırlık skorları sayısal ve renk kodlamalı görünür (≥80 yeşil, 60-79 amber, <60 kırmızı); QA çalışmadan önceki sayfalarda '—' gösterilir
result: [pending]

### 4. QaBadge kaydetme anında güncelleme
expected: Focus keyword verilmiş bir sayfada SEO title'a keyword girildiğinde veya silindiğinde QaBadge anlık olarak güncellenir; rules engine kuralları projectRules ile etkinleştirildiğinde ek uyarılar çıkar
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
