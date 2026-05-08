---
phase: 19-ai-keyword-data-acquisition
plan: 02
subsystem: api
tags: [dataforseo, typescript, vitest, tdd, keyword-expansion]

# Dependency graph
requires:
  - phase: 19-01
    provides: fetchRankedKeywords pattern in client.ts (structural analog for fetchRelatedKeywords)
provides:
  - fetchRelatedKeywords function exported from src/lib/dataforseo/client.ts
  - RelatedKeywordItem type exported from src/lib/dataforseo/client.ts
  - 4 vitest unit tests covering empty input, 200 parse, 500 error, options forwarding
affects:
  - 19-03 (ai-acquisition service uses fetchRelatedKeywords for keyword expansion step)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DataForSEO multi-task flatten pattern: each seed keyword is a separate task; results flatMapped from tasks[].result[].items[]"
    - "Early return guard for empty input array — matches fetchKeywordData pattern"
    - "options object parameter for optional depth/limit — avoids signature collision with existing functions"
    - "TDD RED/GREEN with vitest fetch spy via vi.spyOn(globalThis, 'fetch')"

key-files:
  created:
    - src/lib/dataforseo/client.test.ts
  modified:
    - src/lib/dataforseo/client.ts

key-decisions:
  - "include_seed_keyword: false — seed keyword intentionally excluded from expansion results (already in manual list)"
  - "options object for depth/limit — avoids positional parameter collision with fetchRankedKeywords signature style"
  - "Multi-task flatten loop (not tasks[0].result[0]) — supports multiple seed keywords in single API call"

patterns-established:
  - "RelatedKeywordItem: keyword under keyword_data.keyword (not top-level), matching DataForSEO related_keywords/live schema"
  - "Vitest fetch spy pattern: vi.spyOn(globalThis, 'fetch') with mockResolvedValueOnce(new Response(...))"

requirements-completed:
  - KWST-02

# Metrics
duration: 15min
completed: 2026-05-08
---

# Phase 19 Plan 02: DataForSEO Related Keywords Client Wrapper Summary

**`fetchRelatedKeywords` + `RelatedKeywordItem` type added to DataForSEO client with TDD (4 vitest tests passing), enabling Plan 03 keyword expansion without scavenger hunts.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-08T18:36:00Z
- **Completed:** 2026-05-08T18:38:00Z
- **Tasks:** 2 (Task 1: implementation + Task 2: test file — TDD RED/GREEN)
- **Files modified:** 2

## Accomplishments

- `RelatedKeywordItem` type exported with `keyword_data.keyword`, `keyword_info.search_volume/cpc/competition`, `search_intent_info.main_intent`, `depth` fields
- `fetchRelatedKeywords(keywords, credentials, location?, options?)` exported — POST to `dataforseo_labs/google/related_keywords/live`
- Default `depth: 1, limit: 20` (RESEARCH.md Tuzak 3 — API cost explosion prevented)
- Multi-task flatten: each seed keyword sent as separate task; all `tasks[].result[].items[]` merged into flat array
- `include_seed_keyword: false` — seed keyword excluded from expansion results
- 4 vitest tests: empty input guard, 200 parse + URL check, 500 error throw, options body forwarding — all pass
- Existing exports (`fetchRankedKeywords`, `fetchSerpDomains`, `fetchTopPages`, `fetchBacklinksSummary`, `fetchKeywordData`) untouched

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for fetchRelatedKeywords** - `57cae2a` (test)
2. **Task 2 (GREEN): fetchRelatedKeywords + RelatedKeywordItem implementation** - `b588693` (feat)

## Files Created/Modified

- `src/lib/dataforseo/client.ts` — Added `RelatedKeywordItem` type (export) + `fetchRelatedKeywords` function (export) after existing `fetchBacklinksSummary`, before `fetchKeywordData`
- `src/lib/dataforseo/client.test.ts` — New file: 4 vitest tests with fetch spy mock pattern

## Decisions Made

- `include_seed_keyword: false` — seed keyword already exists in the manual/imported keyword list; including it in expansion results would create duplicates
- Multi-task loop instead of `tasks[0].result[0]` — supports multiple seed keywords in a single API call (Plan 03 will pass multiple seeds)
- `options` object parameter for `depth`/`limit` — avoids positional parameter collision with `fetchRankedKeywords` which uses positional `limit` as 3rd arg

## Deviations from Plan

None — plan executed exactly as written. `--reporter=basic` vitest flag not supported in vitest v4.1.5; ran without reporter flag (no functional impact).

## Issues Encountered

- `npx vitest run ... --reporter=basic` flag not supported in vitest v4.1.5; removed flag, ran without reporter — all tests passed correctly.

## User Setup Required

None — no external service configuration required by this plan. DataForSEO credentials used by Plan 03 at runtime; plan references existing `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` env vars already documented in Phase 19 user setup.

## Next Phase Readiness

- Plan 03 can `import { fetchRelatedKeywords, type RelatedKeywordItem } from '@/lib/dataforseo/client'` immediately
- `RelatedKeywordItem.keyword_data.keyword` is the expansion keyword text; `keyword_info.search_volume/cpc` are enrichment fields
- No blockers for Plan 03 (ai-acquisition service layer)

---
*Phase: 19-ai-keyword-data-acquisition*
*Completed: 2026-05-08*
