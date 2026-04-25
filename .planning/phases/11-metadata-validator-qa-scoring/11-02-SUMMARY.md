---
phase: 11-metadata-validator-qa-scoring
plan: "02"
subsystem: metadata-validator-ui
tags: [qa, rules-engine, dialog, score-row, lock-flow]
dependency_graph:
  requires:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx (computeQaRules export — Plan 01)
    - src/app/api/ai/qa-audit/route.ts (Plan 01)
    - src/lib/rules/rule-meta.ts (RULE_META)
    - src/app/(dashboard)/projeler/[id]/kurallar/page.tsx (rules sorgu pattern)
  provides:
    - resolvedRules SSR prop (page.tsx → PagePackageEditor)
    - QA dialog state machine (rules/loading/result/error)
    - Score row (SEO | İçerik | İnsan | Schema | Hazırlık)
    - qa_scores DB kaydetme (handleConfirmLock)
  affects:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
tech_stack:
  added: []
  patterns:
    - SSR rules resolution (global + project override merge)
    - QA dialog single-dialog multi-phase state machine
    - client-side score computation (seo/metadata/schema) + LLM scores (content/human)
    - useTransition + router.refresh() on lock
key_files:
  created: []
  modified:
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx
    - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
decisions:
  - "Single Dialog, multi-phase content swap — no nested dialogs (UI-SPEC requirement)"
  - "proceedToQA immediately opens dialog in loading state, rules dialog bypassed if no violations"
  - "scoreColor helper as local function inside component — keeps color logic close to render"
  - "QaResult + QaCheck tipler bileşen içinde tanımlandı — route.ts ile ayrı bundle"
metrics:
  duration: "~15 min"
  completed: "2026-04-25"
  tasks: 2
  files_modified: 2
---

# Phase 11 Plan 02: page.tsx Rules SSR + PagePackageEditor QA Dialog & Score Row Summary

**One-liner:** page.tsx'e global+project rules SSR sorgusu ve qa_scores SELECT eklendi; PagePackageEditor'a rules-engine ile tetiklenen 4-aşamalı QA dialog, 5-boyutlu score row ve handleConfirmLock ile qa_scores DB yazımı eklendi.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | page.tsx — rules sorgulama + resolvedRules prop + qa_scores SELECT | 9ef90e1 | page.tsx |
| 2 | PagePackageEditor.tsx — projectRules prop + QA dialog state makinesi + score row + qa_scores kaydetme | 728757b | PagePackageEditor.tsx |

## What Was Built

### Task 1: page.tsx Güncellemesi

`src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` güncellendi:
- `RULE_META` import eklendi (`@/lib/rules/rule-meta`)
- Global kurallar sorgusu: `rules.select().eq('scope','global').is('project_id', null)`
- Proje override sorgusu: `rules.select().eq('scope','project').eq('project_id', id)`
- `resolvedRules: Record<string, boolean>` — her kural için override varsa proje değeri, yoksa global değer (varsayılan `true`)
- `page_packages` SELECT sorgusuna `qa_scores` eklendi
- `PagePackageEditor` çağrısına `projectRules={resolvedRules}` prop geçirildi

### Task 2: PagePackageEditor.tsx Güncellemesi

`src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` güncellendi:

**Imports:** `computeQaRules` ve `QaRule` tipi QaBadge'den import edildi

**Yeni tipler:**
- `QaCheck`: `{ id: 'intent_drift'|'robotic_language'|'entity_gap'|'duplicate_risk'; severity; note }`
- `QaResult`: `{ checks: QaCheck[]; content_score: number; human_score: number }`
- `PageData.pkg.qa_scores` optional field eklendi

**Bileşen imzası:** `projectRules: Record<string, boolean>` prop eklendi

**Yeni state'ler (5):**
- `qaDialogOpen` — dialog açık/kapalı
- `qaDialogPhase` — `'rules' | 'loading' | 'result' | 'error'`
- `ruleViolations` — kural ihlalleri listesi
- `qaResult` — Claude QA yanıtı
- `qaScores` — 5-boyutlu skor state (DB'den gelen değerle başlar)

**Yeni fonksiyonlar:**
- `scoreColor(n)`: `≥80 emerald-400`, `60-79 amber-400`, `<60 red-400`, `null muted-foreground`
- `computeSchemaScore(schemaJsonLd)`: boş=0, geçerli JSON=100, geçersiz JSON=50
- `computeSeoScore(violations)`: 100 - error×20 - warning×10
- `computeMetadataScore(seoTitle, metaDesc, h1)`: 4 alan doluluk + meta uzunluk kontrolü
- `proceedToQA()`: loading state aç → `/api/ai/qa-audit` POST → skor hesapla → result/error state
- `handleLockClick()`: rules check → ihlal varsa dialog('rules') → yoksa doğrudan proceedToQA
- `handleConfirmLock()`: qa_scores DB'ye yaz (updatePagePackage) → updatePackageStatus('locked')

**UI güncellemeleri:**
- QaBadge çağrısı: `projectRules={}` → `projectRules={projectRules}`
- Score row: QaBadge altında `SEO | İçerik | İnsan | Schema | Hazırlık` renk kodlamasıyla
- Kilitle butonu: `handleStatusChange('locked')` → `handleLockClick`
- QA Dialog: 4 phase'li tek controlled dialog (rules/loading/result/error)

## Deviations from Plan

None — plan exactly as written.

## Known Stubs

None — Plan 01'deki `projectRules={}` stub'ı bu plan ile çözüldü. Tüm skorlar gerçek data kaynağına bağlandı.

## Threat Surface Scan

Plan'daki STRIDE register ile örtüşüyor — yeni yüzey yok.

| Mitigated | File | Description |
|-----------|------|-------------|
| T-11-06 | PagePackageEditor.tsx handleConfirmLock | updatePagePackage verifyOwnership koruması — server action zaten mevcut |
| T-11-08 | page.tsx | resolvedRules boolean değerler — hassas veri değil |

## Self-Check

**Modified files exist:**
- src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx: FOUND
- src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx: FOUND

**Commits exist:**
- 9ef90e1: FOUND
- 728757b: FOUND

## Self-Check: PASSED
