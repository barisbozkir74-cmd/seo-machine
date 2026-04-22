---
phase: 3
slug: rules-engine
status: draft
shadcn_initialized: true
preset: base-mira
created: 2026-04-22
---

# Phase 3 — UI Design Contract: Rules Engine

> Visual ve interaction contract. gsd-ui-researcher tarafından üretildi, gsd-ui-checker tarafından doğrulanacak.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui v4 | components.json |
| Preset | base-mira | components.json |
| Component library | @base-ui/react | components.json / globals.css |
| Icon library | hugeicons (@hugeicons/core-free-icons) | components.json |
| Font | Geist Sans (--font-sans) | globals.css |
| Base color | slate | components.json |
| Color mode | Dark (html className="dark") enforced | STATE.md decision |

shadcn gate: `components.json` bulundu. Mevcut bileşenler: badge, button, card, dialog, form, input, label, separator, table, textarea. Bu fazda eklenmesi gereken: `npx shadcn add switch`.

---

## Spacing Scale

8-point grid temel alınır. Tüm değerler 4'ün katı olmalıdır.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon–label gap, badge iç padding |
| sm | 8px | Toggle ile label arası boşluk, satır içi spacing |
| md | 16px | Tablo hücre padding (px), kart iç padding |
| lg | 24px | Sayfa başlığı ile tablo arası boşluk |
| xl | 32px | Sayfa p-8 (padding: 32px) — mevcut Phase 2 pattern |
| 2xl | 48px | Büyük bölüm ayracı |
| 3xl | 64px | Sayfa seviyesi boşluk (kullanım: minimal) |

Exceptions:
- Toggle/Switch minimum dokunma alanı: 44px yükseklik (WCAG 2.5.5) — Switch bileşeni kendi wrapper'ı ile sağlar
- Sol sidebar genişliği: 256px (w-64) — Phase 2 pattern'ından devam

---

## Typography

Phase 2 mevcut tipografi pattern'ından devam edilir. Geist Sans fontu.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px (text-sm) | 400 (normal) | 1.5 | Kural etiketi, açıklama metni, "Önerilen" ipucu |
| Label | 12px (text-xs) | 400 (normal) | 1.4 | Kategori başlığı (uppercase), badge metni, muted helper |
| Heading | 20px (text-xl) | 600 (semibold) | 1.2 | Sayfa başlığı (h1) |
| Sub-heading | 16px (text-base) | 600 (semibold) | 1.3 | Kategori bölüm başlığı (h2) |

Kurallar:
- Sadece 2 font weight kullanılır: 400 (normal) ve 600 (semibold)
- Kategori başlıkları: `text-xs font-normal uppercase text-muted-foreground` — Phase 2 pattern ile tutarlı
- "Önerilen: Açık/Kapalı" metni: `text-xs text-muted-foreground` — satır altında veya inline olarak

---

## Color

