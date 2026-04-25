# Phase 11: Metadata Validator & QA Scoring - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11, page package editörüne iki katmanlı kalite kontrol ekler:

1. **Rules Engine Validator** — `rule-meta.ts`'deki aktif kurallara göre metadata tutarlılığını otomatik kontrol eder. Kaydetme sırasında hafif uyarı gösterir; kilit öncesinde tam onay diyaloğu sunar.
2. **LLM QA Denetimi** — Kullanıcı "Kilitle" butonuna bastığında Claude claude-sonnet-4-6 ile 4 boyutlu denetim (intent drift, robotik dil, entity eksikliği, duplicate risk) çalışır. Sonuçlar diyalog olarak gösterilir, kullanıcı onaylayarak kilitlemeye devam edebilir.
3. **5 Boyutlu Skor** — SEO, içerik, insan, schema, readiness skorları hesaplanır ve editör header'ında sayısal olarak gösterilir.

**Phase 11 kapsamı dışı:**
- Bulk QA (tüm sayfalar aynı anda)
- Versioning / diff
- WordPress publishing payload
- QA geçmiş log görünümü (Phase 12+)
- Autonomous içerik düzeltme önerileri (yalnızca tespit, düzeltme değil)

</domain>

<decisions>
## Implementation Decisions

### D-01: Validator Tetikleyici — İkili Davranış

**Kaydetme anında (hafif):**
Kullanıcı "Kaydet" butonuna bastığında mevcut QaBadge, rules engine sonuçlarını da kapsayacak şekilde güncellenir. `computeQaRules` fonksiyonu genişletilir; aktif proje kuralları server action ile alınır ve client'a geçirilir. Ayrı RulesBadge yok — tek QaBadge hem hardcoded hem rules-engine sonuçlarını toplar.

**Kilit öncesinde (tam diyalog):**
Kullanıcı "Kilitle" butonuna bastığında önce rules engine kontrolü çalışır. İhlal varsa diyalog açılır: ihlal listesi gösterilir, "Anlıyorum, yine de kilitle" butonu ile devam edilebilir. Sert blok yok — kullanıcı söz sahibi.

### D-02: QaBadge Evrimi

Mevcut `QaBadge.tsx` bileşeni korunur ama `QaBadgeProps`'a `projectRules` eklenir:

```ts
type ProjectRules = Record<string, boolean>  // rule_key → active

export type QaBadgeProps = {
  seoTitle: string
  metaDescription: string
  h1: string
  slug: string | null
  focusKeyword: string | null
  projectRules: ProjectRules  // Yeni — rules engine kararları
}
```

`computeQaRules` fonksiyonu rules engine kurallarını da değerlendirir:
- `title_starts_with_keyword` aktifse → focus keyword title başında mı?
- `title_max_length_enforced` aktifse → 60 karakter sınırı uyarı/hata
- `slug_lowercase_hyphen` aktifse → slug format kontrolü
- `meta_desc_includes_keyword` aktifse → keyword meta'da var mı?
- vb.

### D-03: LLM QA Akışı

**Tetikleyici:** Kilitle butonuna otomatik. Akış:
```
Kilitle → Rules check → (geçti/dialog) → Claude QA başlar → Loading state →
Sonuç diyalog → "Anlayarak Kilitle" / "İptal"
```

**Claude'a gönderilen içerik (core alanlar):**
- `seo_title`, `meta_description`, `h1`, `search_intent`, `strategic_purpose`
- `content_blocks` (stringify)
- Sayfa bağlamı: `page_type`, `focus_keyword_text`, proje adı

**4 kontrol boyutu:**
1. Intent drift — içerik, hedef intent ile uyuşuyor mu?
2. Robotik dil — AI şablonculuğu fark edilebilir mi?
3. Entity eksikliği — bağlam için beklenen entity'ler yazıya eklenmiş mi?
4. Duplicate risk — site içinde benzer içerik riski var mı?

