---
phase: 06-keyword-clustering-scoring
verified: 2026-04-24T15:05:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Trigger 'Kümelere Böl' from the UI with enriched keywords in a project"
    expected: "Button shows 'Kümeleniyor...' with spinner during processing; page refreshes with clusters displayed in Küme Görünümü; Skor column shows non-null values for clustered keywords"
    why_human: "Requires live Supabase connection with real enriched keyword data; tests pass but end-to-end DB write + revalidatePath refresh cannot be verified statically"
  - test: "Switch between Düz Liste and Küme Görünümü via ViewToggle"
    expected: "URL updates to ?view=cluster / ?view=flat; flat view shows table with Skor column; cluster view shows ClusterPanel with cards grouped by cluster"
    why_human: "URL routing behavior and SSR re-render on searchParams change requires browser"
  - test: "Move a keyword to a different cluster via MoveKeywordDialog"
    expected: "Dialog opens with cluster list, selecting a cluster and clicking 'Taşı' moves keyword; dialog closes; keyword appears in new cluster on page refresh"
    why_human: "Dialog interaction and Server Action round-trip with DB write"
  - test: "Click a hollow star (☆) on a non-primary keyword in ClusterPanel"
    expected: "Star becomes solid (★) and that keyword becomes the primary; previous primary star reverts to hollow"
    why_human: "setPrimaryKeyword Server Action with DB state change visible in UI"
---

# Phase 6: Keyword Clustering & Scoring Verification Report

