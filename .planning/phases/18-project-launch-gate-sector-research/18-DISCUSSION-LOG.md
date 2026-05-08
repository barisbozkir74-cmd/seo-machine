# Phase 18: Project Launch Gate & Sector Research - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 18-project-launch-gate-sector-research
**Areas discussed:** Launch gate zorunlu alanlar, Research trigger mekanizması, Rapor çıktı formatı, "Projeyi Başlat" UI yerleşimi

---

## Launch Gate Zorunlu Alanlar

| Option | Description | Selected |
|--------|-------------|----------|
| Sector + rakipler + keywordler | SRCH-01 tanımına tam uyum: 3'ü de gerekli | ✓ |
| Sadece sector + rakipler | target_keywords Phase 19'da zorunlu olur | |
| Tüm proje bilgileri eksiksiz | name, domain, sector, main_goal, initial_competitors | |

**User's choice:** Sector + rakipler + keywordler — hepsi birden dolu olmalı

| Option | Description | Selected |
|--------|-------------|----------|
| Hepsi dolu olmalı | 3'ü de gerekli, aramanın anlamlı sorgular üretmesi için | ✓ |
| Sector zorunlu, diğerlerinden en az biri | Biraz daha esnek | |

**User's choice:** Hepsi dolu olmalı

---

## Research Trigger Mekanizması

| Option | Description | Selected |
|--------|-------------|----------|
| SerpAPI / Google Search API | Programatik Google arama, vault.ts pattern | ✓ |
| n8n workflow | n8n Phase 14'ten mevcut, ayrı entegrasyon gerekir | |
| Mevcut ScrapingBee / başka araç | Vault.ts + Edge Function pattern | |

**User's choice:** SerpAPI / Google Search API

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js API route | /api/research/trigger, mevcut DataForSEO pattern'iyle aynı | ✓ |
| Supabase Edge Function | Daha izole ama ek deployment karmaşıklığı | |

**User's choice:** Next.js API route

| Option | Description | Selected |
|--------|-------------|----------|
| Loading spinner + poll | Basit, mevcut pattern'e uygun | ✓ |
| Server-Sent Events (SSE) | Canlı progress bar, daha iyi UX ama SSE implementasyonu | |

**User's choice:** Loading spinner + poll

---

## Rapor Çıktı Formatı

| Option | Description | Selected |
|--------|-------------|----------|
| Mevcut manuel tabloları doldurur | AI research_reports bölümlerine yazar, kullanıcı düzenler | ✓ |
| Ayrı AI rapor bölümü | /arastirma'da yeni "AI Rapor" sekmesi | |
| Hem AI hem manuel ayrı ayrı | En esnek ama en karmaşık | |

**User's choice:** Mevcut manuel tabloları doldurur

| Option | Description | Selected |
|--------|-------------|----------|
| Evet, yeniden araştır butonu | /arastirma sayfasında "Yeniden Araştır" | ✓ |
| Hayır, bir kez çalışır | Manuel düzenleme yeterli | |

**User's choice:** Evet, yeniden araştır butonu olsun

---

## "Projeyi Başlat" UI Yerleşimi

| Option | Description | Selected |
|--------|-------------|----------|
| Proje bilgileri section'da | ProjectInfoSection altında, inline hint | ✓ |
| Proje header'da sabit | Her zaman görünür, tooltip ile eksik alanlar | |
| Dedicated launch section | Ayrı card/section, tamamlanma durumu listesi | |

**User's choice:** Proje bilgileri section'da

| Option | Description | Selected |
|--------|-------------|----------|
| Aynı gate, aynı buton (WP import) | Import sonrası aynı logic, kullanıcı tetikler | ✓ |
| WP import'tan sonra otomatik | Import tamamlanınca sistem otomatik başlatır | |

**User's choice:** Aynı gate, aynı buton — manuel tetikleme

| Option | Description | Selected |
|--------|-------------|----------|
| Aynı sayfada kal, rapor /arastirma'da | Loading → "Görüntüle" linki | ✓ |
| Otomatik /arastirma'ya yönlendir | Tetikleme anında sayfaya geçilir | |

**User's choice:** Aynı sayfada kal, tamamlanınca link göster

---

## Claude's Discretion

- SerpAPI sorgu stratejisi (kaç sorgu, kombinasyonlar)
- `research_reports` AI satırlarına flag eklenmeli mi
- Araştırma durumunun DB'de nerede saklanacağı
- ProjectInfoSection'da araştırma durumu gösterme detayı

## Deferred Ideas

- SSE ile canlı araştırma progress bar
- Araştırma geçmişi / versiyon kayıtları
- Rapor PDF export
