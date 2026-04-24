---
phase: 5
slug: keyword-import-enrichment
status: draft
shadcn_initialized: true
preset: base-mira
created: 2026-04-24
---

# Phase 5 — UI Design Contract: Keyword Import & Enrichment

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
| Color mode | Dark (html className="dark") enforced | STATE.md karar notu |

shadcn gate: `components.json` bulundu. Mevcut bileşenler: alert-dialog, badge, button, card, dialog, form, input, label, separator, switch, table, textarea. Bu faz için ek bileşen kurulumu gerekmez — tüm bileşenler mevcut.

---

## Spacing Scale

8-point grid temel alınır. Tüm değerler 4'ün katı olmalıdır. Phase 3 pattern'ından devam.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon–label gap, badge iç padding, × butonu ile keyword arası |
| sm | 8px | Tablo hücre iç gap, satır içi spacing |
| md | 16px | Tablo hücre padding (px), section içi boşluk |
| lg | 24px | Sayfa başlığı ile içerik arası boşluk |
| xl | 32px | Sayfa p-8 (padding: 32px) — Phase 2 pattern'ından devam |
| 2xl | 48px | Büyük bölüm ayracı (import section ile tablo arası) |
| 3xl | 64px | Sayfa seviyesi boşluk (kullanım: minimal) |

Exceptions:
- × silme butonu minimum dokunma alanı: 28px × 28px (kompakt tablo satırı için kabul edilebilir — onay dialogu olmadığından kasıtlı hedefleme beklenir)
- Sol sidebar genişliği: 256px (w-64) — Phase 2 pattern'ından devam

---

## Typography

Phase 3 tipografi sistemi korunur. Geist Sans fontu.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px (text-sm) | 400 (normal) | 1.5 | Keyword metni, tablo hücre değerleri, açıklama metni |
| Label | 12px (text-xs) | 400 (normal) | 1.4 | Tablo başlıkları, badge metni, muted helper, format ipucu |
| Heading | 20px (text-xl) | 600 (semibold) | 1.2 | Sayfa başlığı h1: "Keyword Stratejisi" |
| Sub-heading | 16px (text-base) | 600 (semibold) | 1.3 | Bölüm başlıkları h2: "Keyword İçe Aktar", "Keyword Listesi" |

Kurallar:
- Sadece 2 font weight: 400 (normal) ve 600 (semibold)
- CPC sütunu: `text-sm font-medium text-right` — numeric değerler sağa hizalı, orta ağırlık
- Volume sütunu: `text-sm font-medium text-right` — Phase 2 mevcut pattern ile tutarlı
- KD sütunu: `text-sm text-right` — Phase 2 mevcut pattern ile tutarlı
- Enrichment bekleme durumundaki satır: `text-sm opacity-50` — içerik görünür ama soluk

---

## Color

globals.css dark mode değerlerinden türetilir. Tüm renkler CSS custom property üzerinden kullanılır — hardcoded hex yasak (intent badge renkleri aşağıda belirtilen istisnalar ile).

| Role | CSS Variable | Dark Value | Usage | Yüzde |
|------|-------------|------------|-------|-------|
| Dominant | --background | #020817 (Slate 950) | Sayfa arka planı, tablo satır zemini | 60% |
| Secondary | --card / --sidebar | #0f172a (Slate 900) | Tablo başlık satırı arka planı (bg-secondary/40), sol sidebar | 30% |
| Accent | --primary | #f8fafc (Slate 50) | Yalnızca aşağıda listelenen elementler | 10% |
| Destructive | --destructive | #ef4444 (Red 500) | × silme butonu hover rengi |