**Phase Goal:** Users can let the system automatically cluster keywords by SERP similarity and intent, assign primary keywords to clusters with cannibalization prevention, and see opportunity scores for every keyword
**Verified:** 2026-04-24T15:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System automatically groups keywords into clusters based on SERP similarity and search intent | VERIFIED | `clusterEnrichedKeywords` in `clustering.ts` implements intent-first grouping + text-similarity sub-clustering. Called from `clusterAndScoreKeywords` action. 7 passing tests confirm behavior including intent separation, name format, and deduplication. |
| 2 | Each cluster has a primary keyword assigned; no keyword belongs to more than one cluster (cannibalization prevention enforced) | VERIFIED | `clusterAndScoreKeywords` auto-assigns `primary_keyword_id` to highest-volume keyword per cluster. `moveKeywordToCluster` clears old `primary_keyword_id: null` (Pitfall 2 guard at actions.ts:328-335). `keywords.cluster_id` is a FK that can only hold one value — one keyword, one cluster. |
| 3 | Every keyword has an opportunity score calculated from traffic potential, commercial value, and competition score | VERIFIED | `calculateOpportunityScore` in `scoring.ts` computes: (volume×0.40) + (cpc×0.25) + (kd_ease×0.15) + (intent_multiplier×0.20). Result stored in `keywords.opportunity_score` via Promise.all UPDATE in `clusterAndScoreKeywords`. 8 passing tests cover all score properties. |
| 4 | User can view all clusters and keywords in a panel, edit cluster assignments, and move keywords between clusters | VERIFIED | `ClusterPanel.tsx` renders cluster cards with keyword rows. `MoveKeywordDialog.tsx` triggers `moveKeywordToCluster`. `PrimaryKeywordStar.tsx` triggers `setPrimaryKeyword`. All wired in `page.tsx` via `isClusterView` routing and real DB data (clustersWithKeywords from Supabase). |
| 5 | clusterAndScoreKeywords Server Action clusters enriched keywords and writes to DB | VERIFIED | Full implementation in `actions.ts:192-288`: UUID validation, getUser(), project ownership, enriched_at filter, DoS guard >500, clusterEnrichedKeywords call, buildScoringContext, keyword_clusters UPSERT, keywords UPDATE with opportunity_score, primary_keyword_id assignment, revalidatePath. |
| 6 | opportunity_score (0-100) is calculated and stored per keyword | VERIFIED | `calculateOpportunityScore` returns 0-100 with 1 decimal. Used in `clusterAndScoreKeywords` updates. `page.tsx` selects `opportunity_score` and renders it with violet/amber/secondary badge tiers. |
| 7 | moveKeywordToCluster prevents cannibalization by enforcing single-cluster membership | VERIFIED | `actions.ts:292-348`: UUID validation, keyword ownership check, target cluster ownership check, Pitfall 2 primary_keyword_id null-out, single `cluster_id` UPDATE. |
| 8 | setPrimaryKeyword validates cluster membership before updating | VERIFIED | `actions.ts:352-393`: UUID validation, getUser(), keyword ownership, `kw.cluster_id !== clusterId` tampering guard, keyword_clusters UPDATE with revalidatePath. |
| 9 | DoS guard blocks clustering when keyword count > 500 | VERIFIED | `actions.ts:225-228`: `if (keywords.length > 500) return { success: false, error: '...' }` |
| 10 | UI shows Skor column in flat view and ScoreBadge in cluster view, with enrichment warning banner | VERIFIED | `page.tsx:218`: `<TableHead className="text-xs text-right w-16">Skor</TableHead>`. `page.tsx:188-192`: amber border banner for `pendingEnrichment > 0`. `ClusterPanel.tsx:43-48`: ScoreBadge with violet/amber/secondary tiers. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/keywords/scoring.ts` | calculateOpportunityScore, buildScoringContext, INTENT_MULTIPLIERS | VERIFIED | All three exported. Pure functions, no imports. 47 lines. |
| `src/lib/keywords/clustering.ts` | clusterEnrichedKeywords, ClusterInput, ClusterResult | VERIFIED | All exported. clusterKeywords (Phase 5 compatibility) preserved. 151 lines. |
| `src/lib/keywords/scoring.test.ts` | Vitest tests for scoring — KEYW-06 | VERIFIED | 8 tests, all passing. Covers 0-100 range, intent ordering, null safety, precision. |
| `src/lib/keywords/clustering.test.ts` | Vitest tests for clustering — KEYW-04, KEYW-05 | VERIFIED | 7 tests, all passing. Covers empty input, intent separation, name format, unknown intent, text grouping, deduplication, sort order. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` | clusterAndScoreKeywords, moveKeywordToCluster, setPrimaryKeyword | VERIFIED | All three functions exported. Full auth + ownership + UUID validation. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` | useTransition CTA button | VERIFIED | 'use client', useTransition, clusterAndScoreKeywords call, error display, loading spinner. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ViewToggle.tsx` | URL query param toggle | VERIFIED | 'use client', useRouter + usePathname, ?view=flat/?view=cluster push. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` | Cluster cards with keyword rows | VERIFIED | Server Component, imports PrimaryKeywordStar and MoveKeywordDialog, ScoreBadge, empty state message. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` | moveKeywordToCluster dialog | VERIFIED | 'use client', DialogTrigger render prop (not asChild), moveKeywordToCluster call, inline error. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/PrimaryKeywordStar.tsx` | setPrimaryKeyword star button | VERIFIED | 'use client', useTransition, setPrimaryKeyword call, isPrimary conditional styling. |
| `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx` | Updated page with Skor column + view routing | VERIFIED | searchParams, isClusterView, opportunity_score in select, Skor column header, enrichment banner, ClusterButton/ViewToggle/ClusterPanel imports and usage. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| actions.ts clusterAndScoreKeywords | clustering.ts clusterEnrichedKeywords | import + call | WIRED | Line 8: `import { clusterKeywords, clusterEnrichedKeywords }`. Line 231: `const clusters = clusterEnrichedKeywords(keywords)` |
| actions.ts clusterAndScoreKeywords | scoring.ts calculateOpportunityScore | import + call | WIRED | Line 9: `import { calculateOpportunityScore, buildScoringContext }`. Line 262: `calculateOpportunityScore(kw, scoringCtx)` |
| actions.ts clusterAndScoreKeywords | keyword_clusters table | supabase upsert | WIRED | Lines 243-254: `supabase.from('keyword_clusters').upsert(...)` with project_id, cluster_name, intent |
| actions.ts clusterAndScoreKeywords | keywords.opportunity_score column | supabase update | WIRED | Lines 266-274: Promise.all updates with `cluster_id` and `opportunity_score` |
| page.tsx | ClusterButton.tsx | import + render | WIRED | Line 18 import, line 182 render with projectId and hasExistingClusters |
| page.tsx | ViewToggle.tsx | import + render | WIRED | Line 19 import, line 181 render with currentView |
| page.tsx searchParams | ClusterPanel / flat table | isClusterView | WIRED | Line 63: `const isClusterView = view === 'cluster'`. Lines 199-309: conditional render |
| ClusterPanel.tsx | MoveKeywordDialog.tsx | import + render | WIRED | Line 5 import, lines 123-130: render per keyword row |
| ClusterPanel.tsx | PrimaryKeywordStar.tsx | import + render | WIRED | Line 4 import, lines 97-102: render per keyword row |
| MoveKeywordDialog.tsx | actions.ts moveKeywordToCluster | import + handleMove call | WIRED | Line 14 import, line 56: `await moveKeywordToCluster(keywordId, selectedClusterId, projectId)` |
| PrimaryKeywordStar.tsx | actions.ts setPrimaryKeyword | import + onClick call | WIRED | Line 5 import, line 34: `await setPrimaryKeyword(clusterId, keywordId, projectId)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| page.tsx | keywords (KeywordRow[]) | supabase.from('keywords').select('...opportunity_score...') | Yes — live DB query with .eq('project_id', id).eq('user_id', user.id) | FLOWING |
| page.tsx | clusters | supabase.from('keyword_clusters').select('...primary_keyword_id') | Yes — live DB query ordered by total_volume | FLOWING |
| page.tsx | clustersWithKeywords | Client-side grouping of keywords by cluster_id | Yes — derived from the two live queries above | FLOWING |
| ClusterPanel | clusters prop | Passed from page.tsx clustersWithKeywords | Yes — sourced from DB in parent | FLOWING |
| ClusterButton | projectId prop | Passed from page.tsx `id` param | Yes — real project UUID from URL params | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 15 unit tests pass | `npx vitest run src/lib/keywords/ --reporter=verbose` | "Test Files 2 passed (2), Tests 15 passed (15)" | PASS |
| calculateOpportunityScore exports exist | Node module check | `INTENT_MULTIPLIERS`, `calculateOpportunityScore`, `buildScoringContext` confirmed exported | PASS |
| clusterEnrichedKeywords exports exist | Source inspection | `ClusterInput`, `ClusterResult`, `clusterEnrichedKeywords` confirmed exported | PASS |
| Server Actions exported from actions.ts | Source inspection | `clusterAndScoreKeywords`, `moveKeywordToCluster`, `setPrimaryKeyword` confirmed at file scope | PASS |
| DoS guard present | grep check | `keywords.length > 500` at actions.ts:225 | PASS |
| Pitfall 2 primary_keyword_id null guard | grep check | `primary_keyword_id: null` at actions.ts:331 | PASS |
| No font-medium violations (D-11) | grep check | Zero matches across all new files | PASS |
| No Badge variant= prop usage (D-11) | grep check | Zero matches in ClusterPanel.tsx | PASS |
| DialogTrigger uses render prop not asChild | Source inspection | `render={<button ...>}` pattern confirmed in MoveKeywordDialog.tsx:72-77 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| KEYW-04 | 06-01 | System clusters keywords by SERP similarity and intent mapping | SATISFIED | `clusterEnrichedKeywords` in `clustering.ts`: intent-first groups + text-similarity sub-clustering. `clusterAndScoreKeywords` writes to `keyword_clusters` table. |
| KEYW-05 | 06-01 | Each cluster has primary keyword; no keyword in more than one cluster (cannibalization prevention) | SATISFIED | `primary_keyword_id` auto-assigned in `clusterAndScoreKeywords`. `moveKeywordToCluster` enforces single-cluster membership via `cluster_id` FK. Pitfall 2 guard clears old primary on move. `setPrimaryKeyword` validates cluster membership. |
| KEYW-06 | 06-01 | Opportunity score calculated per keyword (traffic potential + commercial value + competition score) | SATISFIED | `scoring.ts`: `(volume×0.40) + (cpc×0.25) + (kd_ease×0.15) + (intent_mult×0.20)`. Stored in `keywords.opportunity_score`. 8 unit tests pass. |
| KEYW-07 | 06-02 | User can view clusters and keywords in panel, edit assignments, move keywords between clusters | SATISFIED | `ClusterPanel.tsx` renders cluster view. `MoveKeywordDialog.tsx` enables cross-cluster moves. `PrimaryKeywordStar.tsx` enables primary assignment. `ViewToggle.tsx` switches views. All wired in `page.tsx`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