**Claude çıktı formatı (structured JSON):**
```json
{
  "checks": [
    { "id": "intent_drift", "severity": "ok|warning|critical", "note": "..." },
    { "id": "robotic_language", "severity": "ok|warning|critical", "note": "..." },
    { "id": "entity_gap", "severity": "ok|warning|critical", "note": "..." },
    { "id": "duplicate_risk", "severity": "ok|warning|critical", "note": "..." }
  ],
  "content_score": 88,
  "human_score": 75
}
```

**Kritik sorun davranışı:** Kritik bulunan check'ler diyalogda kırmızı ile gösterilir. "Anlıyorum, yine de kilitle" butonu ile devam edilebilir. Sert blok yok.

### D-04: 5 Boyutlu Skor Mimarisi (Hibrid)

| Skor | Kaynak | Açıklama |
|------|--------|----------|
| SEO Score | Client-side + rules engine | title/meta/h1/slug kuralları → 0-100 puan |
| Metadata Score | Client-side + rules engine | Meta alan doluluğu + uzunluk kuralları |
| Content Score | Claude QA çıktısı | `content_score` (0-100) |
| Human Score | Claude QA çıktısı | `human_score` (0-100) |
| Schema Score | Client-side | schema_jsonld dolu + parse edilebilir JSON → 100; dolu ama geçersiz → 50; boş → 0 |

**Readiness Score:**
```
readiness = (seo + metadata + content + human + schema) / 5
```
Eşit ağırlık, 100 üzerinden.

**Kaydetme:** `qa_scores` JSONB alanına yazılır:
```json
{
  "seo": 85,
  "metadata": 70,
  "content": 90,
  "human": 80,
  "schema": 60,
  "readiness": 77,
  "last_qa_run": "2026-04-25T12:00:00Z"
}
```

Claude QA çalışmamışsa `content` ve `human` null kalır; readiness mevcut skorların ortalamasından hesaplanır.

### D-05: Editörde Skor Gösterimi

**Konum:** Editör header'ı — QaBadge ve PackageStatusBadge'in altına yeni skor satırı eklenir.

**Format:**
```
SEO 85 | İçerik 90 | İnsan 80 | Schema 60 | Hazırlık 79
```

Renk kodlaması: `text-emerald-400` (≥80) / `text-amber-400` (60-79) / `text-red-400` (<60).
QA henüz çalışmamışsa content ve human `—` olarak gösterilir.

### D-06: API Route — Claude QA Endpoint

Yeni endpoint: `/api/ai/qa-audit/route.ts`

Pattern olarak mevcut `/api/ai/generate-page-package/route.ts` kullanılır. Streaming değil — tek JSON yanıt. Kullanıcı auth + proje ownership doğrulaması server action üzerinden yapılır.

**İstek:** `{ packageId, projectId }` — server-side page_packages tablosundan core alanlar alınır.
**Yanıt:** Yukarıdaki structured JSON formatı.

### Claude's Discretion