**Accent (#f8fafc / --primary) yalnızca şu elementler için rezerve edilmiştir:**
- "İçe Aktar" butonunun enabled durumu (primary variant)
- "Zenginleştir" / enrichment tetikleme butonu (eğer manuel tetikleme eklenirse)

**Intent Badge renk atamaları (CONTEXT.md specifics'ten — className ile direkt, variant prop kullanılmaz):**
- `Commercial` → `bg-blue-500/20 text-blue-400`
- `Informational` → `bg-emerald-500/20 text-emerald-400`
- `Navigational` → `bg-gray-500/20 text-gray-400`
- `Transactional` → `bg-orange-500/20 text-orange-400`
- `null / bilinmiyor` → `bg-slate-500/20 text-slate-400` (enrichment bekleniyor veya tespit edilemedi)

**Küme Badge renk ataması:**
- Küme badge'i: `bg-secondary text-muted-foreground text-xs` — nötr, küme adı gösterir

**KD (Keyword Difficulty) dot renkleri — Phase 2 mevcut pattern korunur:**
- KD < 30: `bg-emerald-400` (dot) + "Kolay" etiketi
- 30 ≤ KD ≤ 60: `bg-amber-400` (dot) + "Orta" etiketi
- KD > 60: `bg-red-400` (dot) + "Zor" etiketi

**× Silme Butonu:**
- Normal: `text-muted-foreground` (ghost, görünmez gibi)
- Hover: `text-destructive hover:bg-destructive/10`
- Satır hover'ında görünür olabilir: `opacity-0 group-hover:opacity-100 transition-opacity`

---

## Component Inventory

Bu fazda kullanılan bileşenler (tümü mevcut — ek kurulum gerekmez):

| Bileşen | Kaynak | Durum | Kullanım |
|---------|--------|-------|---------|
| Table, TableHeader, TableBody, TableRow, TableHead, TableCell | src/components/ui/table.tsx | Mevcut | Keyword düz tablo — yeni sütunlar ekleniyor |
| Badge | src/components/ui/badge.tsx | Mevcut | Intent badge + Küme badge |
| Button | src/components/ui/button.tsx | Mevcut | "İçe Aktar" CTA, × silme butonu (ghost variant) |
| Separator | src/components/ui/separator.tsx | Mevcut | Import section ile tablo arası ayraç |
| KeywordImport (mevcut) | keyword-stratejisi/KeywordImport.tsx | Mevcut — değişmez | textarea + "İçe Aktar" butonu |

Yeni oluşturulacak bileşenler:
| Bileşen | Neden Yeni |
|---------|-----------|
| `KeywordDeleteButton` (Client Component) | × butonu + Server Action, `useTransition` pattern |
| `IntentBadge` (saf fonksiyon veya inline) | Intent string → badge className mapping |
| `ClusterBadge` (inline veya küçük yardımcı) | Küme adı → badge gösterimi |

---

## Page Structure

### Sayfa: `/projeler/[id]/keyword-stratejisi`

Mevcut 2 sütunlu layout korunur ve genişletilir.

```
┌─────────────────────────────────────────────────────────────────────┐
│  p-8 pb-4                                                           │
│  ← [proje adı]          text-sm text-muted-foreground              │
│  h1: "Keyword Stratejisi"               text-xl font-semibold       │
│  p: [domain]            text-sm text-muted-foreground mt-1         │
├──────────────┬──────────────────────────────────────────────────────┤
│  w-64        │  flex-1 overflow-y-auto p-8 space-y-10              │
│  shrink-0    │                                                      │
│  border-r    │  [BÖLÜM 1] Keyword İçe Aktar                        │
│              │  ┌──────────────────────────────────────────────┐   │
│  ProjectNav  │  │  textarea (mevcut KeywordImport bileşeni)    │   │
│  (mevcut)    │  │  [İçe Aktar] butonu                         │   │
│              │  └──────────────────────────────────────────────┘   │
│              │                                                      │
│              │  <Separator />                                       │
│              │                                                      │
│              │  [BÖLÜM 2] Keyword Listesi                          │
│              │  N keyword · enrichment durumu özeti               │
│              │  ┌──────────────────────────────────────────────┐   │
│              │  │ Keyword │ Volume │ CPC │ KD │ Küme │ Intent │×│  │
│              │  │─────────────────────────────────────────────│   │
│              │  │ [row]   │ 74K   │$1.2 │ 22 │[küme]│[badge]│×│  │
│              │  │ [row]   │ opacity-50 + spinner (enriching)   │×│  │
│              │  └──────────────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────────────────┘
```

**Önemli mimari değişiklik:** Mevcut cluster-grouped tablo (küme başlıkları ile gruplama) yerine DÜZLEŞTIRILMIŞ tek tablo. Küme bilgisi "Küme" sütunundaki badge ile gösterilir.

### Tablo Sütun Anatomisi

| Sütun | Genişlik | Hizalama | İçerik |
|-------|----------|----------|--------|
| (×) | 40px shrink-0 | Sol | `KeywordDeleteButton` — ghost × butonu |
| Keyword | flex-1 | Sol | keyword metni, `text-sm` |
| Volume | 80px | Sağ | formatVolume(v) — "74K", "1.2M" formatı |
| CPC | 72px | Sağ | "$1.23" formatı, null ise "—" |
| KD | 64px | Sağ | sayı, null ise "—" |
| Küme | 120px | Sol | `<Badge className="bg-secondary text-muted-foreground text-xs">küme adı</Badge>` |
| Intent | 120px | Sol | `<IntentBadge>` — renkli badge |

### Tablo Başlık Satırı

`<TableRow className="bg-secondary/40">` — Phase 2 mevcut pattern ile tutarlı.

```
<TableHead className="text-xs w-10">  (× sütunu başlığı — boş)
<TableHead className="text-xs">Keyword
<TableHead className="text-xs text-right w-20">Volume
<TableHead className="text-xs text-right w-18">CPC
<TableHead className="text-xs text-right w-16">KD
<TableHead className="text-xs w-28">Küme
<TableHead className="text-xs w-28">Intent
```

### Boş Durum

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Henüz keyword eklenmemiş.                           │
│  Yukarıdan keyword listeni içe aktar.                │
│  text-sm text-muted-foreground py-8 text-center      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Enrichment Loading Durumu (satır bazında)

Her satır için:
- `enriched_at IS NULL` → satır `opacity-50` + sağ ucunda küçük spinner (16px, `animate-spin`, `text-muted-foreground`)
- Spinner konumu: Intent badge yerine veya Intent badge yanında
- Küme badge: `enriched_at IS NULL` olsa bile gösterilir (kümeleme import anında yapılır, enrichment bağımsız)

---

## Interaction Contract

### Import Akışı (D-01, D-04, D-05)

1. Kullanıcı textarea'ya text paste yapar
2. "İçe Aktar" butonuna tıklar
3. Buton `disabled` + "İşleniyor..." metni (mevcut `KeywordImport.tsx` pattern — değişmez)
4. Server Action sırasıyla: parse → kümeleme → DB INSERT → enrichment başlatma
5. Başarı: `"{N} keyword, {M} kümeye ayrıldı. Zenginleştirme başladı."` — `text-sm text-emerald-400`
6. Sayfa yenilenir (`revalidatePath`) — enrichment henüz tamamlanmamış satırlar `opacity-50` + spinner ile görünür
7. Hata: `text-sm text-destructive` — hata mesajı textarea altında

### Keyword Silme — × Butonu (D-12)

1. Kullanıcı satırdaki × butonuna tıklar
2. Onay dialogu YOK — anında silme
3. `KeywordDeleteButton`: `useTransition` ile loading state, × butonu `disabled` + `opacity-50` sırasında
4. Server Action: `keywords` tablosundan satır DELETE
5. `revalidatePath` — satır tablodan kaybolur
6. Eğer kümedeki son keyword siliniyorsa: küme de silinir (Server Action sorumluluğu — UI'a yansımaz, sadece küme badge'i kaybolur)

### Enrichment Loading State Yönetimi

- Enrichment sunucu tarafında çalışır (Edge Function veya Server Action batch)
- Sayfa ilk yüklendiğinde `enriched_at IS NULL` olan satırlar `opacity-50` + spinner gösterir
- Kullanıcı sayfayı yenileyince güncel durumu görür
- Otomatik polling YOKTUR — kullanıcı manuel yenileme yapar veya import sonrası `revalidatePath` tüm ekranı günceller

### Sıralama (D-13)

- Tablo volume'a göre azalan sırada gelir (DB sorgusu: `.order('volume', { ascending: false, nullsFirst: false })`)
- Kullanıcı tarafından sıralama değiştirme özelliği yok (Phase 5 scope dışı)

---

## Copywriting Contract

Tüm metinler Türkçe.

| Element | Copy |
|---------|------|
| Sayfa başlığı (h1) | "Keyword Stratejisi" |
| Bölüm başlığı 1 (h2) | "Keyword İçe Aktar" |
| Bölüm başlığı 2 (h2) | "Keyword Listesi" |
| Import açıklama metni | "Keyword listeni yapıştır — DataForSEO, Semrush, Ahrefs veya düz metin. Format: `keyword tab volume tab KD`" |
| Textarea placeholder | "Keyword listesini buraya yapıştır.\n\nFormat: keyword\tvolume\tKD\n\nÖrnek:\npergola\t74000\t22\naluminium pergola\t4400\t8" |
| Import CTA butonu (normal) | "İçe Aktar" |
| Import CTA butonu (loading) | "İşleniyor..." |
| Import başarı mesajı | "{N} keyword, {M} kümeye ayrıldı. Zenginleştirme başladı." |
| Import hata mesajı — genel | "İçe aktarma başarısız oldu. Lütfen tekrar deneyin." |
| Import hata — boş metin | "Keyword listesi boş." |
| Import hata — format hatası | "Geçersiz format. Her satır 'keyword tab volume tab KD' biçiminde olmalı." |
| Import hata — DataForSEO kotası | "DataForSEO kota sınırına ulaşıldı. Zenginleştirme daha sonra denenecek." |
| Boş durum başlığı | "Henüz keyword eklenmemiş." |
| Boş durum yönlendirme | "Yukarıdan keyword listeni içe aktar." |
| Keyword sayısı özeti | "{N} keyword · {M} küme" |
| Enrichment bekleme özeti | "{N} keyword zenginleştirme bekliyor" (tablo üstünde, bekleyen varsa) |
| × butonu title (tooltip) | "Keyword'ü sil" |
| KD etiketi — Kolay | "Kolay" |
| KD etiketi — Orta | "Orta" |
| KD etiketi — Zor | "Zor" |
| Intent — bilinmiyor | "—" (badge yerine tire) |
| Küme — atanmamış | "—" (badge yerine tire, olmaması gerekir ama savunma) |

**Destructive action — Keyword Silme:**
- Aksiyon: Tek × tıklaması
- Onay: YOK (D-12 kararı — onay dialogu overkill)
- Savunma: × butonu `opacity-0 group-hover:opacity-100` ile her zaman görünmez, kasıtlı hover gerektirir

---

## State Definitions

Her keyword satırı için tanımlı durumlar:

| Durum | Tetikleyici | Görünüm |
|-------|------------|---------|
| Normal — zenginleştirilmiş | `enriched_at IS NOT NULL` | Normal opacity, tüm sütunlar dolu |
| Bekleniyor — enrichment yok | `enriched_at IS NULL` | `opacity-50` + sağda 16px spinner |
| Silme loading | × tıklandı, action devam ediyor | × butonu `disabled opacity-50`, satır normal |
| Hover | Fare üzerinde | × butonu `opacity-100` olur, satır arka planı hafif highlight |
| CPC null | Enrichment tamamlandı ama CPC yok | "—" (bazı keywordlerde CPC DataForSEO'da boş gelir) |
| Intent null | Enrichment tamamlandı ama intent yok | "—" (tire, badge yok) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | (mevcut bileşenler — ek kurulum yok) | not required |

Üçüncü taraf registry yok. `components.json` → `"registries": {}` ile doğrulandı (2026-04-22).

---

## Pre-Population Sources

| Alan | Kaynak | Karar Sayısı |
|------|--------|-------------|
| Tablo sütun yapısı (D-09) | CONTEXT.md | 1 |
| Küme badge (D-10) | CONTEXT.md | 1 |
| Intent badge renkleri (D-11, specifics) | CONTEXT.md | 4 renk |
| × silme butonu, onay yok (D-12) | CONTEXT.md | 1 |
| Volume azalan sıralama (D-13) | CONTEXT.md | 1 |
| Enrichment otomatik, opacity-50 + spinner (D-05, specifics) | CONTEXT.md | 2 |
| Import formatı text paste (D-01, D-02, D-03) | CONTEXT.md | 3 |
| Dark theme, slate palette, CSS variables | globals.css (Phase 1 artefakt) | token seti |
| 2 sütunlu layout, p-8 sayfa padding | STATE.md + mevcut page.tsx | 2 |
| Tablo başlık bg-secondary/40 pattern | Mevcut page.tsx | 1 |
| KD dot renkleri ve formatVolume | Mevcut page.tsx (kdColor, formatVolume) | 2 |
| Badge className pattern (variant prop yok) | STATE.md karar notu | 1 |
| Font, icon library, base color | components.json | 3 |
| useTransition loading pattern | KeywordImport.tsx | 1 |
| Mevcut bileşen envanteri | src/components/ui/ | 12 bileşen |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
