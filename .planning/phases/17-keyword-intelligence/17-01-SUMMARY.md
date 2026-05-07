---
phase: 17-keyword-intelligence
plan: "01"
subsystem: keywords
tags: [niche-scoring, tdd, pure-lib, wave-0]
dependency_graph:
  requires: []
  provides:
    - calculateNicheScore
    - classifyRevenueType
    - ClusterKeywordData
  affects:
    - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
tech_stack:
  added: []
  patterns:
    - "min-max normalizasyon (scoring.ts pattern ile tutarlı)"
    - "pure math lib — sıfır I/O, sıfır bağımlılık"
key_files:
  created:
    - src/lib/keywords/niche-scoring.ts
    - src/lib/keywords/niche-scoring.test.ts
  modified: []
decisions:
  - "avgDifficulty null → 50 varsayılan (scoring.ts ile tutarlı)"
  - "avgCpc null → 0 (hiç CPC yoksa cpcScore katkısı sıfır)"
  - "classifyRevenueType boş array → mixed (en güvenli default)"
  - "Formül ağırlıkları: volume 0.40, competition 0.35, cpc 0.25"
metrics:
  duration: "142s"
  completed: "2026-05-07T21:22:29Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_added: 5
  tests_passing: 5
---

# Phase 17 Plan 01: Niche Scoring Lib Summary

**One-liner:** Pure math cluster niche scoring — 3 bileşenli formül (volume/competition/cpc) ve search_intent bazlı revenue sınıflandırması TDD ile implement edildi.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Test stub yaz — RED fazı | 20c94a3 | src/lib/keywords/niche-scoring.test.ts |
| 2 | Implementasyon yaz — GREEN fazı | e6b6e1b | src/lib/keywords/niche-scoring.ts |

## What Was Built

### calculateNicheScore
- Formül: `(volumeScore * 0.4) + (competitionScore * 0.35) + (cpcScore * 0.25)`
- `volumeScore`: totalVolume / maxClusterVolume (max 1.0, ZeroDivision korumalı)
- `competitionScore`: (100 - avgDifficulty) / 100 (null → 50 varsayılan, düşük KD = iyi)
- `cpcScore`: avgCpc / maxCpc (max 1.0, null CPC → 0)
- Sonuç: 0-100 aralığı, 1 decimal (Math.round * 10 / 10)
- Boş array → 0

### classifyRevenueType
- Büyük/küçük harf insensitive (toLowerCase)
- informational > %50 → `'bilgi'`
- (commercial + transactional) > %50 → `'ticari'`
- Diğer (karma veya boş) → `'mixed'`

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 20c94a3 | PASSED — 5 test, import hatasıyla fail etti |
| GREEN (feat) | e6b6e1b | PASSED — 5 test green, 0 failed |
| REFACTOR | — | SKIPPED — kod sade, tekrar yok |

## Verification Results

- `npx vitest run src/lib/keywords/niche-scoring.test.ts` → 5 passed, 0 failed
- `npx vitest run src/lib/keywords/` → 36 passed (regresyon yok)

## Deviations from Plan

None — plan tam olarak planlandığı şekilde execute edildi.

## Known Stubs

None — pure math lib, doğrudan hesaplama yapıyor. Wave 1'de actions.ts'e inject edilecek.

## Threat Flags

None — pure math lib, hiçbir I/O yok. Dış girdi yalnızca action katmanından gelecek (Wave 1'de mitigate edilecek, T-17-W0-01 accepted).

## Self-Check

### Files Exist
- src/lib/keywords/niche-scoring.ts: FOUND
- src/lib/keywords/niche-scoring.test.ts: FOUND

### Commits Exist
- 20c94a3 (RED): FOUND
- e6b6e1b (GREEN): FOUND

## Self-Check: PASSED
