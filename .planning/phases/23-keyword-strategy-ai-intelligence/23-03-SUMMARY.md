---
phase: 23-keyword-strategy-ai-intelligence
plan: "03"
subsystem: keyword-strategy-ui
tags: [ai-chat, streaming, proactive-analysis, localStorage, dual-message]
dependency_graph:
  requires:
    - "23-01: KeywordPageShell collapse state + KeywordChat mount"
    - "23-02: /api/keywords/analyze streaming route with __REVIEW_START__ separator"
  provides:
    - "KeywordChat proactive analysis: auto-trigger on first load"
    - "Stratejiyi Yenile button: manual re-analysis trigger"
    - "Dual-message stream: Primary AI + Review AI as separate chat bubbles"
  affects:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx"
tech_stack:
  added: []
  patterns:
    - "useEffect auto-trigger with localStorage gate (kwai_analyzed_{projectId})"
    - "Dual-message state machine via __REVIEW_START__ separator token"
    - "isStreaming guard (T-23-10) prevents concurrent analysis"
key_files:
  created: []
  modified:
    - "src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx"
decisions:
  - "runAnalysis defined after send() for readability; auto-trigger useEffect references it via closure (JS hoisting not relied upon — function declaration order is correct)"
  - "Stratejiyi Yenile calls setMessages([]) before runAnalysis() to clear previous analysis before re-streaming"
  - "useTransition import removed (was not in original 218-line file, only useState/useRef/useEffect used)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-12T00:50:42Z"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 23 Plan 03: KeywordChat Proactive Analysis Extension Summary

**One-liner:** KeywordChat genişletildi — sayfa yüklenince localStorage kontrolüyle otomatik analiz tetikleniyor, header'da Stratejiyi Yenile butonu eklendi, stream __REVIEW_START__ tokeninde bölünerek Primary ve Review AI mesajları ayrı chat balonlarında gösteriliyor.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | KeywordChat.tsx runAnalysis + auto-trigger + Stratejiyi Yenile | 7c4098a | KeywordChat.tsx |

## What Was Built

**Auto-trigger useEffect (D-01):**
- Sayfa yüklenince `localStorage.getItem('kwai_analyzed_${projectId}')` kontrol edilir
- Kayıt yoksa `runAnalysis()` otomatik çağrılır
- eslint-disable-next-line comment ile `runAnalysis` dependency uyarısı baskılanır

**runAnalysis() fonksiyonu (D-02, D-03, D-04):**
- `isStreaming` guard ile çift çağrı önlenir (T-23-10 mitigasyonu)
- Primary mesaj placeholder olarak chat'e eklenir (`content: ''` → streaming dots görünür)
- `/api/keywords/analyze` POST ile stream başlatılır
- `accumulated` buffer içinde `__REVIEW_START__` token beklenir
- Token gelince: Primary içerik kesilir, Review mesajı state'e eklenir
- Review mesajları `'Denetim: '` prefix ile gösterilir
- Başarılı tamamlanınca `localStorage.setItem('kwai_analyzed_${projectId}', timestamp)` kaydedilir

**Stratejiyi Yenile butonu (UI-SPEC):**
- Header'da collapse chevron'dan önce `div.flex.items-center.gap-1` wrapper içinde
- `text-violet-400` renk, `disabled:opacity-50` streaming sırasında
- `title="Stratejiyi yeniden analiz et"` attribute
- Streaming: spinner SVG + "Analiz ediliyor..." text
- Normal: "Stratejiyi Yenile" text
- Click: `setMessages([])` + `runAnalysis()` (önceki analiz temizlenir)

**Korunan bölümler:**
- `send()` fonksiyonu: `/api/keywords/chat` çağrısı tamamen değişmedi
- `STARTERS` array ve starter buton render'ı
- Collapsed branch render
- Streaming dots pattern (`msg.content === ''` kontrolü)
- User mesajı bubble stilleri
- Input textarea ve send butonu

## Deviations from Plan

None — plan tam olarak uygulandı. `useTransition` import'u orijinal dosyada yoktu (import listesinde `useState, useRef, useEffect` kullanıldı, plan ile uyumlu).

## Known Stubs

None — runAnalysis() gerçek `/api/keywords/analyze` endpoint'ini çağırır; bu endpoint 23-02-PLAN kapsamında oluşturulmuştur.

## Threat Surface Scan

T-23-10 (isStreaming guard) plan threat model'de listelenmiş ve uygulanmıştır. Yeni güvenlik yüzeyi tespit edilmedi.

## Self-Check

- [x] `KeywordChat.tsx` dosyası worktree'de mevcut: `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordChat.tsx`
- [x] Commit `7c4098a` mevcut
- [x] `runAnalysis` fonksiyon tanımı mevcut (3 referans)
- [x] `kwai_analyzed_` localStorage key mevcut (2 referans)
- [x] `__REVIEW_START__` separator kontrolü mevcut (3 referans)
- [x] `Stratejiyi Yenile` buton metni mevcut (4 referans)
- [x] `Analiz ediliyor...` loading etiketi mevcut
- [x] `Stratejiyi yeniden analiz et` title attr mevcut
- [x] `api/keywords/analyze` fetch target mevcut
- [x] `Denetim: ` review prefix mevcut
- [x] `send()` fonksiyonu korunmuş (`/api/keywords/chat`)
- [x] `STARTERS` array korunmuş
- [x] TypeScript: KeywordChat hatası yok

## Self-Check: PASSED
