---
phase: 12-content-studio
reviewed: 2026-04-26T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/api/ai/generate-section/route.ts
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/page.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioHeader.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/SectionCard.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/StreamingText.tsx
  - src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/HtmlReadyBanner.tsx
  - supabase/migrations/20260426000001_add_content_studio_columns.sql
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 12 introduces the Content Studio: a section-by-section AI content generation workflow with streaming, approve/reject per section, and final HTML assembly. The architecture is sound — ownership checks are present at every layer, the status gate (`locked` only) is enforced in both the API route and server actions, and the streaming implementation is clean.

Two areas require attention before shipping:

1. **XSS in `assembleHtml`** — AI-generated content and user edits are concatenated into raw HTML without escaping. If that HTML string is ever rendered unescaped (e.g., WordPress raw paste, `dangerouslySetInnerHTML`), it opens an injection vector.
2. **Stale closure in concurrent section generation** — `generateSection` closes over the `sections` snapshot at callback creation time. Parallel generation calls each write `updatedSections` derived from their own stale snapshot, causing the last-writer-wins race to silently discard intermediate approved sections.

Additional warnings around silent save failures, unsynced local state, and structural data loss are documented below.

---

## Critical Issues

### CR-01: XSS via Unsanitized HTML Assembly in `assembleHtml`

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:69`
**Issue:** `section.heading` and `section.content` are string-interpolated directly into an HTML template without any escaping. Content originates from AI responses and user textarea edits — both untrusted. If `html_content` is later rendered with `dangerouslySetInnerHTML`, pasted into a WordPress custom HTML block, or consumed by any downstream system that trusts this field as safe HTML, a malicious or hallucinated AI response containing `<script>`, `<img onerror=...>`, or similar payloads will execute.

```typescript
// Current — vulnerable
function assembleHtml(sections: ContentSection[]): string {
  return sections
    .map((section) => {
      let html = `<h2>${section.heading}</h2>\n<p>${section.content}</p>`
      // ...
    })
    .join('\n\n')
}
```

**Fix:** Escape all dynamic values before interpolation. A minimal, dependency-free escaper:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function assembleHtml(sections: ContentSection[]): string {
  return sections
    .map((section) => {
      const safeHeading = escapeHtml(section.heading)
      const safeContent = escapeHtml(section.content)
      let html = `<h2>${safeHeading}</h2>\n<p>${safeContent}</p>`
      if (section.sub_headings && section.sub_headings.length > 0) {
        const subHtml = section.sub_headings.map((sub) => `<h3>${escapeHtml(sub)}</h3>`).join('\n')
        html = `<h2>${safeHeading}</h2>\n${subHtml}\n<p>${safeContent}</p>`
      }
      return html
    })
    .join('\n\n')
}
```

---

## Warnings

### WR-01: Stale Closure Race Condition in Concurrent Section Generation

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx:135`
**Issue:** `generateSection` is a `useCallback` that closes over `sections`. When "Tümünü Üret" fires, all N calls to `generateSection` are dispatched in the same render cycle, each capturing the same `sections` snapshot. When stream N completes, it builds `updatedSections` from that original snapshot — not from the current state which may already have another section's content written. The final `setSections` call and `saveContentSections` call from the last-completing stream will overwrite all others' results with stale data.

**Fix:** Use the functional updater form of `setSections` to always operate on the latest state, and pass the accumulated value into the updater rather than closing over `sections`:

```typescript
// After stream completes, use functional update instead of closing over `sections`
setSections((prev) => {
  return prev.map((s, i) =>
    i === index ? { ...s, content: accumulated, status: 'draft' as const } : s
  )
})

// For saveContentSections, read latest state via a ref
// Add: const sectionsRef = useRef(sections)
// Keep sectionsRef.current in sync: useEffect(() => { sectionsRef.current = sections }, [sections])
// Then: saveContentSections(projectId, pageId, sectionsRef.current)
```

Alternatively, save only the single updated section server-side rather than the full array to avoid the overwrite race entirely.

### WR-02: `localContent` Not Synced After Section Regeneration

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/SectionCard.tsx:55`
**Issue:** `localContent` is initialized to `section.content` once on mount via `useState`. When the parent regenerates a section and passes new `section.content` as a prop, `localContent` remains stale — the textarea will show the old content. The user would need to navigate away and back to see fresh content.

**Fix:** Sync `localContent` when `section.content` changes externally (i.e., when not streaming and not user-edited). The cleanest approach is a `useEffect`:

```typescript
useEffect(() => {
  // Only sync from prop when not in an active editing/streaming state
  if (section.status === 'draft' || section.status === 'pending') {
    setLocalContent(section.content)
  }
}, [section.content, section.status])
```

