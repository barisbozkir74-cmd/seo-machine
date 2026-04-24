---
phase: 05-keyword-import-enrichment
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/dataforseo/client.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/IntentBadge.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx
  - src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Keyword import ve enrichment akışını oluşturan 5 dosya incelendi. Genel kalite seviyesi iyi; yetkilendirme kontrolleri tutarlı, hata yönetimi enrichment katmanında bilinçli olarak sessiz fail tercih ediliyor (D-07 kararı). Ancak bir kritik güvenlik açığı (DataForSEO toplu API limit aşımı) ve üç uyarı seviyesinde mantıksal sorun tespit edildi.

---

## Critical Issues

### CR-01: DataForSEO SERP API'ye sınırsız keyword batch gönderimi

**File:** `src/lib/dataforseo/client.ts:20-37`

**Issue:** `fetchSerpDomains` fonksiyonu, `keywords` dizisinin tamamını tek bir POST isteğine `tasks` olarak gönderiyor. DataForSEO SERP Live endpoint'i istek başına en fazla 100 görev kabul eder; bu sınır aşıldığında API 400 döner ve işlem sessizce başarısız olur. Ayrıca `fetchKeywordData` (satır 211-219) da tek istekte tüm keyword'leri gönderiyor — Google Ads Search Volume endpoint'i 1000 keyword limitine sahip, fakat bu limit büyük import'larda (1000+) aşılabilir.

**Fix:**

```typescript
// client.ts — batch yardımcısı ekle
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function fetchSerpDomains(
  keywords: string[],
  credentials: { login: string; password: string },
  location = { locationCode: 2792, languageCode: 'tr' }
): Promise<string[]> {
  const authHeader = `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}`
  const domains = new Set<string>()

  // DataForSEO SERP Live maks 100 task/istek
  for (const batchKeywords of chunk(keywords, 100)) {
    const tasks = batchKeywords.map((kw) => ({
      keyword: kw,
      location_code: location.locationCode,
      language_code: location.languageCode,
      depth: 10,
    }))
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    })
    if (!response.ok) throw new Error(`DataForSEO SERP API hatası: ${response.status}`)
    const data = await response.json()
    for (const task of data.tasks ?? []) {
      for (const result of task.result ?? []) {
        for (const item of result.items ?? []) {
          if (item.type === 'organic' && item.domain) {
            domains.add((item.domain as string).replace(/^www\./, ''))
          }
        }
      }
    }
  }

  return Array.from(domains)
}
```

`fetchKeywordData` için de benzer şekilde `chunk(keywords, 1000)` döngüsü eklenmeli.

---

## Warnings

### WR-01: deleteCluster — keywords cascade delete yerine null'a çekiliyor, orphan keyword riski

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts:119-135`

**Issue:** Küme silinmeden önce kümeye ait keyword'lerin `cluster_id` alanı `null` yapılıyor. Ardından küme siliniyor. Bu tasarım kasıtlıysa (D-12 interaction contract) sorun yok; ancak `user_id` filtresi var ama `project_id` filtresi yok — başka projelerden aynı `cluster_id`'ye sahip keyword'ler teorik olarak etkilenebilir (UUID çakışması olasılığı düşük ama mevcut). Ayrıca bu `update` + `delete` iki ayrı veritabanı işlemi; küme silme başarısız olursa keyword'ler `cluster_id: null` durumunda kalır (yarı-silme).

**Fix:**

```typescript
// keywords tablosunda project_id filtresi ekle
await supabase
  .from('keywords')
  .update({ cluster_id: null })
  .eq('cluster_id', clusterId)
  .eq('project_id', projectId)  // <-- ekle
  .eq('user_id', user.id)