globals.css dark mode değerlerinden türetilir. Tüm renkler CSS custom property üzerinden kullanılır — hardcoded hex yasak (Phase 2 badge atamaları hariç, scope badge'leri için aşağıdaki istisnalar geçerlidir).

| Role | CSS Variable | Dark Value | Usage | Yüzde |
|------|-------------|------------|-------|-------|
| Dominant | --background | #020817 (Slate 950) | Sayfa arka planı, tablo satır zemini | 60% |
| Secondary | --card / --sidebar | #0f172a (Slate 900) | Kart arka planı, sol sidebar, kategori section arka planı | 30% |
| Accent | --primary | #f8fafc (Slate 50) | Yalnızca aşağıda listelenen elementler | 10% |
| Destructive | --destructive | #ef4444 (Red 500) | Override sıfırlama (✕ butonu hover), hata toast |

**Accent (#f8fafc / --primary) yalnızca şu elementler için rezerve edilmiştir:**
- Aktif/enabled Toggle Switch — filled state (shadcn Switch bileşeninin checked rengi)
- "Proje Kuralları" navigasyon linkinin aktif durumu

**Scope Badge renk atamaları (Phase 2 pattern — className ile direkt, variant prop kullanılmaz):**
- `[Global]` badge: `bg-slate-500/20 text-slate-400 border border-slate-500/30` (muted, tarafsız)
- `[Proje]` badge: `bg-blue-500/20 text-blue-400 border border-blue-500/30` (override vurgusu)
- `[Proje] ✕` reset butonu (badge içinde): `text-blue-400 hover:text-red-400` — hover'da destructive renk geçişi

**Önerilen değer uyumu göstergesi:**
- Kural değeri önerilen değere eşit ise: `text-muted-foreground` ipucu metni (nötr)
- Kural değeri önerilen değerden farklı ise: `text-amber-400` ipucu metni (sapma uyarısı)

---

## Component Inventory

Bu fazda kullanılan bileşenler:

| Bileşen | Kaynak | Durum | Kullanım |
|---------|--------|-------|---------|
| Switch | shadcn official | YOK — `npx shadcn add switch` gerekli | Her kural satırında toggle |
| Badge | src/components/ui/badge.tsx | Mevcut | Scope gösterimi ([Global] / [Proje]) |
| Table | src/components/ui/table.tsx | Mevcut | Kural listesi |
| Separator | src/components/ui/separator.tsx | Mevcut | Sol sütun Proje Kuralları linki öncesi |
| Button | src/components/ui/button.tsx | Mevcut | Override sıfırlama (✕ ghost variant) |

---

## Page Structure

### Sayfa 1: `/ayarlar/kurallar` — Global Kural Ayarları

```
┌─────────────────────────────────────────────────────┐
│  p-8                                                │
│  h1: "Global SEO Kuralları"        text-xl semibold │
│  p: "Tüm projeler için varsayılan kural seti."      │
│     text-sm text-muted-foreground mt-1             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ SEO TITLE                text-xs uppercase  │   │
│  │─────────────────────────────────────────────│   │
│  │ [Kural etiketi]  [Önerilen ipucu]  [Toggle] │   │
│  │ [Kural etiketi]  [Önerilen ipucu]  [Toggle] │   │
│  │ [Kural etiketi]  [Önerilen ipucu]  [Toggle] │   │
│  │─────────────────────────────────────────────│   │
│  │ H1                       text-xs uppercase  │   │
│  │─────────────────────────────────────────────│   │
│  │ [Kural etiketi]  [Önerilen ipucu]  [Toggle] │   │
│  │ ...                                         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Layout: Tek sütun, tam genişlik tablo. Sayfa başlığı + açıklama + 4 kategori bölümü (her biri kendi başlığıyla).

### Sayfa 2: `/projeler/[id]/kurallar` — Proje Bazlı Kural Override'ları

Phase 2 proje detay sayfasının 2 sütunlu layout'una (`w-64 sol | flex-1 sağ`) uyar:
- Sol sütun: Mevcut Stage listesi + Separator + "Proje Kuralları" nav linki eklenir
- Sağ sütun: Global kurallar sayfası ile aynı tablo yapısı, ancak her satırda [Global] veya [Proje] badge'i eklenir

### Tablo Satır Anatomy (her kural için):

```
┌────────────────────────────────────────────────────────────────┐
│  [Badge: Global/Proje]  Kural Etiketi       [Önerilen ipucu]  [Toggle] │
└────────────────────────────────────────────────────────────────┘
```

- Sütun 1 (w-24): Scope badge — `[Global]` veya `[Proje] ✕`
- Sütun 2 (flex-1): Kural etiketi — `text-sm`
- Sütun 3 (w-48): "Önerilen: Açık" veya "Önerilen: Kapalı" — `text-xs text-muted-foreground` (fark varsa `text-amber-400`)
- Sütun 4 (w-16): Switch toggle — sağa hizalı

---

## Interaction Contract

### Toggle — Anında Kayıt (D-05, D-06)

1. Kullanıcı Toggle'a tıklar
2. Toggle `disabled` + `opacity-50` durumuna geçer (loading state)
3. Server Action tetiklenir (toggleRule)
4. Başarı: `revalidatePath()` — sayfa yeni değerle yüklenir, toggle normal duruma döner
5. Hata: Toast mesajı sağ alt köşede görünür, toggle önceki değerine döner

Loading state implementasyonu: `useTransition()` hook ile `isPending` flag'i Toggle'ı disable eder.

### Override Sıfırlama — ✕ Butonu (D-07, D-08)

1. `[Proje] ✕` badge'indeki ✕ tıklanır
2. Onay dialogu YOK — anlık silme (override silmek yıkıcı değil, global'e dönüş)
3. Server Action: `rules` tablosundan proje bazlı satır DELETE edilir
4. `revalidatePath()` — satır [Global] badge'ine döner, toggle global değeri gösterir

### Navigasyon Değişiklikleri

- Dashboard üst nav'a "Ayarlar" linki eklenir → `/ayarlar/kurallar`
- `/ayarlar/kurallar` sayfasında "← Dashboard" breadcrumb linki (Phase 2 pattern)
- `/projeler/[id]/kurallar` sol sütununa: `<Separator />` + `<Link>Proje Kuralları</Link>` (Phase 2 sol sütun pattern'ı)

---

## Copywriting Contract

Tüm metinler Türkçe. Kural etiketleri CONTEXT.md D-01'den alınır.

| Element | Copy |
|---------|------|
| Global kurallar sayfa başlığı | "Global SEO Kuralları" |
| Global kurallar sayfa açıklaması | "Tüm projeler için varsayılan kural seti. Proje bazlı override yapılmayan kurallar bu değerleri kullanır." |
| Proje kuralları sayfa başlığı | "Proje Kuralları" |
| Proje kuralları sayfa açıklaması | "Bu projeye özel kural override'ları. Override yapılmayan kurallar global ayarları kullanır." |
| Sol sütun nav linki | "Proje Kuralları" |
| Üst nav linki | "Ayarlar" |
| Toggle loading metni | (görünür metin yok — opacity/disabled ile gösterilir) |
| Önerilen değer — uyumlu | "Önerilen: Açık" veya "Önerilen: Kapalı" (text-muted-foreground) |
| Önerilen değer — sapma | "Önerilen: Açık" veya "Önerilen: Kapalı" (text-amber-400) |
| Scope badge — global | "Global" |
| Scope badge — proje override | "Proje" |
| Override sıfırlama tooltip | "Global'e döndür" (✕ butonu title attribute) |
| Boş durum (küresel kurallar henüz seed edilmemişse) | "Kurallar yükleniyor..." (beklenmez — seed işlemi sayfa render'ında yapılır) |
| Hata toast başlığı | "Kural güncellenemedi" |
| Hata toast açıklaması | "Bir sorun oluştu. Lütfen tekrar deneyin." |
| Kategori başlıkları | "SEO Title" / "H1" / "Slug" / "Meta Description" |

**Kural etiketleri (D-01'den):**

| rule_key | Tablo Etiketi |
|----------|--------------|
| title_starts_with_keyword | SEO title focus keyword ile başlamalı |
| title_max_length_enforced | Max 60 karakter sınırı zorunlu |
| title_includes_brand | SEO title marka adıyla bitmeli |
| h1_exact_match | H1 focus keyword exact match olmalı |
| h1_single_per_page | Sayfada yalnızca 1 adet H1 kullanılmalı |
| h1_includes_keyword | H1 focus keyword içermeli |
| slug_exact_match | Slug focus keyword exact match olmalı |
| slug_lowercase_hyphen | Slug küçük harf + tire zorunlu, noktalama yasak |
| slug_no_stopwords | Slug'dan Türkçe stopword çıkarılmalı |
| meta_desc_required | Meta description zorunlu |
| meta_desc_includes_keyword | Meta desc focus keyword içermeli |
| meta_desc_length_enforced | 120–160 karakter aralığı zorunlu |

**Önerilen değer metinleri (D-01 "Önerilen" sütunundan):**

| rule_key | Önerilen metin |
|----------|---------------|
| title_starts_with_keyword | Önerilen: Açık |
| title_max_length_enforced | Önerilen: Açık |
| title_includes_brand | Önerilen: Kapalı |
| h1_exact_match | Önerilen: Kapalı |
| h1_single_per_page | Önerilen: Açık |
| h1_includes_keyword | Önerilen: Açık |
| slug_exact_match | Önerilen: Kapalı |
| slug_lowercase_hyphen | Önerilen: Açık |
| slug_no_stopwords | Önerilen: Kapalı |
| meta_desc_required | Önerilen: Açık |
| meta_desc_includes_keyword | Önerilen: Açık |
| meta_desc_length_enforced | Önerilen: Açık |

---

## State Definitions

Her kural satırı için tanımlı durumlar:

| Durum | Görünüm |
|-------|---------|
| Global kural — enabled | Toggle açık (checked), [Global] badge (slate), önerilen metni nötr veya amber |
| Global kural — disabled | Toggle kapalı (unchecked), [Global] badge (slate) |
| Proje override — enabled | Toggle açık, [Proje] badge (blue) + ✕ ghost butonu |
| Proje override — disabled | Toggle kapalı, [Proje] badge (blue) + ✕ ghost butonu |
| Loading (geçiş) | Toggle disabled + opacity-50, cursor-wait |
| Hata | Toggle önceki değere döner + toast sağ alt köşe |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | switch | not required |

Üçüncü taraf registry yok. `components.json` → `"registries": {}` ile doğrulandı (2026-04-22).

---

## Pre-Population Sources

| Alan | Kaynak | Karar Sayısı |
|------|--------|-------------|
| 12 kural içeriği ve önerilen değerler | CONTEXT.md D-01 | 12 kural × 2 alan = 24 |
| Sayfa yapısı ve routing | CONTEXT.md D-02, D-03, D-04 | 3 |
| Toggle inline kayıt pattern | CONTEXT.md D-05, D-06 | 2 |
| Badge sistemi ve inheritance | CONTEXT.md D-07, D-08, D-09 | 3 |
| Dark theme, slate palette | globals.css (Phase 1 artefakt) | token seti |
| 2 sütunlu layout pattern | STATE.md + projeler/[id]/page.tsx | 1 |
| Badge className pattern | STATE.md karar notu | 1 |
| Font, icon library | components.json | 2 |
| Mevcut bileşen envanteri | src/components/ui/ | 10 bileşen |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
