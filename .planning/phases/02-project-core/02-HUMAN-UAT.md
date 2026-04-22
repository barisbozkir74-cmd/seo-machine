---
status: partial
phase: 02-project-core
source: [02-VERIFICATION.md]
started: 2026-04-22T00:00:00.000Z
updated: 2026-04-22T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Project creation end-to-end
expected: Modal açılır, tüm alanlar doldurulur, submit sonrası Supabase'de 1 `projects` satırı + 10 `stages` satırı görünür (ilki active+started_at=now, diğerleri pending)
result: [pending]

### 2. Dashboard rendering
expected: `/dashboard/projeler` sayfası 6 sütunlu tabloyu render eder: Proje Adı (link), Domain, Sektör, Aktif Stage, Durum badge (Aktif/Tamamlandı), Oluşturulma (TR locale). Proje yoksa boş durum mesajı görünür.
result: [pending]

### 3. Stage transition dialog
expected: "Sonraki Aşamaya Geç" butonuna tıklayınca dialog açılır, aktif stage adı ve "Bu işlem geri alınamaz." uyarısı görünür. "Evet, Tamamla" sonrası sol sütun güncellenir (bir sonraki stage aktif olur).
result: [pending]

### 4. Note persistence across sessions
expected: Aktif stage için not eklenir, tarayıcı tamamen kapatılıp açılır, not TR locale timestamp ile hâlâ görünür.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
