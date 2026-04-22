# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 01-foundation
**Areas discussed:** Next.js router style, Auth implementation, Local dev vs hosted Supabase, Schema design conventions

---

## Next.js Router Style

| Option | Description | Selected |
|--------|-------------|----------|
| App Router | Next.js 13+ default. RSC, Server Actions, middleware-based auth with @supabase/ssr. | ✓ |
| Pages Router | Older model. @supabase/auth-helpers-nextjs (deprecated). Requires API routes for server-side data. | |

**User's choice:** App Router
**Notes:** No additional notes.

---

## Auth Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| @supabase/ssr | Official Supabase package for Next.js App Router. Middleware + server client pattern, auto session refresh. | ✓ |
| NextAuth.js + Supabase adapter | Adds NextAuth as abstraction over Supabase Auth. Extra dependency and complexity. | |

**User's choice:** @supabase/ssr
**Notes:** No additional notes.

---

## Local Dev vs Hosted Supabase

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI local + hosted prod | `supabase start` locally, migrations in git, push to hosted for prod. | ✓ |
| Hosted Supabase only | Use hosted project directly for dev and prod, schema via dashboard. | |

**User's choice:** Supabase CLI local + hosted prod
**Notes:** No additional notes.

---

## Schema Design Conventions

| Option | Description | Selected |
|--------|-------------|----------|
| UUID PKs | gen_random_uuid(), safe for URL exposure, enumeration-resistant. | ✓ |
| Bigint serial | Auto-increment integers, guessable sequential IDs. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete | Simple DELETE, no ghost data. | ✓ |
| Soft delete (deleted_at) | Keeps rows, requires WHERE deleted_at IS NULL everywhere. | |

| Option | Description | Selected |
|--------|-------------|----------|
| created_at + updated_at on all | Both timestamps, updated_at auto-managed by trigger. | ✓ |
| created_at only | Just created_at, no updated_at trigger. | |

**User's choices:** UUID PKs, Hard delete, created_at + updated_at on all tables
**Notes:** No additional notes.

---

## Claude's Discretion

- Exact table column definitions beyond PKs, user_id, timestamps
- Next.js folder/route group structure
- Whether to use single or per-table RLS migrations

## Deferred Ideas

None.
