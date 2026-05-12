# Research Summary — v5.0 Keyword Strategy Command Center

**Synthesized:** 2026-05-12
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Stack Additions

| Addition | Decision |
|----------|----------|
| DataForSEO cache | `keyword_data_cache` Supabase table — NOT Redis, NOT in-memory LRU |
| Cache key hashing | Web Crypto SHA-256 (no new package) |
| Job queue (light/standard) | Synchronous Server Actions (existing pattern) |
| Job queue (deep analysis) | n8n webhook pattern (mirrors Phase 16 Recovery Engine) |
| Cluster diff algorithm | `diff@9.0.0` — `diffArrays()` only; custom Tailwind UI |
| Diff UI components | Custom Tailwind + shadcn — NOT @git-diff-view/react |
| strategy_decisions | New separate table (not extending project_decisions) |
| competitor_keywords | New queryable table (not JSONB column on competitors) |
| New npm packages | `diff` + `@types/diff` — nothing else |
| Supabase extensions | `pg_cron` optional (Pro plan only, for cache cleanup) |

**No Redis. No pg-boss. No new SaaS services.**

---

## Feature Table Stakes

| Area | Must Build | Can Defer |
|------|-----------|-----------|
| DataForSEO | Cache layer + light/standard analysis | Deep analysis (Level 3) |
| Clustering | SERP-overlap + diff preview + human approval | Hub-spoke hierarchy |
| Competitor Intel | Gap map + staging area (separate from pool) | Batch approve in diff UI |
| Blueprint Transfer | Conflict detection + dependency inspection | Cross-module diff preview |
| Decision Locking | strategy_decisions table + lock/unlock | Governance audit trail UI |
| Governance UI | Diff overlay + approved-snapshot baseline | Decision history dashboard |
| Traffic Priority | AI propose + user approve + locked star | Numeric priority score (1-100) |

---

## Architecture Decisions

**1. Cache placement:** Supabase `keyword_data_cache` table. TTL per level: light=7d, standard=3d, deep=1d. Cache key = SHA-256(endpoint|keyword_normalized|location|language). `expires_at` column — NOT checking `enriched_at`.

**2. strategy_decisions design:** New separate table from `ai_memory` (working memory) and `project_decisions` (event log). Precedence rule: `strategy_decisions` is authoritative over `keyword_clusters.status`, `arch_status`, and `keyword_strategy_approved` when a lock exists.

**3. Cluster diff computation:** Server Action (not client side). Diff always compares against last approved snapshot — NOT against current mixed draft/approved state. Store diff proposal in `ai_memory module='proposed_clustering'` for durability between compute and apply.

**4. Blueprint transfer:** Server Action with conflict detection before any INSERT. Conflict types: slug match (auto-merge candidate), cluster_id collision (user decides), page_package presence (force-keep — no override). Dependency inspection required before any replace.

**5. Apply operations:** Postgres transactions for primary apply (cluster mutations, blueprint writes). Non-fatal pattern reserved for advisory ops only (ai_memory updates).

**6. workflow_runs table:** Already exists but unused. Wire up for deep analysis job tracking (v5.0 Phase 25).

---

## Recommended Build Order

```
Phase 24 — DataForSEO Validation Layer (FOUNDATION)
  Creates: keyword_data_cache + strategy_decisions tables, cache-first service, light analysis UI
  Unblocks: all other phases

Phase 25 — Competitor Keyword Intelligence
  Creates: competitor_keywords table (staging, not in pool), gap map UI, deep analysis n8n wiring
  Feeds: Phase 26 (SERP overlap signals), Phase 30 (gap data)

Phase 26 — Autonomous Clustering Engine + Diff Preview
  Creates: cluster-diff.ts, proposeClusteringUpdate, ClusterDiffPreview overlay
  Highest complexity phase — plan 4-5 implementation plans
  Feeds: Phase 27 (confirmed clusters as transfer source)

Phase 27 — Keyword → Blueprint Architecture Transfer
  Creates: BlueprintTransferOverlay, proposeArchitectureTransfer, conflict detection
  Requires: Phase 26 clusters confirmed

Phase 28 — Governance UI (Diff History + Audit Trail)
  Primarily UI assembly — data structures already exist from Phases 24-27
  Reads all prior components

Phase 29 — Strategic Decision Locking System (UI)
  Creates: StrategyDecisionPanel, lockStrategyDecision, unlock workflow
  strategy_decisions table already exists from Phase 24

Phase 30 — Traffic Opportunity & Priority Engine
  Creates: starred keyword AI proposals, locked priority assignments
  Depends on clean locked state from Phases 26-29
```

---

## Top 5 Pitfalls to Watch

**P1 — AI overwriting approved clusters (CRITICAL)**
Autonomous clustering engine must receive `WHERE status != 'approved'` filtered pool at the query level — not just via AI prompt instruction. Prompt-only guards are unreliable.

**P2 — Stale DataForSEO data driving locked decisions (CRITICAL)**
`enriched_at` is NOT a cache freshness signal. Use `dfs_fetched_at` column with explicit TTL check. Do not set `dfs_fetched_at` default at migration time — force existing keywords through staleness check on first use.

**P3 — Blueprint "replace" cascading deletes (CRITICAL)**
Pages with page_packages or wp_post_id must never be silently replaced. Inspect dependency count before presenting conflict resolution options. Extra confirmation required for destructive actions.

**P4 — Lock precedence conflict (HIGH)**
Four overlapping lock signals: `keyword_clusters.status`, `arch_status`, `keyword_strategy_approved`, `strategy_decisions`. Precedence rule must be written before any code: `strategy_decisions` is authoritative.

**P5 — Diff baseline confusion (HIGH)**
Diff must compare against last fully-approved snapshot (with timestamp label), never against current mixed draft+approved state. UI must label both sides with dates.

---

## Open Questions (Settled by Research)

| Question | Decision |
|----------|----------|
| strategy_decisions: new table vs extend project_decisions? | **New table** — tighter schema, different retention contract |
| Cache store: Redis vs Supabase vs in-memory? | **Supabase table** — no new infra, cost-avoidance not latency problem |
| Diff package: git-diff-view vs react-diff-viewer vs custom? | **Custom Tailwind + `diff` npm** — structured data diff, not text diff |
| Deep analysis queue: pg-boss vs n8n vs pg_cron? | **n8n** (existing) for async; Server Actions for sync |
| competitor_keywords: JSONB on competitors vs new table? | **New queryable table** — gap queries require row-level SQL |
