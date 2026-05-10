---
phase: 21
date: 2026-05-10
status: complete
---

# Phase 21 — Discussion Log

## Gray Areas Presented

**Q1: "Sistemi Kur" butonu nerede görünmeli?**
Options: Proje ana sayfası / Keyword stratejisi sayfası / Site Blueprint sayfası
→ **Seçim: Keyword stratejisi sayfası**

**Q2: "Sistemi Kur" nasıl çalışmalı?**
Options: Tek tıkla otomatik / Onay dialog'u ile
→ **Seçim: Onay dialog'u ile** (GeneratePagesDialog, sadece approved cluster'lar)

**Q3: Mevcut sayfa varsa ne yapmalı?**
Options: Cluster'ı atla / Kullanıcıya sor
→ **Seçim: Kullanıcıya sor** (dialog'da interaktif toggle)

**Q4: "Üzerine yaz" seçilince ne olmalı?**
Options: Mevcut sayfayı güncelle / Sil ve yeniden oluştur
→ **Seçim: Mevcut sayfayı güncelle** (title, page_type, focus_keyword_id UPDATE)

**Q5: Tamamlandıktan sonra nereye git?**
Options: Blueprint sayfasına yönlendir / Sayfada kal
→ **Seçim: Blueprint sayfasına yönlendir** (router.push)

## Key Technical Clarifications

- `GeneratePagesDialog` reused (not duplicated) — imported from site-blueprint module
- `approvedDialogRows` computed in SSR page.tsx, passed as prop to toolbar
- Small extra query in keyword-stratejisi/page.tsx to detect alreadyExists (cluster_id in pages)
- `intentToPageType` imported from site-blueprint/page-utils.ts
- Blueprint page's "Kümelerden Oluştur" untouched (manual fallback flow)
