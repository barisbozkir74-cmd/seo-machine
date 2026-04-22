---
phase: 01-foundation
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .env.local.example
  - .gitignore
  - components.json
  - eslint.config.mjs
  - lib/supabase/vault.ts
  - middleware.ts
  - next.config.ts
  - package.json
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/auth/login-form.tsx
  - src/components/auth/signup-form.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/form.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/lib/supabase/client.ts
  - src/lib/supabase/server.ts
  - src/lib/utils.ts
  - supabase/migrations/20260422000001_create_tables.sql
  - supabase/migrations/20260422000002_rls_policies.sql
  - tsconfig.json
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This is the foundation phase of SEO Machine — a Next.js 15 + Supabase SSR project establishing auth, routing, database schema, and UI primitives. The SSR cookie pattern in middleware and server client is correctly implemented per the `@supabase/ssr` documentation. RLS policies are comprehensive and consistently enforce `auth.uid() = user_id` isolation across all 10 tables. The service role key is correctly protected behind `server-only`.

Two critical issues were found: a null-dereference crash on the dashboard page when `user` is unexpectedly null (defence-in-depth gap), and a Vault query targeting a PostgREST view path (`vault.decrypted_secrets`) that will fail silently at runtime because the Supabase JS client treats dots as schema separators rather than view names. Six warnings cover logic gaps in the signup flow, missing `user_id` enforcement in the `stages` insert FK path, the unchecked `fieldContext` guard placement in `form.tsx`, and several missing uniqueness/consistency constraints in the schema. Five informational items address the boilerplate landing page, font variable mismatch, and minor SQL design gaps.

---

## Critical Issues

### CR-01: Vault query uses wrong table path — will throw at runtime

**File:** `lib/supabase/vault.ts:25`

**Issue:** The Supabase JS client's `.from()` method does not accept dot-notation to address views in a different schema. `.from('vault.decrypted_secrets')` is interpreted as a table named `vault.decrypted_secrets` in the `public` schema, which does not exist. The correct approach for cross-schema access via PostgREST is to use a `SECURITY DEFINER` function exposed in the `public` schema, or to use the admin REST API with the `?schema=vault` header. As written, every call to `getVaultSecret()` will throw "relation not found" at runtime.

**Fix:**
```sql
-- Create a server-side wrapper function in the public schema:
CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name;
  RETURN secret_value;
END;
$$;
```

```typescript
// Then in vault.ts, call the RPC function instead:
const { data, error } = await supabaseAdmin
  .rpc('get_vault_secret', { secret_name: name })

if (error || data === null) {
  throw new Error(`Vault secret '${name}' not found or access denied: ${error?.message}`)
}

return data as string
```

---

### CR-02: Dashboard page crashes if `user` is null despite layout guard

**File:** `src/app/(dashboard)/dashboard/page.tsx:5-6`

**Issue:** `dashboard/page.tsx` calls `supabase.auth.getUser()` independently of `layout.tsx`. Although the layout redirects unauthenticated users, Server Components inside a layout can be rendered before the layout redirect resolves in certain edge cases (e.g., layout and page rendering concurrently, or the redirect being caught and suppressed by an error boundary). When `user` is `null`, line 12 renders `{user?.email}` safely due to optional chaining — but this also means an unauthenticated user who bypasses the layout sees a blank welcome message with no indication they are not logged in. More critically, the page makes a redundant server round-trip to Supabase on every load when the layout already fetched the user. The page should either receive the user as a prop/through context, or perform its own null-guard redirect.

**Fix:**
```typescript
// src/app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Defence-in-depth: guard even though layout also redirects
  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">SEO Machine</h1>
        <p className="text-muted-foreground">
          Welcome, {user.email}. Phase 2 will build the full dashboard.
        </p>
      </div>
    </main>
  )
}
```

---

## Warnings

### WR-01: Signup succeeds silently when email confirmation is enabled

**File:** `src/components/auth/signup-form.tsx:55-76`

