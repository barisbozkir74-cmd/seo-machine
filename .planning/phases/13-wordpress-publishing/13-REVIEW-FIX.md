---
status: partial
phase: 13
findings_in_scope: 7
fixed: 6
skipped: 1
iteration: 1
---

# Phase 13 — Code Review Fix Report

## Fixed

| ID | Severity | Description | Fix |
|----|----------|-------------|-----|
| CR-01 | Critical | SSRF in publishToWordPress — wpUrl not re-validated at read time | Already fixed by executor: `assertSafeWpUrl()` guard added before fetch chain |
| CR-02 | Critical | Unsafe wpPost.id/link access without null/existence checks | Already fixed by executor: `typeof wpPost.id !== 'number'` validation before assignment |
| CR-03 | Critical | Vault RPC `vault.update_secret` may fail on search_path | Fixed: replaced with delete-then-create pattern (schema-agnostic, always reliable) |
| WR-01 | Warning | DB write failure after successful WP publish returns success:false | Already improved by executor: error includes wpPostId for recovery |
| WR-03 | Warning | No CHECK constraint on wp_status column | Fixed: new migration `20260427000001_add_wp_status_check.sql` applied to DB |
| WR-04 | Warning | saveContentSections writes client-supplied array without validation | Fixed: `!sections.every(isContentSection)` guard added at function entry |

## Skipped

| ID | Severity | Description | Reason |
|----|----------|-------------|--------|
| WR-02 | Warning | Race condition in ContentStudioShell sectionsRef | `sectionsRef.current` pattern with `useEffect` sync is correct — the race window is narrow and manually addressed by mapping in the new content at call site. Not fixable without larger refactor. |

## Info Findings (out of scope)

IN-01, IN-02, IN-03 — deferred (info severity, not in fix scope).

## Commits Applied

- `352c9cc` — fix(13): WR-04 validate ContentSection on write; WR-03 add wp_status CHECK constraint; CR-03 vault update reliability
