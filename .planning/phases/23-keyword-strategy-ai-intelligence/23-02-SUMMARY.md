---
phase: 23-keyword-strategy-ai-intelligence
plan: "02"
subsystem: api
tags: [anthropic, streaming, ai-analysis, ai_memory, keyword-strategy]
dependency_graph:
  requires:
    - "23-01 (KeywordChat component — provides /api/keywords/analyze fetch call)"
  provides:
    - "POST /api/keywords/analyze — iki aşamalı Anthropic streaming analiz endpoint"
  affects:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx"
tech_stack:
  added:
    - "@anthropic-ai/sdk — messages.create streaming (mevcut dependency, yeni kullanım)"
  patterns:
    - "Two-phase ReadableStream streaming (Primary → separator → Review)"
    - "Promise.all paralel Supabase sorgusu (keywords + clusters + pages)"
    - "ai_memory UPSERT ON CONFLICT pattern (module/key scope)"
key_files:
  created:
    - src/app/api/keywords/analyze/route.ts
  modified: []
decisions:
  - "D-02: AI analizi chat mesajı olarak UI'da gösterilir; bu route proaktif analiz üretir"
  - "D-03: Review AI Primary bittikten otomatik devreye girer — __REVIEW_START__ separator client contract"
  - "D-05: Sadece Site Blueprint (pages tablosu) cross-module context olarak kullanılır"
  - "D-07: ai_memory UPSERT analiz sonrası yapılır, streaming tamamlandıktan sonra"
  - "D-08: module='analysis', key='last_primary' — ai_memory kapsam tanımı"
metrics:
  duration: "~10 dakika"
  completed_date: "2026-05-12"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 23 Plan 02: /api/keywords/analyze Two-Phase Streaming Route Summary

**One-liner:** Auth + IDOR korumalı iki aşamalı Anthropic streaming endpoint — Primary AI (SEO Strateji Uzmanı) stratejik analiz üretir, `__REVIEW_START__` separator sonrası Review AI (SEO Denetçi) cannibalization denetimi yapar; analiz sonrası `ai_memory` UPSERT ile hafıza güncellenir.

## What Was Built

`src/app/api/keywords/analyze/route.ts` — Next.js App Router POST endpoint.

### Pipeline Akışı

1. **Auth guard:** `supabase.auth.getUser()` → null ise 401
2. **IDOR check:** `projects` tablosunda `user_id` eşleşmesi → null ise 404
3. **Paralel context sorgusu (Promise.all):**
   - `keywords` — parent_keyword_id IS NULL, volume DESC, limit 200
   - `keyword_clusters` — total_volume DESC
   - `pages` — sort_order ASC (D-05 blueprint context, ilk 30 sayfa summary'ye dahil)
4. **ai_memory okuma:** module/key bazlı önceki karar hafızası prompt'a dahil edilir
5. **Primary AI stream** (claude-sonnet-4-6, max_tokens:1024, temperature:0.4):
   - 5 görev: intent dağılımı, commercial gap, cannibalization riski, pillar/support map, blueprint uyum
6. **`\n\n__REVIEW_START__\n\n` separator** — client bu token'ı görünce Review mesajını state'e ekler
7. **Review AI stream** (claude-sonnet-4-6, max_tokens:512, temperature:0.3):
   - 3 görev: intent çakışması, cannibalization, eksik commercial page'ler
8. **ai_memory UPSERT** — module:'analysis', key:'last_primary', value:{summary, analyzed_at}
9. **controller.close()**

### Response Headers

```
Content-Type: text/plain; charset=utf-8
Transfer-Encoding: chunked
X-Content-Type-Options: nosniff
```

## Commits

| Hash | Message |
|------|---------|
| 3e3a3b2 | feat(23-02): create /api/keywords/analyze two-phase Anthropic streaming route |

## Deviations from Plan

None — plan tam olarak yazıldığı şekilde uygulandı.

## Known Stubs

None — endpoint tamamen işlevsel; gerçek Anthropic API çağrıları yapar.

## Threat Flags

Threat model planla eşleşiyor — ek yüzey yok:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-23-04 | Auth guard (401) | Uygulandı |
| T-23-05 | IDOR check projects.user_id | Uygulandı |
| T-23-06 | Keyword değerleri system prompt'a eklendi (user mesajı değil); memorySummary slice(0,200) | Uygulandı |
| T-23-07 | ANTHROPIC_API_KEY sunucu-side only | Uygulandı |
| T-23-08 | UPSERT payload'da user_id açıkça set edildi | Uygulandı |

## Self-Check: PASSED

- [x] `src/app/api/keywords/analyze/route.ts` mevcut
- [x] Commit `3e3a3b2` git log'da mevcut
- [x] `import Anthropic from '@anthropic-ai/sdk'` mevcut (OpenAI import yok)
- [x] `export async function POST` mevcut
- [x] `.from('ai_memory')` hem okuma hem upsert için mevcut
- [x] `__REVIEW_START__` separator token mevcut
- [x] `.from('pages')` blueprint context sorgusu mevcut
- [x] `claude-sonnet-4-6` model adı mevcut
- [x] `controller.close()` mevcut
- [x] `npx tsc --noEmit` analyze/route.ts için hata yok