```

Yarı-silme riskini tamamen ortadan kaldırmak için veritabanı seviyesinde `ON DELETE SET NULL` kısıtı veya `ON DELETE CASCADE` tercih edilmeli.

---

### WR-02: fetchKeywordData — type assertion güvensizliği, null item.keyword kontrolü yok

**File:** `src/lib/dataforseo/client.ts:226-232`

**Issue:** `items.map()` içinde `item.keyword as string` cast'i yapılıyor, ancak `item.keyword` undefined/null olabilir. `actions.ts` satır 81'de `if (!item.keyword) continue` ile bu korunuyor; fakat `client.ts`'in kendi mapping'i de `item.keyword`'ü `as string` ile cast ediyor — API beklenmedik veri döndürdüğünde `keyword` alanı `undefined` olarak işlenebilir ve bu `actions.ts`'deki `continue` guard'ı zaten yakalar, ama dönen `KeywordDataItem[]`'daki keyword `undefined as string` formatında olur.

**Fix:**

```typescript
return items
  .filter((item) => item.keyword != null)
  .map((item) => ({
    keyword: item.keyword as string,
    search_volume: (item.search_volume as number) ?? null,
    cpc: (item.cpc as number) ?? null,
    keyword_difficulty: (item.keyword_difficulty as number) ?? null,
    search_intent: (item.search_intent as string) ?? null,
  }))
```

---

### WR-03: page.tsx — kdColor fonksiyonu kd=null için 0 varsayıyor, yanıltıcı KD gösterimi

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:163`

**Issue:** `kdColor(kw.difficulty ?? 0)` çağrısında `difficulty: null` olan keyword'ler `kdColor(0)` alır → `{ dot: 'bg-emerald-400', label: 'Kolay' }` döner. Ancak satır 181'deki koşul `kw.difficulty !== null` olduğu için bu `dot` ve `label` render edilmez, `'—'` gösterilir. Kod şu an doğru davranıyor fakat `kdColor` her zaman null-safe bir `??` ile çağrılıyor; bu, gelecekte refactor sırasında koşul kaldırılırsa "Kolay" olarak hatalı etiketlemeye yol açar.

**Fix:**

```typescript
// kdColor imzasını null kabul edecek şekilde güncelle
function kdColor(kd: number | null): { dot: string; label: string } | null {
  if (kd === null) return null
  if (kd < 30) return { dot: 'bg-emerald-400', label: 'Kolay' }
  if (kd <= 60) return { dot: 'bg-amber-400', label: 'Orta' }
  return { dot: 'bg-red-400', label: 'Zor' }
}

// Kullanımda:
const kdInfo = kdColor(kw.difficulty)
// render: kdInfo ? <span>...</span> : '—'
```

---

## Info

### IN-01: KeywordDeleteButton — başarısız silme sessizce geçiyor, kullanıcıya geri bildirim yok

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/KeywordDeleteButton.tsx:26-28`

**Issue:** `deleteKeyword` hata döndürdüğünde (örn. ağ hatası, RLS reddi) buton `isPending` durumundan çıkar ve keyword listede kalmaya devam eder — kullanıcı neyin yanlış gittiğini anlayamaz. Sonuç `success: false` olup olmadığı hiç kontrol edilmiyor.

**Suggestion:** `result.success === false` ise `toast` ya da basit bir `console.error` + kullanıcıya görünür bir mesaj göster.

---

### IN-02: page.tsx — spinner gösterimi "enrichment bekliyor" mantığı re-render'da güncellenmez

**File:** `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/page.tsx:162,198-219`

**Issue:** `isEnriching` durumu (`!kw.enriched_at`) server-side render anında hesaplanıyor. Import sonrası enrichment arka planda tamamlanınca tablo kendiliğinden güncellenmez — kullanıcının sayfayı yenilemesi gerekir. Bu bir UX sınırlaması; spinner'ın süresiz dönmesi yanıltıcı olabilir.

**Suggestion:** `revalidatePath` mevcut (`actions.ts:104`), bu yüzden import sonrası sayfanın bir kez yenilendiğinde durum güncellenecektir. Ek olarak, spinner gösterimi için bir timeout veya yenileme butonu eklemek UX'i iyileştirir. Mevcut haliyle kritik bir hata değil, bilgi niteliğinde.

---

_Reviewed: 2026-04-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
