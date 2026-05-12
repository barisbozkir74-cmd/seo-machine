---
phase: 23-keyword-strategy-ai-intelligence
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
  - src/app/api/keywords/analyze/route.ts
  - supabase/migrations/20260512000001_ai_memory.sql
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 23 adds two-phase Anthropic streaming analysis, a `KeywordChat` UI extension, a `propagateClusterDecisions` batch UPSERT, and the `ai_memory` Supabase table. Auth guards and IDOR protection are applied consistently across all server actions and the API route. The migration's RLS policy is correct. The main risks are a silent stream hang when Anthropic throws inside the `ReadableStream` constructor, a UNIQUE constraint mismatch that will cause UPSERT conflicts to silently drop writes for multi-user scenarios, and a client-side race condition between the auto-trigger `useEffect` and the "Stratejiyi Yenile" button.

---

## Critical Issues

### CR-01: ReadableStream `start()` has no error handler — Anthropic errors silently hang the client

**File:** `src/app/api/keywords/analyze/route.ts:119-174`

**Issue:** The `ReadableStream` `start(controller)` callback is an `async` function but has no `try/catch`. If either `anthropic.messages.create()` call throws (network error, rate-limit, invalid API key, Anthropic 5xx), the exception rejects the async start callback. The Web Streams spec closes the stream with a `TypeError` in that case, but the response has already been sent with status 200 and `Transfer-Encoding: chunked`. The client receives a truncated body, `reader.read()` eventually resolves `{ done: true }` with no error indication, and the UI is left showing whatever partial content (possibly nothing) with `isStreaming = false`. The user sees no actionable error message.

Additionally, if the Anthropic error fires before the separator token is flushed, the client never transitions to `inReview = true`, so `reviewId` message stays as an empty placeholder bubble forever.

**Fix:**
```typescript
const readable = new ReadableStream({
  async start(controller) {
    try {
      let primaryOutput = ''

      const primaryStream = await anthropic.messages.create({ ... })
      for await (const event of primaryStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          primaryOutput += event.delta.text
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }

      controller.enqueue(encoder.encode('\n\n__REVIEW_START__\n\n'))

      const reviewStream = await anthropic.messages.create({ ... })
      for await (const event of reviewStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }

      await supabase.from('ai_memory').upsert(...)
      controller.close()
    } catch (err) {
      // Emit a structured error token the client can detect
      controller.enqueue(encoder.encode('\n\n__STREAM_ERROR__\n\n'))
      controller.close()
      // Or: controller.error(err) if you want the fetch to reject
    }
  },
})
```

Pair this with client-side handling in `runAnalysis()` to detect `__STREAM_ERROR__` and show a user-facing message.

---

### CR-02: `ai_memory` UNIQUE constraint excludes `user_id` — UPSERT target mismatch causes silent write failures

**File:** `supabase/migrations/20260512000001_ai_memory.sql:13` and `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:974`, `src/app/api/keywords/analyze/route.ts:171`

**Issue:** The migration defines:
```sql
UNIQUE(project_id, module, key)
```

But both UPSERT call sites pass `{ onConflict: 'project_id,module,key' }`. This is a triple key without `user_id`. Because `project_id` is already a foreign key into `projects`, which already enforces single-user ownership, the constraint is technically sufficient for the current data model. However, there is a deeper problem: if two concurrent requests for the same `project_id` / `module` / `key` arrive (e.g., user opens two tabs and both trigger `runAnalysis` simultaneously), the second UPSERT will silently overwrite the first with no conflict guard on `user_id`. More critically, if a Supabase RLS bug or future schema change ever allows a cross-user `project_id` collision, the UNIQUE constraint provides no per-user isolation at the DB level.

The more immediate correctness bug: `actions.ts:974` passes `onConflict: 'project_id,module,key'` but the actual constraint name in Postgres is based on the column set. Supabase's `upsert` with `onConflict` as a column list relies on there being a matching unique constraint or index. Since `user_id` is absent from both the constraint and the `onConflict` list, any row where `user_id` differs but `(project_id, module, key)` matches would cause a unique violation error rather than an upsert — but since RLS prevents this from happening at query time, the failure mode is silent data loss when two same-user concurrent writes race.

**Fix:** Add `user_id` to the UNIQUE constraint for defense-in-depth and alignment with every other table in the schema:

```sql
-- In the migration (requires a new migration to alter)
ALTER TABLE public.ai_memory DROP CONSTRAINT ai_memory_project_id_module_key_key;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_user_project_module_key_key
  UNIQUE(user_id, project_id, module, key);
```

Update both UPSERT call sites to `{ onConflict: 'user_id,project_id,module,key' }`.

---

## Warnings

### WR-01: `runAnalysis()` auto-trigger in `useEffect` can fire concurrently with "Stratejiyi Yenile" button click

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx:38-44` and `216`

**Issue:** The `useEffect` on line 38 reads `isStreaming` from a closure snapshot, not from a ref. React state reads inside `useEffect` always see the value at mount time. On initial mount `isStreaming` is `false`, so `runAnalysis()` is called unconditionally if localStorage has no entry. If the user immediately clicks "Stratejiyi Yenile" before the first `setIsStreaming(true)` in `runAnalysis()` completes (async gap between line 104 `if (isStreaming) return` and line 112 `setIsStreaming(true)`), a second concurrent `runAnalysis()` can be dispatched. Both calls set `isStreaming(true)` after their respective async gaps, leading to two concurrent Anthropic pipelines whose `setMessages` calls will interleave and corrupt the message list.

The "Stratejiyi Yenile" button is `disabled={isStreaming}` but this guard is only effective after `setIsStreaming(true)` has rendered — there is a tick between the `if (isStreaming) return` check and the state update.

**Fix:** Use a `useRef` lock that is set synchronously before any `await`:

```typescript
const isStreamingRef = useRef(false)

