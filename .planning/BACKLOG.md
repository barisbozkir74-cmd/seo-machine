# Backlog

Technical debt, code review findings, and deferred improvements tracked here.

## Items

### BL-01: Fix null avg_position corrupting position averages in monitoring aggregation
- **Source**: Phase 15 REVIEW.md (WR-01)
- **Priority**: medium
- **File**: `src/lib/monitoring/aggregation.ts` lines 116, 229
- **Description**: `null` avg_position values are coerced to `0` before accumulating into `posSum`/`posCount`. Since GSC positions are always >= 1, this artificially pulls the average down. Fix: only add to `posSum`/`posCount` when `avg_position !== null`.

### BL-02: Redirect to /login instead of 404 on unauthenticated izleme access
- **Source**: Phase 15 REVIEW.md (WR-02)
- **Priority**: low
- **File**: `src/app/(dashboard)/projeler/[id]/izleme/page.tsx:23`
- **Description**: Unauthenticated users see a 404 (`notFound()`) instead of being redirected to `/login`. Replace with `redirect('/login')` for better UX. Same pattern likely exists in other dashboard page routes.
