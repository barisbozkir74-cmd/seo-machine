---
phase: 4
slug: competitor-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) + Next.js build |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx next build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | COMP-01, COMP-02, COMP-03 | T-04-01 | `dataforseo/client.ts` has `import 'server-only'` — credentials never reach browser | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | COMP-01 | — | N/A | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | COMP-01, COMP-02, COMP-03 | T-04-02 | All actions check `user_id` ownership before DB writes | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 2 | COMP-03 | T-04-01 | `fetchOwnDomainData` uses server-only DataForSEO client | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 3 | COMP-01, COMP-02 | — | N/A | manual | See manual verifications | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 3 | COMP-03, COMP-04 | — | N/A | manual | See manual verifications | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/dataforseo/client.ts` — DataForSEO API client (created in Wave 1 Plan 04-01)
- [ ] `src/lib/dataforseo/url-categories.ts` — URL kategori çıkarım fonksiyonları (created in Wave 1 Plan 04-01)

*TypeScript compiler serves as the automated verification layer — no additional test framework installation required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Manuel rakip domain ekleme | COMP-01 | UI interaction + Supabase write | `/projeler/[id]/rakipler` → "Rakip Ekle" butonuna tıkla → domain gir → listede göründüğünü doğrula |
| SERP tabanlı rakip keşfi | COMP-02 | DataForSEO API çağrısı + dialog flow | "Rakip Keşfet" → 1-3 keyword gir → önerilen domainler listele → seç → onayla → listede görün |
| Rakip top pages ve kategori görüntüleme | COMP-03 | DataForSEO API çağrısı gerektirir | Rakip satırında "Veri Çek" butonuna tıkla → top sayfalar ve kategoriler satır altında görünsün |
| Gap raporu oluşturma | COMP-04 | Birden fazla rakipin veri çekmiş olması gerekir | 2+ rakip için "Veri Çek" yap → gap tablosunu doğrula (satır=kategori, sütun=rakip+kendi domain'i, hücre=✓/✗) |
| Kullanıcı kendi domain analizi | COMP-04 (D-10) | DataForSEO API çağrısı | Gap tablosunda "Analiz Et" butonuna tıkla → "Sizin Siteniz" sütunu güncellenir |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