**Issue:** `supabase.auth.signUp()` returns `{ error: null }` even when email confirmation is required — the user is created but not yet confirmed. The code immediately calls `router.push('/dashboard')` on success. If Supabase is configured with email confirmation enabled (the default for new projects), the user will be redirected to `/dashboard` but their session will not be active. The middleware will then redirect them back to `/login`, creating a confusing loop. The `data.session` value is `null` in this confirmation-pending state and should be checked.

**Fix:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email: values.email,
  password: values.password,
})

if (error) {
  // ... existing error handling
  return
}

// Session is null when email confirmation is pending
if (!data.session) {
  // Show a "check your email" message instead of redirecting
  setAuthError(null)
  // Use a separate state for success messaging:
  setConfirmationPending(true)
  return
}

router.push('/dashboard')
router.refresh()
```

---

### WR-02: `useFormField` null-guard runs after the hook call that would crash

**File:** `src/components/ui/form.tsx:43-63`

**Issue:** The `useFormField` hook calls `useFormContext()` at line 45, which will throw if used outside a `FormProvider` context — that crash happens before the null-check on `fieldContext` at line 49. Additionally, the null check `if (!fieldContext)` on line 49 can never be `true` because `fieldContext` is initialized to `{} as FormFieldContextValue` (a non-null object), not `null`. The guard is cosmetically present but provides no runtime protection.

**Fix:**
```typescript
const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)

  // Check before calling useFormContext, which would throw first
  if (!fieldContext.name) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}
```

---

### WR-03: `stages` table allows `user_id` to differ from the parent project's `user_id`

**File:** `supabase/migrations/20260422000001_create_tables.sql:45-59`

**Issue:** The `stages` table has a `user_id` column that references `auth.users(id)` directly, independent of the `project_id` FK. There is no database-level constraint ensuring that `stages.user_id` equals the `user_id` of the referenced `projects` row. An INSERT could set `stages.user_id = user_A` and `stages.project_id = project_owned_by_user_B`. RLS would prevent user_B from seeing it (because `auth.uid() = user_id` checks stages.user_id), but user_A would be able to insert stage records against projects they do not own. This same pattern applies to `rules`, `competitors`, `keywords`, `keyword_clusters`, `pages`, `internal_links`, `audits`, and `workflow_runs`.

**Fix:**
The cleanest mitigation without a check constraint is to enforce the invariant in RLS INSERT policies using a subquery:
```sql
-- Replace stages_insert_own policy:
CREATE POLICY "stages_insert_own" ON public.stages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND user_id = auth.uid()
    )
  );
```
Apply the same pattern to all child tables that have both `user_id` and `project_id`.

---

### WR-04: `pages` table allows self-referencing `parent_id` (infinite loop risk)

**File:** `supabase/migrations/20260422000001_create_tables.sql:145-163`

**Issue:** The `pages.parent_id` self-referencing FK has no constraint preventing a page from being set as its own parent (`parent_id = id`) or forming cycles (`A → B → A`). Any tree traversal query (recursive CTEs for breadcrumbs, sitemap generation) will infinite-loop if a cycle exists in the data.

**Fix:**
```sql
-- Add a check constraint to prevent direct self-reference:
ALTER TABLE public.pages
  ADD CONSTRAINT pages_no_self_parent CHECK (parent_id IS NULL OR parent_id != id);
```
Cycle prevention beyond depth-1 requires a trigger or application-level validation before inserting/updating `parent_id`.

---

### WR-05: `internal_links` allows a page to link to itself

**File:** `supabase/migrations/20260422000001_create_tables.sql:168-181`

**Issue:** There is no constraint preventing `source_page_id = target_page_id`. A self-link is semantically invalid and would corrupt link graph traversal queries.

**Fix:**
```sql
ALTER TABLE public.internal_links
  ADD CONSTRAINT internal_links_no_self_link
  CHECK (source_page_id != target_page_id);