### WR-03: Silent Save Failure After Stream Completion

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx:142`
**Issue:** `saveContentSections` is called as fire-and-forget. When it fails, there is no user notification — the UI shows content as "Taslak" but the data is not persisted in the DB. A page refresh will lose all generated content.

```typescript
// Current — errors silently swallowed
saveContentSections(projectId, pageId, updatedSections).then((result) => {
  if (result.success) router.refresh()
})
```

**Fix:** Surface save errors to the user with a toast or inline error state:

```typescript
saveContentSections(projectId, pageId, updatedSections).then((result) => {
  if (result.success) {
    router.refresh()
  } else {
    // e.g., set an error state that renders a banner
    setSaveError(result.error)
  }
})
```

### WR-04: `headingHierarchy` Sent to API Always as H2 — Sub-heading Structure Lost

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/ContentStudioShell.tsx:102`
**Issue:** The `headingHierarchy` array passed to the `/api/ai/generate-section` route is built by mapping over `sections` with a hardcoded `'H2'` level. `ContentSection` objects have a `level` field (numeric), and sections include `sub_headings`. The API route uses `headingHierarchy` to construct the heading list shown to the AI — by flattening everything to H2, the model loses context about which sections are sub-sections, degrading content generation quality.

```typescript
// Current — loses H3/H4 structure
const headingHierarchy = sections.map((s) => ({ level: 'H2', text: s.heading }))
```

**Fix:** Expand sub_headings into the hierarchy array with the correct level string:

```typescript
const headingHierarchy = sections.flatMap((s) => [
  { level: `H${s.level}`, text: s.heading },
  ...s.sub_headings.map((sub) => ({ level: 'H3', text: sub })),
])
```

### WR-05: `content_sections` Cast Without Runtime Validation in `approveSection` and `rejectSection`

**File:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:150`
**Issue:** `pkg.content_sections` is cast directly to `ContentSection[]` after only an `Array.isArray` check. If the JSONB stored in the DB is a valid array but its items are missing fields (e.g., `status` is absent), the `sections[sectionIndex].status` access will return `undefined`, and the spread `{ ...sections[sectionIndex], status: 'approved' }` will proceed without error while the rest of the object is corrupted. This can happen if a migration or external tooling writes to `content_sections` with an incompatible shape.

**Fix:** Add a minimal shape check or use a type guard before operating:

```typescript
function isContentSection(item: unknown): item is ContentSection {
  if (typeof item !== 'object' || item === null) return false
  const s = item as Record<string, unknown>
  return (
    typeof s.heading === 'string' &&
    typeof s.level === 'number' &&
    Array.isArray(s.sub_headings) &&
    typeof s.content === 'string' &&
    ['pending', 'generating', 'draft', 'approved', 'rejected'].includes(s.status as string)
  )
}

const sections: ContentSection[] = Array.isArray(pkg.content_sections) &&
  (pkg.content_sections as unknown[]).every(isContentSection)
  ? (pkg.content_sections as ContentSection[])
  : []
```

---

## Info

### IN-01: Duplicate "Yeniden Üret" Button When Section Is Approved

**File:** `src/app/(dashboard)/projeler/[id]/icerik-studio/[pageId]/components/SectionCard.tsx:115-157`
**Issue:** When `isApproved` is true, two "Yeniden Üret" buttons are rendered — one unconditionally at line 115 (the top button shown for all non-streaming states) and another explicitly for approved state at line 150. Both call `onRegenerate(sectionIndex)` with the same handler. Only one should be shown.

**Fix:** Remove the duplicate at lines 150–157 (the bottom conditional block for `isApproved`). The top button at line 115 already renders for approved sections since its only guard is `disabled={isPending || isStreaming}`.

### IN-02: `headingHierarchy` Items Shape Not Validated in API Route

**File:** `src/app/api/ai/generate-section/route.ts:46`
**Issue:** The validation checks `Array.isArray(headingHierarchy)` but does not verify that array items have the expected `{ level: string; text: string }` shape. A malformed item (e.g., `null`, `{}`) at `sectionIndex` would cause `targetSection?.text` to resolve to `undefined`, falling back to `Bölüm ${sectionIndex + 1}` — a silent degradation rather than a clear error. Not a crash, but misleading output.

**Fix:** Add a shallow item validation or at minimum validate the item at `sectionIndex`:

```typescript
const targetItem = headingHierarchy[sectionIndex]
if (!targetItem || typeof targetItem.text !== 'string') {
  return new Response('headingHierarchy item at sectionIndex is invalid', { status: 400 })
}
```

---

_Reviewed: 2026-04-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
