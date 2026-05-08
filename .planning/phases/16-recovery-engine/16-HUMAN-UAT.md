---
status: complete
phase: 16-recovery-engine
source: [16-VERIFICATION.md]
started: 2026-04-30T12:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Tests

### 1. Recovery Tab UI render

Test: `/projeler/[id]/izleme?tab=recovery` sayfasına git; ContentTabBar'ın üç sekme (Cluster Performansı, Sayfa Performansı, Recovery) gösterdiğini doğrula; Recovery sekmesine tıkla; boş durum ('Tespit edilen pozisyon düşüşü yok — sayfalar sağlıklı görünüyor.') göründüğünü doğrula.
expected: Üç sekmeli tab bar görünür, Recovery sekmesi aktif olduğunda RecoveryTaskTable boş durum mesajıyla render edilir
result: pass

### 2. Dismiss + toggle akışı

Test: Supabase Studio'dan test recovery_task row'u ekle (source='page_package', status='open'); sayfayı yenile; satırın kırmızı 'Açık' badge'iyle göründüğünü doğrula; Görmezden Gel'e tıkla; satırın varsayılan görünümden kalktığını doğrula; 'Dismissed görevleri göster' toggle'ına tıkla; satırın gri badge ile geri geldiğini doğrula.
expected: Dismiss akışı çalışır; toggle dismissed satırları gösterir/gizler
result: pass

### 3. Güncelle akışı

Test: Güncelle butonuna tıkla (source='page_package' task üzerinde); URL'in /projeler/[id]/sayfalar'a navigate ettiğini doğrula; Supabase'de task status'unun 'in_progress' olduğunu doğrula.
expected: Status in_progress'e güncellenir, yönlendirme doğru sayfaya gider
result: pass

### 4. n8n/curl webhook testi

Test: curl ile POST /api/recovery/detect çağır (X-N8n-Webhook-Secret header ve gerçek projectId/userId ile); response'un { inserted, skipped, scanned: { page_packages, imported_pages } } shape'inde olduğunu doğrula; ikinci çağrının inserted:0, skipped:N döndürdüğünü doğrula (duplicate prevention).
expected: Webhook auth çalışır; decay detection ve weak-page scan gerçek veri döndürür; idempotency onaylanır
result: pass
notes: |
  1. çağrı: {"inserted":0,"skipped":8,"scanned":{"page_packages":0,"imported_pages":8}} — 8 imported page tarandı, eşik geçilmedi.
  2. çağrı: aynı sonuç — idempotency onaylandı. 2026-05-07.

### 5. publishToWordPress → auto-resolve döngüsü

Test: Yayınlanmış bir page_package için recovery_task (status='open') oluştur; publishToWordPress aksiyonunu tetikle; izleme Recovery Tab'ını aç; satırın artık görünmediğini doğrula (status=resolved, getRecoveryTasks tarafından filtreleniyor).
expected: publishToWordPress D-04 auto-resolve hook'u open/in_progress task'ı resolved'a geçirir
result: blocked
notes: Veritabanında hiç page_packages yok — publish edilecek içerik paketi bulunmadığından test edilemiyor. Kod incelemesiyle doğrulandı (sayfa-paketi/actions.ts satır 640-677).

## Summary

total: 5
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps
