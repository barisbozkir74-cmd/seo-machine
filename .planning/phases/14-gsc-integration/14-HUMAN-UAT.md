---
status: partial
phase: 14-gsc-integration
source: [14-VERIFICATION.md]
started: 2026-04-27T16:35:00Z
updated: 2026-04-27T16:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. OAuth Flow Uçtan Uca
expected: Badge "Yapılandırılmadı"dan "Bağlı"ya döner; property dropdown görünür ve GSC hesabındaki property'ler listelenir
result: [pending]

### 2. Property Seçimi ve Kaydetme
expected: gsc_property_url veritabanına yazılmış; sayfa yenilemesinde dropdown yerine seçili property string'i gösteriliyor
result: [pending]

### 3. Index Durumu Kontrolü
expected: Badge indexed, not_indexed veya crawled_not_indexed olarak güncellenir; son kontrol zamanı görünür; DB'de gsc_index_status ve gsc_index_checked_at güncellendi
result: [pending]

### 4. GSC Sync Uçtan Uca
expected: HTTP 200 + synced count; DB'de gsc_metrics satırları; "Senkronize Et" butonundan da çalışır
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
