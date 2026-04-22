---
phase: 01-foundation
plan: 01
subsystem: ui
tags: [nextjs, tailwind, shadcn, supabase, react-hook-form, zod, typescript]

# Dependency graph
requires: []
provides:
  - Next.js 16 app with App Router scaffolded
  - shadcn/ui v4 initialized with dark Slate theme (mira preset, baseColor slate)
  - Login page at /login with full form validation
  - Signup page at /signup with full form validation
  - Supabase CLI initialized (config.toml)
  - Core UI components: button, input, label, card, form
  - Dark mode layout (html className="dark", Slate 950 background)
affects: [01-02, 01-03, 01-04, all future phases]

# Tech tracking
tech-stack:
  added:
    - "Next.js 16.2.4 (App Router, TypeScript, Tailwind v4)"
    - "shadcn/ui v4 with @base-ui/react (replaces @radix-ui)"
    - "tailwindcss v4 (CSS-first, no tailwind.config.ts)"
    - "@supabase/supabase-js v2, @supabase/ssr v0.10"
    - "react-hook-form v7, @hookform/resolvers v5, zod v4"
    - "lucide-react v1"
  patterns:
    - "Auth pages use centered card layout (min-h-screen flex items-center justify-center)"
    - "Client form components wrap shadcn Card with react-hook-form + zod"
    - "Form components split: page.tsx (metadata/layout) + form.tsx (client component with logic)"
    - "Dark mode enforced statically via html className='dark' (no toggle)"
    - "Supabase auth stubs commented out with TODO markers for Plan 04"

key-files:
  created:
    - "src/app/layout.tsx — root layout, html dark class, Inter font"
    - "src/app/globals.css — Tailwind v4 CSS with Slate dark theme variables"
    - "src/app/(auth)/login/page.tsx — /login route with metadata"
    - "src/app/(auth)/signup/page.tsx — /signup route with metadata"
    - "src/components/auth/login-form.tsx — login form client component"
    - "src/components/auth/signup-form.tsx — signup form client component"
    - "src/components/ui/form.tsx — react-hook-form wrapper (manual, shadcn v4 has no CLI form)"
    - "src/components/ui/button.tsx — shadcn button (@base-ui/react)"
    - "src/components/ui/input.tsx — shadcn input (@base-ui/react)"
    - "src/components/ui/label.tsx — shadcn label"
    - "src/components/ui/card.tsx — shadcn card"
    - "src/lib/utils.ts — cn() utility"
    - "supabase/config.toml — Supabase CLI project config"
    - ".env.local.example — placeholder env vars template"
    - "components.json — shadcn configuration (baseColor: slate)"
    - "package.json — all dependencies"
    - "tsconfig.json — @/* maps to ./src/*"
  modified: []

key-decisions:
  - "Used create-next-app in temp directory then copied to project root (avoids conflict with existing .planning/ dir)"
  - "shadcn v4 uses @base-ui/react instead of @radix-ui — form.tsx created manually (no CLI equivalent)"
  - "Tailwind v4 CSS-first approach used (no tailwind.config.ts file — different from plan expectation)"
  - "components.json baseColor set to 'slate' manually after shadcn init with mira preset"
  - "Dark Slate CSS variables hardcoded in globals.css .dark section matching UI-SPEC hex values"
  - "Supabase auth calls stubbed (commented out) per plan instruction — Plan 04 will implement"

patterns-established:
  - "Route groups: app/(auth)/ for unauthenticated pages, app/(dashboard)/ for protected pages (future)"
  - "Form pattern: FormField > FormItem > Label + FormControl + FormMessage"
  - "Error display: inline FormMessage for field errors, p.text-destructive for auth errors above submit"

requirements-completed:
  - INFR-01

# Metrics
duration: 14min
completed: 2026-04-22
---

# Phase 01 Plan 01: Foundation Scaffold Summary

**Next.js 16 + shadcn/ui v4 dark Slate theme scaffolded with login/signup pages, react-hook-form validation, and Supabase CLI initialized**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-22T13:38:00Z
- **Completed:** 2026-04-22T13:51:51Z
- **Tasks:** 2
- **Files modified:** 29 created, 0 modified

## Accomplishments

- Scaffolded Next.js 16 (App Router) with TypeScript, Tailwind v4, and all required dependencies installed
- Initialized shadcn/ui v4 with Slate dark theme — login and signup pages render at /login and /signup with full zod validation, error messages, loading states, and 44px submit buttons
- Initialized Supabase CLI (config.toml created) with .env.local.example commited (no real keys)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js app with all dependencies** - `97bf471` (feat)
2. **Task 2: Build login and signup pages per UI-SPEC** - `3c4fd86` (feat)

**Plan metadata:** _(committed after SUMMARY creation)_

## Files Created/Modified

