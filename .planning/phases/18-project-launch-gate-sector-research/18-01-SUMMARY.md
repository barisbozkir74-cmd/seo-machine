---
phase: 18
plan: 01
subsystem: research-pipeline
tags: [servis-katmanı, serpapi, claude, vault, araştırma]
dependency_graph:
  requires:
    - supabase/research_reports table (Phase 16 schema)
    - vault.ts (mevcut)
    - @anthropic-ai/sdk (package.json)
  provides:
    - getSerpApiKey() — vault.ts
    - runSectorResearch() — src/lib/research/sector-research.ts
  affects:
    - 18-02-PLAN (API route bu servisi çağırır)
    - 18-03-PLAN (UI bu API route'u tetikler)
tech_stack:
  added:
    - "@anthropic-ai/sdk ^0.91.0 (worktree package.json'a eklendi)"
  patterns:
    - "env var önce, vault fallback (DataForSEO pattern'iyle aynı)"
    - "sıralı SerpAPI çağrıları (rate limit koruması)"
    - "Claude JSON parse try/catch guard"
key_files:
  created:
    - src/lib/research/sector-research.ts
  modified:
    - src/lib/supabase/vault.ts
    - package.json
decisions:
  - "SerpAPI vault pattern: vault.decrypted_secrets tablosu doğrudan sorgulandı (getDataForSeoCredentials ile aynı pattern) — RPC yerine tablo okuma daha basit ve kanıtlanmış"
  - "Sıralı SerpAPI çağrıları: rate limit riski nedeniyle paralel değil sıralı; T-18-04 mitigasyonu"
  - "JSON parse: code fence (```json) + raw brace pattern cascade — Claude bazen code block döndürür"
metrics:
  duration: "~15 dakika"
  completed: "2026-05-08T09:03:53Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
requirements:
  - SRCH-01
  - SRCH-02
---

# Phase 18 Plan 01: SerpAPI Vault + Sector Research Pipeline Summary

**One-liner:** SerpAPI key yönetimi vault.ts'e eklendi ve sector-research.ts ile tam araştırma pipeline'ı (SerpAPI sorguları → claude-sonnet-4-6 analiz → research_reports upsert) oluşturuldu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | vault.ts — getSerpApiKey() ekle | 23d5f68 | src/lib/supabase/vault.ts |
| 2 | sector-research.ts oluştur | a98d54c | src/lib/research/sector-research.ts, package.json |

## Implementation Summary

### Task 1: getSerpApiKey() — vault.ts

`getSerpApiKey(): Promise<string>` fonksiyonu `getDataForSeoCredentials()` ile identik pattern'i takip eder:
- `process.env.SERPAPI_KEY` varsa anında döner (env var önce)
- Yoksa `vault.decrypted_secrets` tablosundan `serpapi_key` adlı kaydı okur
- Eksikse açıklayıcı hata fırlatır: `SERPAPI_KEY env var olarak .env.local dosyasına ekleyin.`

Güvenlik: `import 'server-only'` ile client bundle'a sızmaz (T-18-01, T-18-02).

### Task 2: sector-research.ts — Full Pipeline

`src/lib/research/sector-research.ts` dosyası 5 bölümden oluşuyor:

**buildSearchQueries(input):**
- Sektör genel sorgusu: `"${sector} sektörü pazar analizi"`
- Her rakip için (max 3): `"${competitor} SEO içerik stratejisi"`
- Her keyword için (max 2): `"${keyword} rakip analiz"`
- Genel fırsat sorgusu: `"${sector} içerik boşluğu fırsatları SEO"`
- Toplam max 7 sorgu

**fetchSerpResults(query, serpApiKey):**
- `https://serpapi.com/search.json?hl=tr&gl=tr&num=10` sorgusu
- 10 saniye timeout (T-18-04 rate limit koruması)
- organic_results'tan title + snippet + link

**analyzeWithClaude(serpResults, input):**
- Model: `claude-sonnet-4-6`, max_tokens: 4000
- Türkçe prompt, 5 bölümlü JSON çıktısı
- JSON parse: code fence → raw brace cascade (T-18-03 güvenli parse)

**saveReport(report, input):**
- 5 bölüm sırayla `research_reports.upsert()` ile yazılır
- `onConflict: 'project_id,section'` — replace semantiği

**runSectorResearch(input):**
- Ana export; adımları sırayla çalıştırır
- Hata durumunda throw — çağıran route katmanı yönetir (D-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker Fix] @anthropic-ai/sdk worktree package.json'da eksik**
- **Found during:** Task 2 başlangıcı
- **Issue:** Worktree'deki package.json ana repo'dan bağımsız kopyalanmış; `@anthropic-ai/sdk ^0.91.0` eksikti
- **Fix:** package.json'a `@anthropic-ai/sdk: "^0.91.0"` eklendi (ana repo'daki versiyon ile eşleştirildi)
- **Files modified:** package.json
- **Commit:** a98d54c

**2. [Rule 1 - Pattern] Vault okuma: vault.decrypted_secrets tablo sorgusu (RPC değil)**
- **Found during:** Task 1 — Plana göre `vault_get_secrets` RPC kullanılması belirtilmişti
- **Issue:** Mevcut `getDataForSeoCredentials()` RPC yerine `vault.decrypted_secrets` tablosunu doğrudan okuyordu
- **Fix:** Mevcut pattern'e uygun olarak `vault.decrypted_secrets` tablo sorgusu kullanıldı; tutarlılık korundu
- **Files modified:** src/lib/supabase/vault.ts

## Known Stubs

None.

## Threat Flags

Plan'daki threat model tamamen uygulandı; yeni güvenlik yüzeyi açılmadı:
- T-18-01/T-18-02: `import 'server-only'` ile korunuyor
- T-18-03: JSON parse try/catch mevcut
- T-18-04: Sıralı sorgular + 10s timeout uygulandı
- T-18-05: Accept kararı doğrultusunda serviceClient sadece araştırma pipeline'ında kullanılıyor

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/supabase/vault.ts exists | FOUND |
| src/lib/research/sector-research.ts exists | FOUND |
| 18-01-SUMMARY.md exists | FOUND |
| commit 23d5f68 (vault.ts) | FOUND |
| commit a98d54c (sector-research.ts) | FOUND |
