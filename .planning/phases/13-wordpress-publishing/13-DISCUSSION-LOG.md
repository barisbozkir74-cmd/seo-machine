---
phase: 13-wordpress-publishing
type: discussion-log
created: "2026-04-26T00:00:00Z"
gray_areas_total: 4
gray_areas_resolved: 4
---

# Phase 13: WordPress Publishing — Discussion Log

**Date:** 2026-04-26
**Participants:** Baris (user), Claude (assistant)

---

## Gray Area 1: Kimlik Bilgisi UI'ı

**Soru:** WordPress URL ve Application Password formu nerede olsun?

**Seçenekler sunuldu:**
- Proje detay sayfasında (Recommended) — ProjectInfoSection pattern'ini genişlet
- Ayarlar sayfasında (/projeler/[id]/ayarlar) — izole, ama ek route
- Ayrı WP bağlantısı sayfası — en ayrıştırılmış, ama en fazla gezinme

**Kullanıcı kararı:** Proje detay sayfasında — yeni "WordPress Bağlantısı" bölümü

**Karar rationale:** Mevcut ProjectInfoSection pattern'ini genişletmek en düşük yeni route maliyeti. Proje başına tek site, proje sayfasında görmek mantıklı.

---

## Gray Area 2: Gönderim Akışı

**Soru:** "WordPress'e Gönder" butonu nerede görünür?

**Seçenekler sunuldu:**
- Content Studio'da — HtmlReadyBanner yanında, html_content hazır olunca (Recommended)
- Sayfa Paketi editöründe — html_content dolu locked paketlerde
- Her ikisinde — çift entry point, iki bakım maliyeti

**Kullanıcı kararı:** Content Studio'da — HtmlReadyBanner yanında

**Karar rationale:** html_content tüm bölümler onaylandığında Content Studio'da oluşuyor. Aynı sayfada "Gönder" butonu en doğal UX. Sayfa Paketi editöründe tekrar gerekmez.

---

## Gray Area 3: WP Meta & SEO Plugin

**Soru:** WordPress'e gönderirken Yoast/RankMath meta verileri nasıl yönetilsin?

**Seçenekler sunuldu:**
- REST API meta alanları, plugin algılanarak (Recommended) — Yoast veya RankMath otomatik tespit
- Sadece title+content — meta yok, WordPress'te manuel tamamlanır
- Yoast zorunlu, RankMath hayır — tek plugin desteği

**Kullanıcı kararı:** REST API meta alanları, plugin algılanarak

**Karar rationale:** meta_description ve schema_jsonld zaten page_packages'ta var. Plugin algılayarak doğru anahtarlara yazmak çok az ek maliyet, tam değer. Her iki büyük SEO plugin'ini desteklemek gerekiyor.

---

## Gray Area 4: Zamanlama UX

**Soru:** WordPress gönderiminde zamanlama nasıl çalışsın?

**Seçenekler sunuldu:**
- Hemen Yayınla + Taslak seçeneği (Recommended) — 2 radio, tarih picker yok
- Date/time picker ile zamanlama — WP future status, daha karmaşık
- Sadece Draft — her zaman taslak, WP'den manuel yayınla

**Kullanıcı kararı:** Hemen Yayınla + Taslak (2 seçenek, tarih picker yok)

**Karar rationale:** Zamanlama, faz kapsamını gereksiz genişletir. "Hemen Yayınla" veya "Taslak" — iki net seçenek, WP'de manuel zamanlama yapılabilir.

---

## Carry-Forward (Pre-decided)

Bu kararlar STATE.md'de önceden verilmiş, tartışmaya açılmadı:

- **WP credentials storage:** Supabase Vault — `wp_url_{id}`, `wp_app_password_{id}` — vault.ts server-only pattern zaten var
- **n8n:** Bu fazda yok — Phase 16'ya ertelendi

---

## Final Decision Summary

| # | Alan | Karar |
|---|------|-------|
| D-01 | Kimlik bilgisi UI'ı | Proje detay sayfası — "WordPress Bağlantısı" bölümü |
| D-02 | Gönderim akışı | Content Studio HtmlReadyBanner'da |
| D-03 | WP meta & SEO | REST API meta, plugin algılanarak (Yoast + RankMath) |
| D-04 | Zamanlama | Hemen Yayınla / Taslak — 2 seçenek, picker yok |
