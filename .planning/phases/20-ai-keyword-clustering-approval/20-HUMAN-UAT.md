---
status: partial
phase: 20-ai-keyword-clustering-approval
source: [20-VERIFICATION.md]
started: 2026-05-09T18:00:00.000Z
updated: 2026-05-09T18:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Overlay otomatik açılış
expected: ClusterButton'a tıklanınca AI kümeleme çalışır ve tamamlandığında ClusteringApprovalOverlay otomatik açılır; sol panelde draft cluster'lar listelenir
result: [pending]

### 2. Optimistic UI — onayla/reddet
expected: Cluster satırında "Onayla ✓" veya "Reddet ✗" tıklanınca StatusBadge server yanıtını beklemeden anında güncellenir (optimistic); DB başarısız olursa rollback yapılır
result: [pending]

### 3. Inline cluster adı düzenleme
expected: Cluster satırına çift tıklanınca isim input'a dönüşür; Enter veya blur ile kaydedilir; Escape ile iptal edilir; boş bırakılırsa hata gösterir
result: [pending]

### 4. StratejiOnaylaButton 3 durum
expected: 0 approved cluster = disabled (soluk); ≥1 approved cluster = aktif outline buton; tıklanınca projects.keyword_strategy_approved=true yazılır ve "✓ Strateji Onaylandı" gösterilir
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
