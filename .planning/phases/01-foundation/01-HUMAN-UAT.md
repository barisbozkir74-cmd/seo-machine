---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-04-22T00:00:00Z
updated: 2026-04-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Session Persistence
expected: /dashboard sayfasını yeniledikten (F5) sonra oturum açık kalıyor, login'e yönlendirilmiyor

result: [pending]

### 2. Login Hata Mesajı
expected: Yanlış şifre girildiğinde form içinde hata mesajı görünüyor

result: [pending]

### 3. Anonim Yönlendirme
expected: Gizli sekmede /dashboard'a gidildiğinde /login'e yönlendiriliyor

result: [pending]

### 4. Oturum Açıkken Auth Sayfası Yönlendirmesi
expected: Oturum açıkken /login adresine gidildiğinde /dashboard'a yönlendiriliyor

result: [pending]

### 5. RLS Çapraz Kullanıcı İzolasyonu
expected: Supabase Dashboard → Authentication → Policies'de her tabloda 4 politika görünüyor (select_own, insert_own, update_own, delete_own)

result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
