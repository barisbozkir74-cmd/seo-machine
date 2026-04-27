---
phase: 14
slug: gsc-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | GSC-01 | CSRF state mismatch | OAuth state cookie ile query param eşleşmezse redirect döner | unit | `npm test -- gsc` | ❌ Plan 02 | ⬜ pending |
| 14-01-02 | 01 | 1 | GSC-01 | Token exfiltration | refresh_token yoksa getValidGscToken null döner | unit | `npm test -- gsc` | ❌ Plan 02 | ⬜ pending |
| 14-01-03 | 01 | 1 | GSC-01 | Token refresh | expires_at < now+5dk ise refresh tetiklenir | unit | `npm test -- gsc` | ❌ Plan 02 | ⬜ pending |
| 14-02-01 | 02 | 2 | GSC-02 | — | verdict PASS→indexed, FAIL→not_indexed, NEUTRAL→crawled_not_indexed | unit | `npm test -- gsc` | ❌ Plan 02 | ⬜ pending |
| 14-03-01 | 03 | 3 | GSC-03 | — | Search Analytics row parse: keys[0]=page, keys[1]=keyword | unit | `npm test -- gsc` | ❌ Plan 02 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Wave coverage:** Test dosyaları Plan 02 (Wave 2) içinde oluşturulur. Plan 01 (Wave 1) migration-only olduğundan test scaffold'u Plan 02'ye atanmıştır. Plan 02 hem lib/gsc modüllerini hem test dosyalarını üretir; bu nedenle Plan 02 tamamlandığında tüm test ID'leri `npm test -- gsc` ile yeşil olmalıdır.

---

## Wave Correspondence

| Wave | Plans | Test Files Created In |
|------|-------|----------------------|
| 1 | Plan 01 (migration) | — migration testleri dışında; Plan 02 scaffold yeter |
| 2 | Plan 02 (lib/gsc modülleri + test scaffold) | src/lib/gsc/__tests__/*.test.ts |
| 3 | Plan 03 (index check UI) | Plan 02 scaffold kullanır |
| 4 | Plan 04 (GscConnectionSection + sync) | Plan 02 scaffold kullanır |
| 5 | Plan 05 (n8n workflow + env config) | Plan 02 scaffold kullanır |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth consent screen açılır ve bağlantı tamamlanır | GSC-01 | External OAuth akışı; Google'ın UI'ı içerir; headless test mümkün değil | "GSC Bağla" tıkla → Google hesap seç → izin ver → proje sayfasına dön → bağlantı badge'i yeşil göster |
| Property dropdown property listesini çeker | GSC-01 | Sites.list API canlı Google token gerektirir | OAuth tamamla → dropdown açılır → en az 1 property görünür → seçim → `gsc_property_url` güncellenir |
| n8n webhook trigger sync başlatır | GSC-03 | n8n production ortamında; testable değil | "Senkronize Et" tıkla → n8n webhook çağrılır → gsc_metrics tablosunda satırlar oluşur |
| Günlük n8n schedule çalışır | GSC-03 | n8n cron external system | n8n UI'da workflow aktif → 06:00'da run log görünür |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 2 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 2 (Plan 02) covers all test scaffold creation
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
