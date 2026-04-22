---
phase: 01-foundation
plan: 04
subsystem: auth
tags: [supabase, ssr, middleware, next-auth, session, route-protection, typescript]

# Dependency graph
requires:
  - 01-01 (Next.js app scaffold with login/signup stubs)
  - 01-02 (core database tables — auth.users FK dependency)
  - 01-03 (RLS policies enabling per-user data isolation)
provides:
  - Browser Supabase client (createBrowserClient) for Client Components
  - Server Supabase client (createServerClient with cookie handling) for Server Components
  - Middleware-based session refresh and route protection at /dashboard
  - Wired login and signup forms making real Supabase auth calls
  - Protected dashboard layout with server-side auth guard (defense-in-depth)
  - Dashboard stub page showing authenticated user email
affects: [all future phases — authenticated session required for all app features, middleware pattern established]

# Tech tracking
tech-stack:
  added:
    - "@supabase/ssr (already installed) — createBrowserClient and createServerClient patterns activated"
  patterns:
    - "Browser client: createBrowserClient in src/lib/supabase/client.ts for 'use client' components"
    - "Server client: async createServerClient with cookie getAll/setAll in src/lib/supabase/server.ts"
    - "Middleware: project root middleware.ts uses NextRequest/NextResponse cookies (different from server.ts)"
    - "Defense-in-depth auth: middleware redirects + layout server component re-validates independently"
    - "Error messages unified for login (T-04-01): 'Incorrect email or password...' does not reveal email existence"
    - "router.push + router.refresh() pattern after successful auth (forces session cookie propagation)"

key-files:
  created:
    - "src/lib/supabase/client.ts — Browser Supabase client using createBrowserClient"
    - "src/lib/supabase/server.ts — Server Supabase client with cookie handling for Server Components/Actions"
    - "middleware.ts — Session refresh + route protection (project root, not inside src/)"
    - "src/app/(dashboard)/layout.tsx — Protected layout with server-side auth guard"
    - "src/app/(dashboard)/dashboard/page.tsx — Dashboard stub page showing user email"
  modified:
    - "src/components/auth/login-form.tsx — Wired to signInWithPassword with proper error handling"
    - "src/components/auth/signup-form.tsx — Wired to signUp with duplicate-email detection"

key-decisions:
  - "Supabase client files placed at src/lib/supabase/ (not project-root lib/) because @/* alias maps to src/*"
  - "middleware.ts at project root (Next.js convention) — NOT inside src/"
  - "Auth error messages follow threat model: login error unified, signup shows duplicate-email message (acceptable disclosure per T-04-04)"
  - "Dashboard layout has server-side auth guard independent of middleware (T-04-03 defense-in-depth)"

patterns-established:
  - "import createClient from '@/lib/supabase/client' for all Client Component Supabase operations"
  - "import createClient from '@/lib/supabase/server' for all Server Component/Action operations"
  - "All protected route groups under (dashboard)/ get auth guard via layout.tsx"

requirements-completed: [INFR-01]

# Metrics
duration: 15min
completed: 2026-04-22
---

# Phase 01 Plan 04: Auth Clients, Middleware, and Form Wiring Summary

**@supabase/ssr browser and server clients, middleware route protection, real signInWithPassword/signUp calls in forms, and protected dashboard stub — INFR-01 fully delivered**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-22
- **Completed:** 2026-04-22
- **Tasks:** 2 of 2 complete
- **Files modified:** 5 created, 2 modified

## Accomplishments

- Created `src/lib/supabase/client.ts` (createBrowserClient) and `src/lib/supabase/server.ts` (createServerClient with cookie handling) — the two Supabase client patterns used by all future phases
- Created `middleware.ts` at project root with session refresh and dual-direction route protection (unauthenticated users blocked from /dashboard; authenticated users redirected away from /login and /signup)
- Wired `login-form.tsx` and `signup-form.tsx` to real Supabase auth calls with threat-model-compliant error messages
- Created `(dashboard)/layout.tsx` as server-side auth guard (defense-in-depth against middleware misconfiguration)
- Created `(dashboard)/dashboard/page.tsx` showing authenticated user's email — session persistence confirmed at route level
- `npm run build` exits 0 with no TypeScript errors; /dashboard rendered as dynamic server route

## Task Commits

1. **Task 1: Create Supabase client helpers and middleware** — `93a4af5` (feat)
2. **Task 2: Wire auth forms to Supabase and create dashboard stub** — `42fb6ee` (feat)

## Files Created/Modified

- `src/lib/supabase/client.ts` — createBrowserClient wrapper for Client Components
- `src/lib/supabase/server.ts` — async createServerClient with cookie getAll/setAll for Server Components
- `middleware.ts` — Session refresh via auth.getUser() + redirect logic for /dashboard and /login|/signup
- `src/app/(dashboard)/layout.tsx` — Server Component auth guard, redirects to /login if no user
- `src/app/(dashboard)/dashboard/page.tsx` — Protected stub rendering user?.email
- `src/components/auth/login-form.tsx` — signInWithPassword with unified error message
- `src/components/auth/signup-form.tsx` — signUp with duplicate-email detection

## Decisions Made

- Supabase client files placed at `src/lib/supabase/` not `lib/supabase/` — the tsconfig `@/*` alias maps to `src/*` so imports like `@/lib/supabase/client` resolve to `src/lib/supabase/client.ts`
- `middleware.ts` remains at project root (Next.js convention) outside `src/`
- Login error unified to "Incorrect email or password..." regardless of whether email exists (T-04-01 threat mitigation — no email enumeration)
- Signup duplicate-email error shown explicitly ("An account with this email already exists...") — acceptable per T-04-04 since user already knows their own email

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

The dashboard page (`src/app/(dashboard)/dashboard/page.tsx`) is intentionally a minimal stub — shows user email only. Phase 2 will build the full dashboard UI. This stub is sufficient for INFR-01 (session persistence validation).

## Threat Flags

None. All threat mitigations from the plan's threat model are implemented:
- T-04-01: Login error unified — "Incorrect email or password..." does not reveal email existence
- T-04-02: middleware uses auth.getUser() (server-validated JWT, not local decode)
- T-04-03: Dashboard layout re-validates user independently of middleware
- T-04-04: Login error unified; signup duplicate-email acceptable disclosure
- T-04-05: Accepted — Supabase built-in rate limiting
- T-04-06: Accepted — Next.js App Router Server Actions have CSRF protection via Origin header

## Next Phase Readiness

- Complete auth foundation: browser client, server client, middleware, protected routes all in place
- Session persists across browser refresh (INFR-01 satisfied)
- All future phases can import `@/lib/supabase/client` or `@/lib/supabase/server` per established pattern
- Phase 2 (Project Core) can immediately build on the authenticated session — `createClient().auth.getUser()` returns the current user in any Server Component

---
*Phase: 01-foundation*
*Completed: 2026-04-22*

## Self-Check: PASSED

- FOUND: `src/lib/supabase/client.ts`
- FOUND: `src/lib/supabase/server.ts`
- FOUND: `middleware.ts`
- FOUND: `src/app/(dashboard)/layout.tsx`
- FOUND: `src/app/(dashboard)/dashboard/page.tsx`
- FOUND: commit `93a4af5` (feat(01-04): add Supabase browser/server clients and middleware)
- FOUND: commit `42fb6ee` (feat(01-04): wire auth forms to Supabase and add dashboard stub)
- BUILD: npm run build exits 0, /dashboard renders as dynamic server route
