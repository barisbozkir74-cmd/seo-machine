---
phase: 10-schema-center
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - supabase/migrations/20260425000001_add_schema_jsonld.sql
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/page.tsx
  - src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 10: Code Review Raporu

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Özet

Phase 10 kapsamındaki dört dosya incelendi: `schema_jsonld` kolonu ekleyen migration, server actions, sayfa listesi page component ve client-side PagePackageEditor bileşeni.

Kritik güvenlik açığı bulunmadı. Sahiplik doğrulama, RLS ve status geçiş mantığı doğru uygulanmış. Dört warning seviyesinde sorun tespit edildi; bunların üçü veri tutarlılığı/mantık hataları, biri ise potansiyel race condition. Üç info seviyesinde kod kalitesi gözlemi de eklendi.

---

## Warnings

### WR-01: `generateSchemaJsonLd` sayfa state'ini değil, `page` prop'unu okur — kaydedilmemiş seoTitle/metaDescription değişiklikleri schema'ya yansımaz

**Dosya:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:344-347`

**Sorun:** `handleGenerateSchema` fonksiyonu, `generateSchemaJsonLd(page)` çağrısında `page.pkg?.seo_title` ve `page.pkg?.meta_description` değerlerini kullanır. Ancak bileşen içinde bu alanlar `seoTitle`, `metaDescription` state'lerinde tutulmaktadır. Kullanıcı bu alanları değiştirip kaydetmeden "Schema Üret"e tıklarsa, eski (veritabanındaki) değerlere dayanan bir schema üretilir.

**Fix:**

```tsx
// Mevcut page prop'una dayanan çağrı yerine, anlık state'i geçen bir overrides objesi kullan
function handleGenerateSchema() {
  const overrides: PageData = {
    ...page,
    pkg: page.pkg
      ? {
          ...page.pkg,
          seo_title: seoTitle,
          meta_description: metaDescription,
          canonical_url: canonicalUrl,
          faq: parseJsonField(faq),
        }
      : page.pkg,
  }
  const result = generateSchemaJsonLd(overrides)
  setSchemaJsonLd(JSON.stringify(result, null, 2))
}
```

---

### WR-02: `handleSave`'de race condition — `createPagePackage` + `updatePagePackage` arasında kısa pencerede duplicate insert riski

**Dosya:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:360-405`

**Sorun:** Paket yoksa `createPagePackage` çağrılır ve ardından hemen `updatePagePackage` (upsert) çağrılır. İlk çağrı başarılı döndükten sonra ikinci çağrı da `page_id` unique constraint'e güvenerek `upsert` yapar; bu görünürde güvenli. Ancak `createPagePackage` başarıya döndüğü halde (`success: true`) sonrasında `updatePagePackage`'da hata oluşursa, veritabanında boş bir `draft` kaydı kalır ve kullanıcıya hata gösterilir fakat sayfa yenilendiğinde paketin var olduğu görünür (karışık UI durumu). Boş paket oluşturulduktan sonraki update hatası sessizce görmezden gelinmemeli.

**Fix:**

```tsx
// Hata durumunda kullanıcıya daha açıklayıcı mesaj ver ve
// create başarılı / update başarısız ayrımını logla
if (!createResult.success) {
  setSaveStatus('error')
  setErrorMsg(createResult.error)
  return
}
// update hatasında özel mesaj
const result = await updatePagePackage(...)
if (!result.success) {
  setSaveStatus('error')
  setErrorMsg('Paket oluşturuldu fakat veriler kaydedilemedi: ' + result.error)
  return
}
```

---

### WR-03: `updatePagePackage` upsert'inde `onConflict: 'page_id'` yeterli değil — `project_id` ve `user_id` doğrulanmıyor