- `src/app/layout.tsx` — Root layout, `html className="dark"`, Inter font, bg-background body
- `src/app/globals.css` — Tailwind v4 with Slate dark theme CSS variables (Slate 950 bg, Slate 900 card)
- `src/app/(auth)/login/page.tsx` — /login route, metadata title "Sign in — SEO Machine"
- `src/app/(auth)/signup/page.tsx` — /signup route, metadata title "Create account — SEO Machine"
- `src/components/auth/login-form.tsx` — Client form: react-hook-form + zod, Card layout, all UI-SPEC copy
- `src/components/auth/signup-form.tsx` — Client form: identical structure, different copy
- `src/components/ui/form.tsx` — Manual react-hook-form wrapper (shadcn v4 has no CLI form component)
- `src/components/ui/button.tsx` — shadcn button using @base-ui/react
- `src/components/ui/input.tsx` — shadcn input using @base-ui/react
- `src/components/ui/label.tsx` — shadcn label (native HTML)
- `src/components/ui/card.tsx` — shadcn card with CardHeader/CardContent/CardFooter
- `src/lib/utils.ts` — cn() utility (clsx + tailwind-merge)
- `supabase/config.toml` — Supabase CLI initialization
- `.env.local.example` — Placeholder env vars, committed (real .env.local gitignored via .env*)
- `components.json` — shadcn config with baseColor: "slate"
- `package.json` — All dependencies including @supabase/ssr, react-hook-form, zod

## Decisions Made

- Used temp directory scaffold approach because create-next-app refuses to run in a directory with existing files (.planning/)
- shadcn v4 (released ~2025) replaced @radix-ui with @base-ui/react — form.tsx was created manually since `npx shadcn add form` does nothing in v4
- Tailwind v4 uses CSS-first config (no tailwind.config.ts), the plan expected v3 but v4 is what create-next-app@latest installs
- mira preset chosen for shadcn init (closest to dark professional theme), then baseColor manually set to "slate" in components.json

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded via temp directory due to create-next-app conflict**
- **Found during:** Task 1 (scaffold Next.js app)
- **Issue:** `create-next-app` refuses to scaffold into a directory with existing files (.planning/)
- **Fix:** Scaffolded to `seo-machine-temp/` directory, then copied all files to project root (excluding .planning/, node_modules already handled)
- **Files modified:** All project files
- **Verification:** npm run build passes
- **Committed in:** 97bf471 (Task 1 commit)

**2. [Rule 1 - Bug] form.tsx created manually — shadcn v4 has no CLI form component**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** `npx shadcn@latest add form` silently does nothing in shadcn v4 (no form in v4 registry)
- **Fix:** Created `src/components/ui/form.tsx` manually implementing the react-hook-form wrapper pattern from shadcn v3, but without @radix-ui/react-slot (not installed in v4); used React.cloneElement approach instead for FormControl
- **Files modified:** src/components/ui/form.tsx
- **Verification:** Build passes, TypeScript errors zero
- **Committed in:** 97bf471 (Task 1 commit)

**3. [Rule 1 - Bug] Tailwind v4 CSS-first config (no tailwind.config.ts)**
- **Found during:** Task 1 (scaffolding)
- **Issue:** Plan expects tailwind.config.ts but create-next-app@latest installs Tailwind v4 which uses CSS-only config (@import "tailwindcss" in globals.css)
- **Fix:** Accepted Tailwind v4 approach — globals.css contains all theme tokens via CSS custom properties and @theme inline directive. Functionality matches plan intent.
- **Files modified:** src/app/globals.css (CSS variables replace tailwind.config.ts)
- **Verification:** Dark Slate theme renders, build passes
- **Committed in:** 97bf471 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking scaffold workaround, 2 Rule 1 compatibility fixes for shadcn/Tailwind v4)
**Impact on plan:** All deviations caused by newer library versions (shadcn v4, Tailwind v4) vs what the plan was written for. All functionality intent achieved. Build passes, pages render correctly.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Supabase `signInWithPassword` | `src/components/auth/login-form.tsx` | 60-73 | Supabase browser client (`@/lib/supabase/client`) created in Plan 04 |
| Supabase `signUp` | `src/components/auth/signup-form.tsx` | 60-77 | Same — resolved in Plan 04 |

**Note:** These stubs are intentional per plan instruction ("stub the import with `// TODO: implement in Plan 04`"). The auth call code is commented out. The form submits and logs to console — no real auth happens until Plan 04.

## Issues Encountered

- create-next-app conflict with .planning/ directory required temp directory workaround
- shadcn v4 major breaking changes from v3 (different component registry, @base-ui instead of @radix-ui) required manual form.tsx creation

## User Setup Required

None - no external service configuration required for this plan. Supabase CLI was initialized but `supabase start` (requires Docker) is deferred to user when they need local development.

## Next Phase Readiness

- Next.js app skeleton is ready for all subsequent plans
- shadcn/ui components (button, input, label, card, form) available for reuse
- Auth pages exist but have no real auth — Plan 04 will wire Supabase authentication
- RLS tables and middleware are Plan 02 and Plan 03 work

---
*Phase: 01-foundation*
*Completed: 2026-04-22*