- SEO Score hesaplama formülü (kaç kural ihlali = kaç puan düşüşü — kural sayısına göre orantılı önerilir)
- Loading state sırasında Kilitle dialog'undaki UX (spinner + "Claude analiz ediyor..." mesajı)
- QA diyaloğunda severity renklerinin tam tasarımı (critical = kırmızı, warning = amber, ok = emerald)
- `last_qa_run` timestamp'in gösterilip gösterilmeyeceği

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mevcut Uygulama (Evrilecek)
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx` — Editör; header bölgesi, kilitle akışı ve QaBadge entegrasyonu
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/QaBadge.tsx` — Genişletilecek; `projectRules` prop eklenecek
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` — `updatePagePackage`; `qa_scores` alanı eklenecek
- `src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx` — Rules sorgusu eklenecek; `qa_scores` JOIN

### Rules Engine
- `src/lib/rules/rule-meta.ts` — 12 kural tanımı (4 kategori: SEO Title, H1, Slug, Meta Description)
- `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` — Rules okuma pattern'ı (global + project override)
- `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` — `toggleProjectRule` / `resetProjectRule` pattern

### AI Route (Referans Pattern)
- `src/app/api/ai/generate-page-package/route.ts` — AI API endpoint pattern; yeni `/api/ai/qa-audit/route.ts` bu yapıyı izler

### DB (Migration Gerektirmez)
- `qa_scores JSONB` sütunu `page_packages` tablosunda mevcut (Phase 9'dan) — migration gerekmiyor
- `supabase/migrations/` — Mevcut page_packages yapısı referansı

### UI Constraints (Önceki Fazlardan Yerleşik)
- `font-medium` YASAK
- `Badge` → `className` ile renk, `variant` prop YOK
- `DialogTrigger` → `render={}` prop, NOT `asChild`
- Tailwind v4 CSS-first: `tailwind.config.ts` yok
- `useTransition` + `router.refresh()` — save/action sonrası refresh pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QaBadge` + `computeQaRules` — doğrudan genişletilir, sıfırdan yazılmaz
- `Field` bileşeni `PagePackageEditor.tsx` içinde — disabled state zaten var
- `Dialog`, `DialogTrigger`, `DialogContent` — mevcut kilitle diyalog pattern'ı (render={} prop)
- `cn()` — conditional className, renk kodlaması için
- `useTransition` + `router.refresh()` — save/QA action sonrası
- `createClient()` server-side — rules sorgusu için

### Established Patterns
- Server Actions: `'use server'` + auth check + ownership verify + DB op + revalidatePath
- Rules okuma: `supabase.from('rules').select().eq('user_id').eq('project_id')` + global fallback
- Status workflow: `updatePackageStatus` server action — `locked` state korunur
- AI endpoint: `/api/ai/generate-page-package/route.ts` — auth + Anthropic streaming pattern

### Integration Points
- `page.tsx` → rules sorgusu eklenir (global + project) → `resolvedRules` prop olarak PagePackageEditor'a geçer
- `PagePackageEditor` → `projectRules` prop alır → `QaBadge`'e geçer → `computeQaRules` değerlendirir
- Kilitle butonu akışı: rules check (client) → Claude QA (API route) → diyalog → `updatePackageStatus('locked')` + `qa_scores` kaydet
- `/api/ai/qa-audit` → Anthropic SDK → structured JSON yanıt → client'ta parse ve diyalog

</code_context>

<specifics>
## Specific Ideas

- QA diyaloğu başlığı: "Kalite Denetimi" veya "Kilit Öncesi Kontrol"
- Skor satırı header'da mevcut badge'lerin altında, font-normal text-xs ile, dimmed renk neutral başlar sonra renk kodlanır
- Claude QA loading: "Claude analiz ediyor..." spinner ile kilitle diyaloğu açık tutulur, tamamlandığında içerik değişir
- Kural ihlali sayısı QaBadge'de: "⚠ 2 Uyarı" — kural ihlali + hardcoded uyarılar birlikte sayılır
- `qa_scores.last_qa_run` timestamp bilgisi — "Son denetim: 14:32" şeklinde header'da isteğe bağlı

</specifics>

<deferred>
## Deferred Ideas

- **Bulk QA** — Tüm sayfalara aynı anda QA çalıştırma (Phase 12+)
- **QA geçmiş log** — Önceki QA sonuçlarını görüntüleme (Phase 12)
- **Otomatik düzeltme önerileri** — Claude sadece tespit yapıyor; düzeltme Phase 13+ (Content Studio)
- **Schema validation** — JSON-LD'nin schema.org uyumluluğu kontrolü (Phase 12)
- **Ağırlıklı readiness skoru** — Şu an eşit ağırlık; ajans önceliklerine göre konfig sonraki sürümde

</deferred>

---

*Phase: 11-metadata-validator-qa-scoring*
*Context gathered: 2026-04-25*