```

---

### WR-06: Login redirect occurs before `router.refresh()` — session may not propagate

**File:** `src/components/auth/login-form.tsx:75-76`

**Issue:** After a successful login, `router.push('/dashboard')` is called before `router.refresh()`. In Next.js 13+, `router.push` triggers navigation immediately. If the navigation completes before the refresh flushes the updated session cookies into the RSC cache, the dashboard Server Components may read a stale (unauthenticated) cookie store and trigger a redirect back to login. The Supabase SSR documentation recommends calling `router.refresh()` first, then navigating.

**Fix:**
```typescript
// login-form.tsx and signup-form.tsx — swap the call order:
router.refresh()
router.push('/dashboard')
```

---

## Info

### IN-01: Landing page (`src/app/page.tsx`) is unmodified Next.js boilerplate

**File:** `src/app/page.tsx:1-65`

**Issue:** The root route serves the default Next.js starter template including Vercel/Next.js branding links, `next.svg`/`vercel.svg` assets, and "To get started, edit the page.tsx file." copy. This is publicly accessible and unrelated to the application. The middleware correctly redirects authenticated users from `/login` to `/dashboard`, but unauthenticated users hitting `/` will see the boilerplate.

**Fix:** Replace with a marketing/landing page or add a redirect to `/login` in the root page component, depending on product intent.

---

### IN-02: Font variable name mismatch — `--font-inter` declared but `--font-sans` consumed

**File:** `src/app/layout.tsx:6` and `src/app/globals.css:10`

**Issue:** `layout.tsx` loads Inter and sets `variable: '--font-inter'`, then applies `inter.variable` to the body class. `globals.css` maps `--font-sans` to `var(--font-sans)` via `@theme inline`, and `tailwind.config` (implicit via Tailwind v4) resolves `font-sans` through `--font-sans`. The body has the `--font-inter` CSS variable in scope but the theme references `--font-sans`. Unless shadcn/tailwind.css internally maps `--font-sans` to `--font-inter`, the Inter font will not apply to `font-sans` utility classes.

**Fix:**
```typescript
// Option A — change the variable name to match what the theme expects:
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

// Option B — add a CSS bridge in globals.css:
// :root { --font-sans: var(--font-inter); }
```

---

### IN-03: `rules` table lacks a uniqueness constraint on `(user_id, project_id, rule_key, scope)`

**File:** `supabase/migrations/20260422000001_create_tables.sql:64-77`

**Issue:** The `rules` table is designed as a key-value store (`rule_key`, `rule_value`) but has no unique constraint on the key within a scope. Duplicate rule keys per project/scope can be inserted, leading to ambiguous lookups. Any "get rule by key" query would return multiple rows unexpectedly.

**Fix:**
```sql
ALTER TABLE public.rules
  ADD CONSTRAINT rules_unique_key_per_scope
  UNIQUE (user_id, project_id, rule_key, scope);
```

---

### IN-04: `audits` table has a redundant `updated_at` column and UPDATE policy

**File:** `supabase/migrations/20260422000001_create_tables.sql:186-199` and `supabase/migrations/20260422000002_rls_policies.sql:149-160`

**Issue:** The `audits` table is described as an "append-only log" in the code comment, but it has `updated_at`, an UPDATE trigger, and an UPDATE RLS policy. Audit records should never be mutated. The UPDATE policy contradicts the append-only intent and is a data integrity risk.

**Fix:**
```sql
-- Remove the update trigger and policy, drop updated_at:
DROP TRIGGER set_audits_updated_at ON public.audits;
DROP POLICY "audits_update_own" ON public.audits;
ALTER TABLE public.audits DROP COLUMN updated_at;
-- Also remove the delete policy if true audit immutability is desired:
DROP POLICY "audits_delete_own" ON public.audits;
```

---

### IN-05: `src/app/page.tsx` imports `next/image` but renders Vercel/Next.js SVG assets

**File:** `src/app/page.tsx:1`

**Issue:** The boilerplate page imports `Image` from `next/image` and references `/next.svg` and `/vercel.svg` from the public directory. These assets will need to be present at build time. When the landing page is replaced (see IN-01), this import and those assets become dead code/files. Flagging for awareness during cleanup.

**Fix:** Remove as part of replacing the landing page (IN-01).

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
