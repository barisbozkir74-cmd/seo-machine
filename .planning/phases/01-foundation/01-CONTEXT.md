# Phase 1: Foundation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap a Next.js + Supabase application with a complete authenticated base: all core database tables, RLS policies that enforce per-user data isolation, and secure API key storage. Nothing else is built until this foundation is working.

**In scope:**
- New Next.js app scaffolding (App Router)
- Supabase project init + Supabase CLI local dev setup
- Email/password auth with session persistence (@supabase/ssr)
- Auth middleware for route protection
- All core tables: projects, stages, competitors, keywords, keyword_clusters, pages, internal_links, rules, audits, workflow_runs
- RLS policies: users can only read/write their own rows
- Secure API key storage (DataForSEO, Semrush, OpenAI) via Supabase secrets (Vault) — never exposed to frontend

**Out of scope:**
- Any UI beyond a basic login/signup page
- n8n (not needed until Phase 2+)
- OAuth providers (email/password only for MVP)
- Any application features (project management, keywords, etc.)

</domain>

<decisions>
## Implementation Decisions

### Next.js Setup
- **D-01:** Use **App Router** (Next.js 13+). RSC, Server Actions, and layouts are the primary patterns throughout the project. All future phases assume App Router conventions.

### Authentication
- **D-02:** Use **@supabase/ssr** for authentication — not NextAuth.js. Middleware-based session refresh, createServerClient and createBrowserClient pattern. Supabase's own email/password flow, no extra auth dependencies.
- **D-03:** Auth middleware in `middleware.ts` at project root — protects all routes under `/dashboard` (or equivalent app routes). Public routes: `/login`, `/signup`.

### Development Environment
- **D-04:** **Supabase CLI local development** (`supabase start`) + hosted Supabase project for production. All schema changes written as SQL migration files tracked in git (`supabase/migrations/`). `supabase db push` to apply to hosted project.

### Schema Design
- **D-05:** **UUID primary keys** (`id UUID DEFAULT gen_random_uuid() PRIMARY KEY`) on all tables. Safe to expose in URLs, enumeration-resistant.
- **D-06:** **Hard deletes** — no `deleted_at` soft delete column. Simpler queries across all phases. No recovery requirement for MVP.
- **D-07:** **`created_at` + `updated_at` on all tables** — `created_at TIMESTAMPTZ DEFAULT now() NOT NULL`, `updated_at TIMESTAMPTZ DEFAULT now() NOT NULL`. An `updated_at` trigger function is shared and applied to all tables.
- **D-08:** Every table has a `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL` column for RLS enforcement. RLS policy: `USING (auth.uid() = user_id)`.

### API Key Security
- **D-09:** DataForSEO, Semrush, and OpenAI API keys stored in **Supabase Vault secrets**. Server-side code (Edge Functions or Server Actions) retrieves them via `vault.decrypted_secrets`. Keys are never set as Next.js environment variables accessible to the browser bundle.

### Claude's Discretion
- Exact table column definitions beyond PKs, user_id, and timestamps (e.g., which columns are nullable, string lengths) — Claude decides based on Phase 2+ requirements visible in ROADMAP.md and REQUIREMENTS.md.
- Folder structure within the Next.js app (e.g., `app/(auth)/`, `app/(dashboard)/` route groups) — Claude decides following App Router conventions.
- Whether to use a single RLS migration or per-table migrations — Claude decides for maintainability.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

Key requirements for this phase:
- `INFR-01` through `INFR-04` in `.planning/REQUIREMENTS.md`
- Phase 1 success criteria in `.planning/ROADMAP.md`

### Stack Documentation (for researcher)
- Supabase SSR guide for Next.js App Router: official @supabase/ssr docs
- Supabase CLI migration docs
- Supabase Vault (secrets) docs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — project directory is empty. Everything is scaffolded from scratch.

### Established Patterns
- None yet. Phase 1 establishes the baseline patterns for all future phases.

### Integration Points
- Phase 2 (Project Core) will consume the auth session and Supabase client created in this phase.
- All future phases depend on the RLS-protected tables defined here.

</code_context>

<specifics>
## Specific Ideas

No specific implementation references beyond stack choices already locked in PROJECT.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-22*
