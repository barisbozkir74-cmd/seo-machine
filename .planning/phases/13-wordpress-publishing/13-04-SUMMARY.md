---
phase: 13-wordpress-publishing
plan: "04"
subsystem: api
tags: [wordpress, rest-api, server-action, vault, supabase, basic-auth, seo-plugin]

# Dependency graph
requires:
  - phase: 13-wordpress-publishing
    plan: "01"
    provides: wp_post_id, wp_post_url, wp_published_at, wp_status columns on page_packages
  - phase: 13-wordpress-publishing
    plan: "02"
    provides: getWordPressCredentials vault function
affects:
  - 13-05 (PublishDialog calls publishToWordPress — depends on this action's signature)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WordPress REST API Basic Auth: appPassword stored as 'username:password', base64 encoded directly"
    - "SEO plugin detection via GET /wp-json/wp/v2/plugins — Yoast/RankMath/none, falls back to none on 403 or network error"
    - "Triple ownership check: getUser() + verifyOwnership(projects) + .eq('user_id') on page_packages"
    - "authHeader never logged, never included in error messages (T-13-04-01 mitigation)"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts

key-decisions:
  - "appPassword stored as 'kullaniciadi:sifre' format; if ':' absent → validation error returned to caller"
  - "Plugin detection runs on every publish call (no cache) — simplicity over performance (D-03)"
  - "403 on /wp-json/wp/v2/plugins treated as 'no plugin' fallback, not as auth error — avoids false publish failures"
  - "Partial success (WP accepted but DB update failed) returns success:false with informative Turkish error — caller can surface WP post ID"

patterns-established:
  - "publishToWordPress pattern: vault creds → plugin detect → meta build → WP POST → DB update"
  - "buildMetaPayload: pure function, plugin-type-driven, returns Record<string,string> ready for WP REST body.meta"

requirements-completed:
  - PUBL-02
  - PUBL-03
  - PUBL-04

# Metrics
duration: 3min
completed: "2026-04-26"
---

# Phase 13 Plan 04: publishToWordPress Server Action Summary

**WordPress publish server action with Yoast/RankMath/native plugin detection, Basic Auth, and page_packages DB write after successful REST API POST**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-26T17:22:15Z
- **Completed:** 2026-04-26T17:23:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `publishToWordPress(projectId, pageId, status)` server action to `sayfa-paketi/actions.ts`
- Added `PublishResult` discriminated union type (exported for Plan 05 PublishDialog)
- Plugin detection via `GET /wp-json/wp/v2/plugins` — maps slugs to Yoast/RankMath/none, builds correct meta keys
- Basic Auth header constructed from `appPassword` in `"username:password"` format, never logged (T-13-04-01)
- Triple ownership guard: `getUser()` + `verifyOwnership(projects)` + `.eq('user_id')` on page_packages query
- Locked status guard: returns `success:false` for non-locked packages
- On success: writes `wp_post_id`, `wp_post_url`, `wp_status`, `wp_published_at` to `page_packages`

## Task Commits

Each task was committed atomically:

1. **Task 1: publishToWordPress server action ekle** - `e05566e` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — Added `getWordPressCredentials` import, `PublishResult` type, `WpPlugin` type, `detectSeoPlugin()`, `buildMetaPayload()`, and `publishToWordPress()` server action (184 lines added)

## Decisions Made

- `appPassword` validation: requires `:` separator — if absent, returns Turkish error message before any network call
- Plugin fallback: `GET /wp-json/wp/v2/plugins` returning 403 or throwing network error silently falls back to `'none'` (WP native meta) rather than aborting the publish — maximizes compatibility
- Partial success case (WP accepted, DB write failed): returns `success:false` with WP post ID in message — ensures user can manually verify in WP admin if needed
- `schema_jsonld` serialized as `JSON.stringify()` for all plugin types that support it — Yoast and RankMath both store as JSON string in meta

## Deviations from Plan

None - plan executed exactly as written.

## Security Verification

| Threat | Status |
|--------|--------|
| T-13-04-01: authHeader in log/error | CLEAN — authHeader used only in fetch headers; catch blocks return generic Turkish messages; no console.log anywhere in new code |
| T-13-04-02: WP API response body logged | CLEAN — only `wpPost.id` and `wpPost.link` extracted; no full body log |
| T-13-04-03: Spoofing via publishToWordPress | MITIGATED — getUser() + verifyOwnership() + .eq('user_id') in page_packages query |
| T-13-04-04: Non-locked package published | MITIGATED — `pkg.status !== 'locked'` guard returns error before any network call |
| T-13-04-06: Tampering on DB write | MITIGATED — UPDATE guarded by `.eq('id', pkg.id).eq('user_id', user.id)` |

## Issues Encountered

None.

## Known Stubs

None — `publishToWordPress` is a complete implementation; no hardcoded empty values or placeholder paths.

## Threat Flags

None — this plan introduces one new outbound network call pattern (server action → external WordPress REST API), which is within the plan's threat model scope and fully covered by T-13-04-01 through T-13-04-06.

## Next Phase Readiness

- `publishToWordPress` and `PublishResult` are exported from `sayfa-paketi/actions.ts`
- Plan 05 `PublishDialog` client component can import and call `publishToWordPress(projectId, pageId, status)`
- Return type `PublishResult` provides `wpPostId` and `wpPostUrl` for success UI (post link display)
- `locked` guard ensures only Content Studio-completed packages can be published

## Self-Check: PASSED

- [x] `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — exists and committed (e05566e)
- [x] `.planning/phases/13-wordpress-publishing/13-04-SUMMARY.md` — exists
- [x] Commit e05566e — confirmed in git log
- [x] `publishToWordPress` export: 1 match
- [x] `PublishResult` type export: 1 match
- [x] `getWordPressCredentials` import + usage: 2 matches
- [x] `wp_post_id` in UPDATE: 1 match
- [x] `wp_published_at` in UPDATE: 1 match
- [x] authHeader not in console or error strings: CLEAN

---
*Phase: 13-wordpress-publishing*
*Completed: 2026-04-26*