const runAnalysis = async () => {
  if (isStreamingRef.current) return
  isStreamingRef.current = true
  setIsStreaming(true)
  // ... rest of function
  // in finally:
  isStreamingRef.current = false
  setIsStreaming(false)
}
```

---

### WR-02: `accumulated.split('__REVIEW_START__')` called twice — O(n) string split on potentially large payload

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx:142-147`

**Issue:** When the separator token is detected, `accumulated.split('__REVIEW_START__')` is called twice in the same branch:

```typescript
const primaryContent = accumulated.split('__REVIEW_START__')[0]   // line 142
// ...
accumulated = accumulated.split('__REVIEW_START__')[1] ?? ''       // line 147
```

This is a minor redundancy (two allocations of the split array), but the real bug is correctness: if the AI output itself ever contains the literal string `__REVIEW_START__` (not impossible — the Review AI system prompt names it implicitly in context, and the Primary AI could echo it), the split will fragment the primary content incorrectly. The separator is not stripped from the AI's accessible context.

**Fix:** Split once, destructure, and make the separator non-echoed:

```typescript
const parts = accumulated.split('__REVIEW_START__')
const primaryContent = parts[0]
accumulated = parts[1] ?? ''
```

To reduce the collision risk, use a less guessable separator like `\x00REVIEW\x00` (null byte sequences that AI models will not generate in text output).

---

### WR-03: `propagateClusterDecisions` UPSERT missing `user_id` filter for `pages` query — potential cross-user data in snapshot

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:896-900`

**Issue:** The `blueprintPages` query uses `.eq('user_id', userId)` correctly. However, the `clusterPageIds` computation on line 921-924 calls `approvedClusters.some((c) => c.id === p.cluster_id)` — this correctly cross-references already-fetched data. The concern is subtler: if Supabase RLS is disabled on the `pages` table (e.g., during a migration or test), the `.eq('user_id', userId)` guard is the only isolation. This is acceptable as-is, but it should be noted that the `blueprintSnapshot` stored in `ai_memory` includes the raw page `id`, `title`, `slug`, and `page_type`. If the `ai_memory` value is ever rendered to another user (e.g., a future sharing feature), these page details would leak. This is a forward-looking concern rather than a current bug, and it is documented here as a warning.

The immediate, actionable bug: the `blueprintPages` query on line 896 selects `cluster_id` from `pages`, but `cluster_id` is only in the select list if the `pages` table has that column. If the column does not exist (schema drift), this query silently returns rows with `cluster_id: undefined`, and `clusterPageIds` will always be empty, causing silent data loss in the `page_packages` memory slot. There is no error check on the query result.

**Fix:** Add a guard after the query:

```typescript
const { data: blueprintPages, error: pagesErr } = await supabase
  .from('pages')
  .select('id, title, slug, page_type, cluster_id')
  .eq('project_id', projectId)
  .eq('user_id', userId)

if (pagesErr) {
  console.error('[propagateClusterDecisions] pages query failed:', pagesErr)
  // Continue with empty pages rather than throwing — non-fatal
}
```

---

## Info

### IN-01: `temperature: 0.4 as never` type assertion masks a legitimate TypeScript type gap

**File:** `src/app/api/keywords/analyze/route.ts:126` and `147`

**Issue:** `temperature` is cast with `as never` to suppress a TypeScript error. This indicates the Anthropic SDK's type definitions for `messages.create` do not include `temperature` in the streaming overload, or the installed SDK version is missing it. The `as never` cast silences the compiler but means if the parameter name or accepted range ever changes in the SDK, there will be no compile-time warning. Using `as never` specifically (rather than `as unknown as number`) is also semantically misleading — it tells TypeScript the value is of type `never`, which is the bottom type.

**Fix:** If `temperature` is a valid runtime parameter, use a targeted suppression:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
temperature: 0.4 as any,
```
Or upgrade the Anthropic SDK to a version that includes `temperature` in its streaming type definitions and remove the cast entirely.

---

### IN-02: `localStorage` gate for auto-analysis does not invalidate on project data changes

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx:39-44`

**Issue:** `localStorage.getItem(\`kwai_analyzed_${projectId}\`)` is set once on successful analysis and never cleared when the project's keyword data changes (new imports, cluster operations, enrichment runs). A user who imports new keywords and returns to the keyword strategy page will not see a fresh analysis — the auto-trigger is suppressed even though the data has changed. The "Stratejiyi Yenile" button serves as the manual override, but there is no visual indication that the cached analysis may be stale.

**Fix:** Either store a content hash/version alongside the timestamp, or clear the localStorage entry from relevant server actions (e.g., `importKeywords`, `approveStrategy`) by emitting a client-side event, or document this as a known limitation in a code comment so future contributors understand the intentional trade-off.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
