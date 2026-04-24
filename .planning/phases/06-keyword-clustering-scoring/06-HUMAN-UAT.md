---
status: passed
phase: 06-keyword-clustering-scoring
source: [06-VERIFICATION.md]
started: 2026-04-24T15:00:00Z
updated: 2026-04-24T15:30:00Z
---

## Current Test

Human testing complete — all 4 items passed.

## Tests

### 1. End-to-end clustering flow
expected: "Kümelere Böl" butonuna tıklayınca spinner görünür, sayfa yenilenir, cluster kartları belirir, Skor değerleri dolar
result: passed — kümeleme çalıştı, cluster kartları ve skor değerleri görüldü

### 2. View toggle URL routing
expected: ?view=cluster / ?view=flat URL'leri doğru view'i render eder; aktif sekme bg-secondary ile vurgulanır
result: passed — toggle çalışıyor, küme görünümü keyword satırlarını cluster kartları içinde gösteriyor

### 3. Move keyword between clusters
expected: Satır üzerinde "Taşı →" hover ile görünür, hedef cluster seçilir, dialog kapanır ve keyword yeni clustera geçer
result: passed — mevcut cluster listesi gösteriliyor, taşıma çalışıyor

### 4. Primary star toggle
expected: Boş yıldıza tıklayınca keyword primary olur (dolu yıldız), önceki primary sıfırlanır
result: passed — sistem kümeleme sırasında en yüksek hacimli keyword'ü otomatik primary atıyor

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Aşağıdaki öğeler Phase 6 kapsamı dışında — backlog'a eklendi:

- BL-06-01: MoveKeywordDialog'a "Yeni küme oluştur" seçeneği ekle; yeni küme oluşturulunca diğer clusterlardan tematik ilgili keyword'ler otomatik taşınsın
- BL-06-02: Primary star — sistem tarafından seçilen birincil keyword'ün neden seçildiğini gösteren görünürlük iyileştirmesi (opportunity score bazlı otomatik seçim açıklaması)
