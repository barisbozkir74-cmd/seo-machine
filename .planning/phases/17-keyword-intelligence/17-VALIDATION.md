---
phase: 17
slug: keyword-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (proje root) |
| **Quick run command** | `npx vitest run src/lib/keywords/niche-scoring.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/keywords/niche-scoring.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | NICH-01 | — | N/A | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 0 | RVEN-01 | — | N/A | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | NICH-01 | T-17-01 | `recalculateClusterNicheScore` `project_id + user_id` ownership doğrular | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | RVEN-01 | T-17-02 | `updateClusterRevenue` whitelist kontrolü (`bilgi`, `mixed`, `ticari`) | unit | `npx vitest run src/lib/keywords/niche-scoring.test.ts` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 2 | NICH-02 | — | N/A | E2E / manual | Tarayıcı gözlemi | — | ⬜ pending |
| 17-03-02 | 03 | 2 | RVEN-02 | — | N/A | E2E / manual | Tarayıcı gözlemi | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/keywords/niche-scoring.test.ts` — NICH-01 ve RVEN-01 unit testleri (stub)
  - `calculateNicheScore` doğru 0-100 skor döner
  - `calculateNicheScore` boş keywords için 0 döner
  - `classifyRevenueType` çoğunluk informational → `'bilgi'` döner
  - `classifyRevenueType` çoğunluk commercial/transactional → `'ticari'` döner
  - `classifyRevenueType` karma dağılım → `'mixed'` döner
- [ ] `src/lib/keywords/niche-scoring.ts` — implementasyon dosyası (Wave 0'da stub, Wave 1'de implement)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ClusterPanel cluster header'ında Niche Skoru sütunu ve ScoreBadge gösterilir | NICH-02 | DOM rendering, Supabase real data | `/projeler/[id]/keyword-stratejisi` aç, cluster listesinde "Niche Skoru" sütununu gör |
| Revenue badge cluster satırında gösterilir, dropdown override çalışır | RVEN-02 | DOM rendering, server action round-trip | Revenue dropdown'dan tür seç, badge güncellenir |
| Cluster listesi Niche Skoru sütununa tıklayınca sıralanır | NICH-02 | DOM interaction | Sütun başlığına tıkla, sıralama değişir |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