**Dosya:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts:74-87`

**Sorun:** Upsert çakışma stratejisi sadece `page_id`'ye dayanır. RLS zaten `user_id` filtrelemesi yapar, ancak aynı `page_id`'ye farklı `project_id` ile upsert girişimi (malformed request) yerine yanlış proje güncelleyebilir. Verifyownership yalnızca proje sahibini kontrol eder; `pageId`'nin bu projeye ait olduğunu kontrol etmez.

**Fix:**

```ts
// updatePagePackage içinde, upsert'ten önce sayfa sahipliğini doğrula:
const { data: page } = await supabase
  .from('pages')
  .select('id')
  .eq('id', pageId)
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .single()
if (!page) return { success: false, error: 'Sayfa bulunamadı.' }
```

---

### WR-04: `parseJsonField` geçersiz JSON'u string olarak kaydeder — JSONB kolonuna yazıldığında Supabase hatası verir, bu hata kullanıcıya ulaşır ama sebebi belirsizdir

**Dosya:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:59-67`

**Sorun:** `parseJsonField` JSON parse başarısız olursa ham string'i döndürür (`return trimmed`). Bu değer JSONB kolona (`heading_hierarchy`, `content_blocks`, vb.) yazılmaya çalışıldığında Supabase/PostgreSQL hata verir. Hata mesajı kullanıcıya "Paket kaydedilemedi: invalid input syntax for type json" şeklinde iletilir; hangi alanın hatalı olduğu belirtilmez.

**Fix:**

```ts
function parseJsonField(val: string): unknown {
  const trimmed = val.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // Geçersiz JSON'u string olarak değil null olarak döndür,
    // ya da çağıran tarafta validasyon yap ve kullanıcıya alan adı belirt
    return null
  }
}
// Daha iyi yaklaşım: handleSave içinde her JSON alanını ayrı ayrı valide et
// ve hangi alanın bozuk olduğunu kullanıcıya göster.
```

---

## Info

### IN-01: `schema_jsonld` kolonuna DEFAULT değer verilmemiş — mevcut satırlar NULL alır

**Dosya:** `supabase/migrations/20260425000001_add_schema_jsonld.sql:3-4`

**Sorun:** Diğer JSONB kolonları (`secondary_keywords`, `content_blocks`, vb.) `DEFAULT '[]'` veya `DEFAULT '{}'` ile tanımlanmış. Yeni `schema_jsonld` kolonu default değersiz eklenmiş; bu tutarsızlık sorgularda null-check gerektiren farklı bir davranışa yol açar.

**Fix:**

```sql
ALTER TABLE public.page_packages
  ADD COLUMN IF NOT EXISTS schema_jsonld JSONB DEFAULT NULL;
-- Ya da boş obje varsayılanı isteniyor ise:
-- ADD COLUMN IF NOT EXISTS schema_jsonld JSONB DEFAULT 'null'::jsonb;
-- Tasarım kararı: NULL ile boş obje arasındaki fark dokümante edilmeli.
```

---

### IN-02: `PageData.pkg` tipinde `schema_jsonld: unknown` — tip güvensizliği

**Dosya:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:49`

**Sorun:** Diğer JSONB alanlarıyla tutarlı olsa da `schema_jsonld`'nin olası yapısı (tek obje veya array) `generateSchemaJsonLd` fonksiyonunun dönüş tipiyle (`object | object[]`) belgelenmiş durumda. `unknown` yerine daha dar bir tip kullanmak runtime güvenliğini artırır.

**Fix:**

```ts
// PageData.pkg'da:
schema_jsonld: Record<string, unknown> | Array<Record<string, unknown>> | null
```

---

### IN-03: `handleAiGenerate` stream biriktirilip topluca parse ediliyor — büyük yanıtlarda bellek baskısı

**Dosya:** `src/app/(dashboard)/projeler/[id]/sayfa-paketi/PagePackageEditor.tsx:293-316`

**Sorun:** Stream tüm içerik `accumulated` string'ine biriktirilip sonunda tek seferde parse ediliyor. Gerçek streaming avantajı kullanılmıyor; çok büyük yanıtlarda tarayıcıda bellek baskısı oluşabilir. Şu an için fonksiyonel bir sorun değil, ancak AI çıktısı büyüdükçe gözden geçirilmesi önerilir.

**Fix:** Kısa vadede değişiklik gerekmez. Orta vadede son `}` karakterini takip ederek tamamlanan JSON bloğunu erken parse edebilirsiniz veya `/api/ai/generate-page-package` endpoint'i `text/event-stream` formatında kademeli JSON gönderecek şekilde refactor edilebilir.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