All scanned files are free of: TODO/FIXME comments, placeholder returns (return null / return {}), hardcoded empty arrays/objects flowing to render, stub handlers, font-medium violations, and Badge variant= prop usage.

### Human Verification Required

#### 1. End-to-End Clustering Flow

**Test:** In a project with enriched keywords (enriched_at IS NOT NULL), click the "Kümelere Böl" button.
**Expected:** Button enters loading state with spinner and "Kümeleniyor..." text. After completion, page refreshes. Switching to "Küme Görünümü" shows cluster cards. Switching back to "Düz Liste" shows non-null Skor values for clustered keywords (violet badge for score ≥70, amber for ≥40, secondary for <40).
**Why human:** Requires a live Supabase connection with real enriched keyword rows. The Server Action DB write + revalidatePath ISR cycle cannot be verified statically.

#### 2. View Toggle URL Routing

**Test:** With keywords present, click "Küme Görünümü" in the ViewToggle, then click "Düz Liste".
**Expected:** URL changes to `?view=cluster` showing ClusterPanel; URL changes back to `?view=flat` (or no param) showing the flat table with Skor column header. Active tab shows `bg-secondary` styling.
**Why human:** URL push and SSR re-render on searchParams change requires a live browser session.

#### 3. Move Keyword Between Clusters

**Test:** In Küme Görünümü, hover over a keyword row — "Taşı →" appears. Click it. Select a different cluster from the dialog list and click "Taşı".
**Expected:** Dialog closes. The keyword no longer appears in its original cluster and appears in the target cluster on the next page load.
**Why human:** MoveKeywordDialog → moveKeywordToCluster → DB UPDATE → revalidatePath round-trip requires live environment.

#### 4. Primary Keyword Star Toggle

**Test:** In Küme Görünümü, hover over a non-primary keyword row. Click the hollow star (☆).
**Expected:** That keyword's star becomes solid (★) and shows `text-primary` color. If the previous primary keyword is visible, its star reverts to hollow.
**Why human:** setPrimaryKeyword Server Action with DB state change visible in rendered UI requires browser.

### Gaps Summary

No automated gaps found. All 10 must-have truths are verified at all four levels (exists, substantive, wired, data-flowing). All 15 unit tests pass. All 4 requirements (KEYW-04, KEYW-05, KEYW-06, KEYW-07) are satisfied by the implementation.

Status is `human_needed` because 4 end-to-end behaviors require a live browser and Supabase connection to confirm.

---

_Verified: 2026-04-24T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
