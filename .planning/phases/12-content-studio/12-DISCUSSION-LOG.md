# Phase 12: Content Studio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 12-content-studio
**Areas discussed:** Erişim Noktası, Paralel Üretim, Bölüm Context Injection, HTML Çıktı Deposu

---

## Erişim Noktası

| Option | Description | Selected |
|--------|-------------|----------|
| Ayrı route (Recommended) | `/projeler/[id]/icerik-studio/[pageId]` — tam sayfa, breadcrumb ile geri dönüş | ✓ |
| PagePackageEditor'da yeni sekme | Schema sekmesi gibi "İçerik" sekmesi eklenir | |
| Page listesinden modal | Full-screen modal | |

**User's choice:** Ayrı route

---

### Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Page listesinde (Recommended) | Locked paketlerde "İçerik Üret" butonu satırda görünür | ✓ |
| PagePackageEditor içinde | Editörden link | |
| İkisinden de | Hem listede hem editörde | |

**User's choice:** Page listesinde, sadece locked paketler

---

## Paralel Üretim

Kullanıcı kendi mesajıyla bu kararı bildirdi:

**User's choice:** Paralel + tek tek de üretme — "Tümünü Üret" toplu paralel başlatır; her kartın kendi "Yeniden Üret" butonu var

---

## Bölüm Context Injection

| Option | Description | Selected |
|--------|-------------|----------|
| Sayfa paketi + tüm başlıklar + önceki bölümler (Recommended) | En yüksek içerik bütünlüğü | ✓ |
| Sayfa paketi + tüm başlıklar (sadece yapı) | Paralelde daha temiz | |
| Yalnızca mevcut H2 + temel sayfa bilgisi | Minimal, tekrar riski var | |

**User's choice:** Sayfa paketi + tüm başlıklar + önceki bölümler

### Paralel/Sequential Çelişkisi Çözümü

| Option | Description | Selected |
|--------|-------------|----------|
| Evet, mantıklı (Recommended) | Toplu üretimde paralel (no prior sections); tekil yeniden üretimde onaylılar dahil | ✓ |
| Hayır, toplu üretimde de sıralı olsun | Daha yavaş ama bölümler arası tutarlılık | |

**User's choice:** Evet, mantıklı — toplu üretim paralel+bağımsız, tekil yeniden üretim onaylılar dahil

---

## HTML Çıktı Deposu

| Option | Description | Selected |
|--------|-------------|----------|
| page_packages'ta yeni kolon (Recommended) | html_content TEXT, migration gerekli, temiz mimari | ✓ |
| content_blocks içinde özel key | Migration yok ama JSONB içinde gömülü | |
| Ayrı content_sections tablosu | Genişletilebilir ama aşırı mühendislik | |

**User's choice:** page_packages'ta yeni kolon

### Per-Section Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| content_sections JSONB + html_content TEXT (Recommended) | İki kolon: bölüm durumu persist edilir, sayfa yenilemesinde devam | ✓ |
| Yalnızca html_content, bölümler in-memory | İlerleme sayfa kapatılırsa kaybolur | |

**User's choice:** content_sections JSONB + html_content TEXT

---

## Claude's Discretion

- Content Studio route layout yapısı
- Bölüm kartı görsel tasarımı
- heading_hierarchy → section array parse mantığı
- Progress göstergesi formatı
- HTML birleştirme whitespace kuralları

## Deferred Ideas

- QA geçmiş log
- Bulk content (birden fazla sayfa)
- Ton kalibrasyonu
- Schema validation (Phase 11'den devredilen)
