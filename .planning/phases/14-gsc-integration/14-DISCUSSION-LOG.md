# Phase 14: GSC Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 14-gsc-integration
**Areas discussed:** OAuth akışı, Property seçimi, Index durumu gösterimi, Performans verisi sync

---

## OAuth Akışı

| Option | Description | Selected |
|--------|-------------|----------|
| API route + server action | /api/gsc/callback route — Google, kodla bu endpoint'e döner; server action token'ları Supabase'e yazar | ✓ |
| n8n OAuth exchange | n8n workflow Google OAuth'u handle eder, token'ları Supabase'e yazar | |
| NextAuth.js Google provider | NextAuth konfigürasyona Google provider eklenir | |

**User's choice:** API route + server action
**Notes:** WordPress flow'uyla tutarlı, n8n gerektirmez

---

## OAuth State & Token Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| State cookie + otomatik refresh | OAuth state'i HttpOnly cookie'de tut (CSRF koruması); access token expire olunca refresh_token ile otomatik yenile | ✓ |
| State sessionStorage + manuel refresh | State client-side sessionStorage'da; kullanıcı 'Yeniden Bağla' butonuyla tetikler | |
| Sen karar ver | Security best practice'i Claude seçsin | |

**User's choice:** State cookie + otomatik refresh

---

## Property Seçimi

| Option | Description | Selected |
|--------|-------------|----------|
| OAuth callback'ten sonra dropdown | Callback tamamlanınca proje sayfasına yönlendir; inline dropdown ile property listesi | ✓ |
| OAuth sırasında Google UI'dan seç | Scope'a site verification dahil — kullanıcı Google ekranında seçer | |
| Manuel giriş | Kullanıcı property URL'sini text input'la girer | |

**User's choice:** OAuth callback'ten sonra dropdown

---

## Property Konumu

| Option | Description | Selected |
|--------|-------------|----------|
| Proje detay sayfasına bölüm | WordPress seçimiyle aynı pattern — GscConnectionSection | ✓ |
| Ayrı /gsc ayarları sayfası | Proje altında /projeler/[id]/gsc rotası | |

**User's choice:** Proje detay sayfasına bölüm

---

## Index Durumu Görünüm Kapsamı

| Option | Description | Selected |
|--------|-------------|----------|
| Her ikisinde de | Sayfa Paketi listesinde badge + İçerik Studio'da badge | ✓ |
| Sadece İçerik Studio | Sayfa yayınlandıktan sonra başlıkta | |
| Sadece Sayfa Paketi listesi | Sol panel listesinde badge | |

**User's choice:** Her ikisinde de

---

## Index Güncelleme Tetikleyicisi

| Option | Description | Selected |
|--------|-------------|----------|
| Manuel 'Kontrol Et' butonu | İçerik Studio'da buton → server action → GSC URL Inspection API | ✓ |
| Yayın sonrası otomatik | publishToWordPress action'dan hemen sonra tetiklenir | |
| n8n günlük schedule | Performans sync ile aynı workflow'a eklenir | |

**User's choice:** Manuel 'Kontrol Et' butonu
**Notes:** API limit kontrolü kullanıcıda

---

## Performans Verisi Sync Yöntemi

| Option | Description | Selected |
|--------|-------------|----------|
| n8n günlük schedule | Sadece otomatik gece sync | |
| Manuel 'Senkronize Et' + n8n schedule | n8n günlük + kullanıcı manuel tetikleyebilir | ✓ |
| Sadece manuel | n8n kurulumu ertelenir | |

**User's choice:** Manuel 'Senkronize Et' + n8n schedule

---

## Metrics Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Yeni gsc_metrics tablosu | page_id + date + keyword + clicks + impressions + avg_position — zaman serisi | ✓ |
| page_packages JSONB | Mevcut tabloya ekle — Phase 15 için zayıf | |

**User's choice:** Yeni gsc_metrics tablosu

---

## n8n Deployment

| Option | Description | Selected |
|--------|-------------|----------|
| n8n cloud + Supabase REST | n8n cloud hosted | |
| Self-hosted n8n + Supabase | Mevcut self-hosted instance'a yeni workflow | ✓ |

**User's choice:** Self-hosted n8n + Supabase
**Notes:** Mevcut instance, ayrı kurulum gerekmez

---

## Claude'un Kararına Bırakılanlar

- n8n'in GSC token'a erişim yöntemi (direkt Supabase vs. Next.js sync endpoint)
- gsc_metrics tablo index'leri
- "Senkronize Et" butonunun tam konumu

## Deferred Ideas

- Monitoring dashboard (Phase 15)
- GSC ile keyword opportunity score güncelleme (Phase 17)
- IndexNow / GSC Request Indexing (ileride tartışılabilir)
