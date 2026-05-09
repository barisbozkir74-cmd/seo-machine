# Phase 20: AI Keyword Clustering & Approval — Research

**Researched:** 2026-05-09
**Domain:** Next.js 16 Server Actions, Supabase schema migration, full-page overlay UI, optimistic state management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** AI kümeleme önerileri full-page overlay olarak gösterilir. Sol panel: cluster listesi (onay/red). Sağ panel: seçili cluster'ın keyword'leri (kaldır seçeneği). Üst: Tümünü Onayla / Tümünü Reddet. Alt: Kapat / İptal.
- **D-02:** Overlay içinde cluster adına çift tıklanınca inline edit aktif olur. Enter/blur ile kaydedilir, Escape iptal eder.
- **D-03:** Cluster düzeyinde onay/red + bireysel keyword kaldırma. Kaldırılan keyword'ler `cluster_id = null` olarak havuza döner.
- **D-04:** Reddedilen cluster'lar `status = 'rejected'` ile arşivlenir, silinmez. Keyword'leri havuza döner.
- **D-05:** Yeniden kümelendirmede `status = 'approved'` cluster'lara dokunulmaz; yalnızca `status = 'draft'` veya `cluster_id = null` keyword'ler için öneri üretilir.
- **D-06:** Toolbar'a "Stratejiyi Onayla" butonu eklenir. En az 1 approved cluster varsa aktif. Tıklanınca `projects.keyword_strategy_approved = true`. Onaylandıktan sonra "✓ Strateji Onaylandı" görünür; geri alınabilir.
- **D-07:** Migration — `keyword_clusters.status TEXT DEFAULT 'draft'`, `projects.keyword_strategy_approved BOOLEAN DEFAULT false`. Migration dosyası: `supabase/migrations/20260509000010_clustering_approval.sql`. Mevcut cluster'lara `status = 'approved'` atanır.
- **D-08:** ClusterButton tıklanınca AI clustering çalışır → sonuçlar `status = 'draft'` ile DB'ye yazılır → overlay açılır.
- **D-09:** "Tümünü Onayla" tüm draft'ları approved yapar, overlay açık kalır.

### Claude's Discretion

- Overlay animasyonu / transition stili
- "Tümünü Onayla" sonrasında overlay açık kalır mı kapanır mı (kararlandı: açık kalır)
- Yeniden kümelendirmede eski draft'ların ne olacağı (Claude belirler)
- `keyword_clusters.status` kolonuna `DEFAULT 'draft'`; mevcut cluster'lara migration'da `approved` atanır

### Deferred Ideas (OUT OF SCOPE)

- Cluster'lar arası keyword sürükle-bırak (drag & drop)
- "Strateji versiyonu" — önceki onay geçmişi kayıt
- AI'ın cluster önerisiyle birlikte açıklama/gerekçe vermesi
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KWST-03 | AI keyword havuzunu gruplar ve kullanıcıya gruplama önerileri sunar | `clusterKeywordsWithAI()` fonksiyonu üretim ortamında çalışıyor; overlay açılınca draft cluster'lar gösterilir |
| KWST-04 | Kullanıcı önerilen grupları kabul/red/düzenleyebilir; onaylananlar keyword tablosuna işlenir | `status` kolonu migration + overlay UI + `updateClusterStatus` server action gerektirir; `projects.keyword_strategy_approved` gate mekanizması |
</phase_requirements>

---

## Summary

Phase 20, mevcut `ClusterButton → clusterAndScoreKeywords → revalidatePath` akışının önüne bir "önizleme + onay" katmanı ekler. Sistem iki yeni DB kolonu (`keyword_clusters.status` ve `projects.keyword_strategy_approved`) ve bir full-page overlay bileşeni (`ClusteringApprovalOverlay`) kazanır.

Mevcut altyapı son derece olgunlaşmış durumdadır: `clusterKeywordsWithAI()` GPT-4o-mini semantic clustering ile production'da çalışmaktadır, `useTransition + server action` pattern'i tüm komşu bileşenlerden öğrenilebilir, `shadcn/ui` tamamen kurulu ve dark theme konfigürasyonu mevcuttur. Overlay için yeni bir Radix primitive gerekmez; `fixed inset-0 z-50` yaklaşımı Dialog kullanmaktan daha hafif ve daha uygun bir çözümdür.

En kritik tasarım kararı optimistic UI'dır: her onayla/reddet/kaldır aksiyonu anında UI'ı günceller ve arka planda server action'ı tetikler, hata durumunda geri döner. Bu, 20-UI-SPEC.md'de açıkça belirtilmiştir. Overlay kapatma işlemi "kaydet ve kapat" değil, yalnızca mount'ı kaldırır; zira her aksiyon DB'ye anlık yazılır.

**Primary recommendation:** `ClusterButton`'ı extend et; sonucu doğrudan `router.refresh()` değil, `useState` overlay kontrolüne yönlendir. Tüm status güncellemeleri için ayrı bir `updateClusterStatus` server action yaz; `clusterAndScoreKeywords`'ü sadece status='draft' yazacak şekilde güncelle.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI clustering çalıştırma | API / Backend (Server Action) | — | GPT-4o-mini çağrısı server-only; `clustering.ts` zaten `'server-only'` import'luyor |
| Draft cluster'ları DB'ye yazma | API / Backend (Server Action) | — | `clusterAndScoreKeywords` action'ın sorumluluğu; sadece status='draft' eklenecek |
| Overlay state yönetimi (açık/kapalı) | Browser / Client | — | `useState<boolean>` + URL değişmez; routing yok |
| Cluster status güncelleme (onayla/reddet) | API / Backend (Server Action) | Browser (optimistic) | Server action veri tutar; optimistic UI anında yanıt verir |
| Keyword-cluster bağının kaldırılması | API / Backend (Server Action) | Browser (optimistic) | Mevcut `moveKeywordToCluster` pattern'ını taklit et |
| `projects.keyword_strategy_approved` yazma | API / Backend (Server Action) | — | IDOR koruması gerektirir (user_id + project ownership) |
| Overlay render | Browser / Client | — | `'use client'` bileşen; SSR gerektirmez |
| Toolbar `StratejiOnaylaButton` durumu | Frontend Server (SSR) + Client | — | İlk render SSR'den gelir (project select'e `keyword_strategy_approved` eklenir), sonraki güncellemeler `revalidatePath` |

---

## Standard Stack

### Core (Mevcut — yeni kurulum gereksiz)

[VERIFIED: codebase grep]

| Kütüphane | Versiyon | Amaç | Neden Standart |
|-----------|---------|------|----------------|
| Next.js | 16.2.4 | App Router, Server Actions | Projenin framework'ü |
| React | 19.2.4 | `useTransition`, `useState`, optimistic UI | Projenin UI katmanı |
| @supabase/supabase-js | ^2.104.0 | DB erişimi | Projenin ORM'i |
| @supabase/ssr | ^0.10.2 | Server-side Supabase client | Tüm server action'larda `createClient()` |
| shadcn/ui (Button, Badge) | mevcut | Aksiyon butonları, status badge | components.json kurulu, dark theme |
| lucide-react | ^1.8.0 | İkon (X, Check, XCircle) | Proje standart ikon seti |
| openai | ^6.34.0 | GPT-4o-mini clustering | Zaten `clusterKeywordsWithAI()` içinde |
| tailwind-merge + clsx | mevcut | className birleştirme | Proje standardı |
| vitest | ^4.1.5 | Test runner | `vitest.config.ts` mevcut |

### Yeni Bileşenler (Bu Fazda Oluşturulacak)

| Bileşen | Tip | Açıklama |
|---------|-----|----------|
| `ClusteringApprovalOverlay` | Client Component | `fixed inset-0 z-50 bg-background` overlay shell |
| `ApprovalClusterRow` | Client Component | Sol panel satırı (inline edit + onayla/reddet) |
| `ApprovalKeywordRow` | Client Component | Sağ panel satırı (kaldır butonu) |
| `StatusBadge` | Client Component | draft/approved/rejected badge |
| `StratejiOnaylaButton` | Client Component | Toolbar butonu, 3 durum |

**Yeni NPM paketi:** Hiçbiri — tümüyle mevcut stack.

---

## Architecture Patterns

### System Architecture Diagram

```
ClusterButton (client)
       │
       ├─── [AI Clustering süreci] ──────────────────────────────┐
       │         │                                               │
       │         ▼                                               │
       │    clusterKeywordsWithAI()        keyword_clusters      │
       │    (server-only, GPT-4o-mini)  ──► [status='draft'] ◄──┘
       │         │                          upsert olur
       │         │ success
       │         ▼
       │    setOverlayOpen(true) ──► ClusteringApprovalOverlay (client)
       │                                      │
       │                         ┌────────────┴───────────────┐
       │                         │                            │
       │                   Sol Panel                    Sağ Panel
       │                   (cluster list)               (keyword list)
       │                         │                            │
       │              Onayla/Reddet click           ✕ Kaldır click
       │                         │                            │
       │                         ▼                            ▼
       │              updateClusterStatus()     removeKeywordFromCluster()
       │              (server action)           (server action)
       │              optimistic UI ◄───────────────────────┘
       │
       │─── [Toolbar] ──────────────────────────────────────────
       │         │
       │    StratejiOnaylaButton
       │         │ (en az 1 approved varsa aktif)
       │         ▼
       │    approveStrategy()
       │    (server action)
       │    projects.keyword_strategy_approved = true
       │         │
       │         └─► revalidatePath → SSR yenileme
```

### Recommended Project Structure

```
src/app/(dashboard)/projeler/[id]/keyword-stratejisi/
├── page.tsx                     # SSR — keyword_strategy_approved eklenir
├── actions.ts                   # 3 yeni action: updateClusterStatus, removeKeywordFromCluster, approveStrategy
├── ClusterButton.tsx            # Genişletilir: overlay state taşır veya callback alır
├── ClusteringApprovalOverlay.tsx  # YENİ — full-page overlay shell
├── ApprovalClusterRow.tsx       # YENİ — sol panel satırı
├── ApprovalKeywordRow.tsx       # YENİ — sağ panel satırı
├── StatusBadge.tsx              # YENİ — draft/approved/rejected
├── StratejiOnaylaButton.tsx     # YENİ — toolbar butonu
└── ClusterPanel.tsx             # Güncellenir: status badge + rejected opacity
```

```
supabase/migrations/
└── 20260509000010_clustering_approval.sql   # YENİ migration
```

### Pattern 1: Overlay State — ClusterButton'dan Yönetim

**Ne:** `ClusterButton` hem AI clustering'i tetikler hem de overlay açılışını kontrol eder. `onClusteringComplete` callback ile parent'a (page.tsx) bağlanmak yerine, overlay state'i doğrudan ClusterButton içinde veya parent wrapper'da tutmak daha temizdir.

**Tercih edilen yaklaşım:** Overlay state'i `page.tsx`'in sunucu bileşeni yerine, bir Client Wrapper component'te tut. `ClusterButton` ve `ClusteringApprovalOverlay` aynı Client Wrapper içinde yaşar.

**Neden:** `page.tsx` SSR bileşenidir; `useState` taşıyamaz. Overlay state client'a ait.

```typescript
// Örnek: KeywordStratejisiToolbar.tsx (client wrapper)
'use client'
import { useState } from 'react'
import { ClusterButton } from './ClusterButton'
import { ClusteringApprovalOverlay } from './ClusteringApprovalOverlay'

export function KeywordStratejisiToolbar({ projectId, clusters, ... }) {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [draftClusters, setDraftClusters] = useState<DraftCluster[]>([])

  const handleClusteringDone = (newClusters: DraftCluster[]) => {
    setDraftClusters(newClusters)
    setOverlayOpen(true)
  }

  return (
    <>
      <ClusterButton projectId={projectId} onDone={handleClusteringDone} ... />
      {overlayOpen && (
        <ClusteringApprovalOverlay
          clusters={draftClusters}
          onClose={() => setOverlayOpen(false)}
          projectId={projectId}
        />
      )}
    </>
  )
}
```

[VERIFIED: codebase grep — ClusterButton mevcut `useTransition` pattern; overlay state için useState ekleme yeterli]

### Pattern 2: Server Action Ownership Check

Tüm mevcut action'larda tekrarlanan ownership doğrulama pattern'i:

```typescript
// VERIFIED: actions.ts — tüm mevcut action'larda bu pattern var
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Oturum bulunamadı.' }

const { data: cluster } = await supabase
  .from('keyword_clusters')
  .select('id')
  .eq('id', clusterId)
  .eq('project_id', projectId)
  .eq('user_id', user.id)
  .single()
if (!cluster) return { success: false, error: 'Küme bulunamadı.' }
```

Yeni `updateClusterStatus` ve `approveStrategy` action'ları bu pattern'i takip etmeli.

### Pattern 3: Optimistic UI (keyword kaldırma için)

```typescript
// VERIFIED: AiAcquireButton.tsx ve MoveKeywordDialog.tsx'ten türetildi
// Keyword kaldırma — optimistic update
const [localKeywords, setLocalKeywords] = useState(keywords)

const removeKeyword = async (keywordId: string) => {
  // Anında UI'dan kaldır
  const prev = localKeywords
  setLocalKeywords(prev.filter(k => k.id !== keywordId))

  const result = await removeKeywordFromCluster(keywordId, projectId)
  if (!result.success) {
    // Hata durumunda geri al
    setLocalKeywords(prev)
  }
  // Success: DB'de zaten güncellendi, revalidatePath overlay kapanınca çalışır
}
```

### Pattern 4: Migration Format

[VERIFIED: supabase/migrations/*.sql — proje formatı]

```sql
-- supabase/migrations/20260509000010_clustering_approval.sql

-- 1. keyword_clusters.status kolonu ekle
ALTER TABLE public.keyword_clusters
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'approved', 'rejected'));

-- 2. Mevcut cluster'lara 'approved' ata (geriye dönük uyumluluk)
UPDATE public.keyword_clusters
  SET status = 'approved'
  WHERE status = 'draft';

-- 3. projects.keyword_strategy_approved ekle
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS keyword_strategy_approved BOOLEAN DEFAULT false NOT NULL;
```

**Önemli not:** CHECK constraint ile `status` kolonu eklenecek. Mevcut migration'larda `IF NOT EXISTS` kullanımı var — bu pattern takip edilmeli.

### Pattern 5: page.tsx'e `keyword_strategy_approved` Ekleme

```typescript
// SSR — page.tsx'deki project query genişletilir
const { data: project } = await supabase
  .from('projects')
  .select('id, name, domain, seo_arch_summary, seo_arch_built_at, keyword_strategy_approved')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()

// clusters query'sine status eklenir
const { data: clustersRaw } = await supabase
  .from('keyword_clusters')
  .select('id, cluster_name, intent, ..., status')  // status eklendi
  ...
```

### Pattern 6: Yeniden Kümelendirmede Draft Yönetimi

**Claude'un kararı (discretion alanı):** Yeniden kümelendirme tetiklendiğinde eski `status = 'draft'` cluster'lar silinir (DELETE), ardından yeni draft'lar yazılır. Onaylı (`status = 'approved'`) cluster'lara ait keyword'ler filtrelenerek dışarıda tutulur.

```typescript
// clusterAndScoreKeywords action güncelmesi
// 1. Approved cluster'ların keyword ID'lerini al
const { data: approvedClusters } = await supabase
  .from('keyword_clusters')
  .select('id')
  .eq('project_id', projectId)
  .eq('status', 'approved')

const approvedClusterIds = approvedClusters?.map(c => c.id) ?? []

// 2. Eski draft cluster'ları sil
await supabase
  .from('keyword_clusters')
  .delete()
  .eq('project_id', projectId)
  .eq('status', 'draft')

// 3. Approved olmayan keyword'leri çek
const { data: keywordsRaw } = await supabase
  .from('keywords')
  .select(...)
  .eq('project_id', projectId)
  .not('enriched_at', 'is', null)
  // cluster_id = null VEYA draft cluster'da olanlar
  .or(`cluster_id.is.null${approvedClusterIds.length ? ',cluster_id.not.in.(${approvedClusterIds.join(',')})' : ''}`)
```

### Anti-Patterns to Avoid

- **Overlay'i Dialog içine koymak:** Radix Dialog kendi focus trap ve z-index yönetimini yapar; `fixed inset-0` overlay ile çakışır. Overlay için native div kullan.
- **`revalidatePath` ile overlay state resetlemek:** Her onayla/reddet'te sayfa yenileme overlay'i kapatır. DB yazma + optimistic UI ayrı tutulmalı; `revalidatePath` yalnızca overlay kapanışında veya "Stratejiyi Onayla" action'ında kullanılmalı.
- **Cluster'ları client state'de tutmak, DB'yi sonra yazmak:** Her aksiyon anında DB'ye yazılmalı (UI-SPEC zorunluluğu). "Değişiklikleri Kaydet" butonu yoktur.
- **`useEffect` ile overlay mount:** Overlay `useState<boolean>` ile kontrol edilir, `useEffect` gerektirmez.
- **clusterAndScoreKeywords'ü değiştirmeden kullanmak:** Mevcut action `upsert` yapar ve doğrudan sayfayı yeniler. Phase 20 için status='draft' eklemesi VE overlay açılış sinyali gerekir.

---

## Don't Hand-Roll

| Problem | Yazmama | Yerine Kullan | Neden |
|---------|---------|---------------|-------|
| Inline edit input | Custom editor bileşeni | Native `<input autoFocus>` | UI-SPEC'te zaten tanımlandı; enter/blur/escape yeterli |
| Optimistic update rollback | Custom undo stack | `useState` önceki değeri yakala, hata durumunda `setState(prev)` | React 19 optimistic hooks gereksiz; pattern MoveKeywordDialog'da var |
| Status badge | CVA (class-variance-authority) ile custom | `StatusBadge` prop-based className switch | Üç durum var, CVA overkill |
| Scroll container | react-virtual veya custom | CSS `overflow-y-auto` + `max-h` | Keyword listesi 500 max — virtualization gereksiz |
| Cluster name validation | Form library (zod/react-hook-form) | `if (!value.trim())` inline check | Tek input, tek kural |

**Key insight:** Bu fazda tüm karmaşıklık state management + DB yazma sırasındadır; UI primitifleri kasıtlı olarak basit tutulmuş.

---

## Common Pitfalls

### Pitfall 1: `status` Kolonu Yokken Query Yapılması

**Ne olur:** `status` kolonu migration'dan önce query edilirse TypeScript hatası ve runtime error.
**Neden olur:** page.tsx'deki `clustersRaw` query'si migration'dan önce genişletilirse.
**Nasıl önlenir:** Migration Wave 0'dır — tüm kod değişikliklerinden ÖNCE gelmeli. Planner bu sırayı zorunlu kılmalı.

### Pitfall 2: `clusterAndScoreKeywords` Upsert Conflict

**Ne olur:** Mevcut action `onConflict: 'project_id,cluster_name'` ile upsert yapar. Aynı adlı bir `approved` cluster varken yeniden kümelendirme tetiklenirse, approved cluster'ın üzerine yazılabilir.
**Neden olur:** `status='draft'` filtrelenmiş DELETE yerine upsert kullanılıyor.
**Nasıl önlenir:** Yeniden kümelendirme öncesinde approved cluster'lar korunmalı; D-05 kararına göre yalnızca draft cluster'lar silinip yeniden oluşturulmalı. INSERT (upsert değil) veya çakışma durumunda skip mantığı kullanılabilir.

### Pitfall 3: Overlay'de `revalidatePath` Çağrısı Overlay'i Resetler

**Ne olur:** `updateClusterStatus` action'ında `revalidatePath` çağrılırsa, Next.js sayfayı yeniler ve overlay state sıfırlanır (açık overlay kapanır).
**Neden olur:** `page.tsx` SSR bileşeni; revalidatePath tetiklenince yeniden render olur, overlay state'i tutan client wrapper da mount edilir ama `useState(false)` ile başlar.
**Nasıl önlenir:** `updateClusterStatus`, `removeKeywordFromCluster` action'larında `revalidatePath` YOK. Sadece `approveStrategy` (Stratejiyi Onayla) ve `clusterAndScoreKeywords` (yeni clustering) çağrılarında `revalidatePath` kullanılır.

### Pitfall 4: Keyword "Kaldır" Sonrası Cluster Boş Kalırsa

**Ne olur:** Cluster'ın tüm keyword'leri kaldırılırsa sağ panel boş kalır; bu beklenen davranış (UI-SPEC'te boş durum var). Ama silme mantığı `deleteKeyword`'daki gibi cluster'ı otomatik kaldırmamalı — kullanıcı cluster'ı ayrıca reddeder.
**Nasıl önlenir:** `removeKeywordFromCluster` action'ı, `deleteKeyword`'daki "son keyword → cluster'ı sil" mantığından FARKLI yazılmalı. Cluster varlığını korur.

### Pitfall 5: Inline Edit Çift-Tıklama vs Tek Tıklama Çakışması

**Ne olur:** Cluster satırına tek tıklamak sağ paneli açar; çift tıklamak inline edit'i açar. Mouse event sırası: `click → dblclick`. `onClick` ile `onDoubleClick` birlikte kullanılabilir — çakışma yoktur.
**Nasıl önlenir:** `onClick` → cluster seç (sağ panel), `onDoubleClick` → editMode aktif. UI-SPEC bu davranışı açıkça belirtmiştir.

### Pitfall 6: `keyword_strategy_approved` SSR Senkron Sorunu

**Ne olur:** Kullanıcı "Stratejiyi Onayla" butonuna tıklar, server action başarılı olur ama `revalidatePath` nedeniyle kısa süreliğine eski state görünür.
**Nasıl önlenir:** `StratejiOnaylaButton` optimistic state (`isPending`) ile butonu `disabled + opacity-50` yapar. `revalidatePath` sonrasında SSR doğru değeri getirir. Kullanıcı 200-500ms gibi kısa bir geçiş görür — kabul edilebilir.

### Pitfall 7: `total_volume` Cluster Sütununun Keyword Kaldırınca Güncellenmemesi

**Ne olur:** Overlay'de keyword kaldırıldığında `keyword_clusters.total_volume` güncellenmezse stale data kalır.
**Nasıl önlenir:** `removeKeywordFromCluster` action'ında `cluster_id = null` yapıldıktan sonra cluster'ın kalan keyword'lerinin volume'u toplanarak `total_volume` güncellenmeli.

---

## Code Examples

### Yeni Server Action: updateClusterStatus

```typescript
// PATTERN: actions.ts — mevcut ownership check pattern'ine uygun
// Source: actions.ts moveKeywordToCluster pattern [VERIFIED: codebase grep]
'use server'

export type UpdateClusterStatusResult =
  | { success: true }
  | { success: false; error: string }

const VALID_CLUSTER_STATUSES = ['draft', 'approved', 'rejected'] as const

export async function updateClusterStatus(
  clusterId: string,
  status: string,
  projectId: string
): Promise<UpdateClusterStatusResult> {
  if (!VALID_CLUSTER_STATUSES.includes(status as typeof VALID_CLUSTER_STATUSES[number])) {
    return { success: false, error: 'Geçersiz durum değeri.' }
  }
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(clusterId) || !uuidRegex.test(projectId)) {
    return { success: false, error: 'Geçersiz ID formatı.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: cluster } = await supabase
    .from('keyword_clusters')
    .select('id')
    .eq('id', clusterId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!cluster) return { success: false, error: 'Küme bulunamadı.' }

  const { error } = await supabase
    .from('keyword_clusters')
    .update({ status })
    .eq('id', clusterId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Durum güncellenemedi.' }
  // NOT: revalidatePath ÇAĞRILMAZ — overlay state sıfırlanmasın
  return { success: true }
}
```

### Yeni Server Action: approveStrategy

```typescript
// Source: mevcut pattern, projects tablosu güncelleme [VERIFIED: codebase]
export async function approveStrategy(
  projectId: string,
  approved: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const uuidRegex = /^[0-9a-f-]{36}$/i
  if (!uuidRegex.test(projectId)) return { success: false, error: 'Geçersiz proje ID.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum bulunamadı.' }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) return { success: false, error: 'Proje bulunamadı.' }

  const { error } = await supabase
    .from('projects')
    .update({ keyword_strategy_approved: approved })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: 'Güncelleme başarısız.' }

  revalidatePath(`/projeler/${projectId}/keyword-stratejisi`)
  return { success: true }
}
```

### Overlay CSS Contract (UI-SPEC'ten)

```typescript
// Source: 20-UI-SPEC.md [VERIFIED: dosya okundu]
// Overlay shell
className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in-0 duration-150"

// Header
className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0"

// Body (iki panel)
className="flex flex-1 min-h-0"

// Sol panel
className="w-[360px] shrink-0 border-r border-border overflow-y-auto"

// Sağ panel
className="flex-1 overflow-y-auto"

// Footer
className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0"
```

---

## DB Schema — Mevcut Durum Tespiti

[VERIFIED: migration dosyaları okundu]

### keyword_clusters — Mevcut Kolonlar

| Kolon | Tip | Default | Notlar |
|-------|-----|---------|--------|
| id | UUID PK | gen_random_uuid() | |
| user_id | UUID FK | NOT NULL | auth.users |
| project_id | UUID FK | NOT NULL | projects |
| cluster_name | TEXT | NOT NULL | UNIQUE(project_id, cluster_name) constraint var |
| primary_keyword_id | UUID FK | NULL | keywords.id ON DELETE SET NULL |
| intent | TEXT | NULL | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | trigger var |
| total_volume | INTEGER | DEFAULT 0 | migration 000003 ile eklendi |
| revenue_type | TEXT | NULL | migration 000003 ile eklendi |
| opportunity_score | NUMERIC(5,2) | NULL | migration 000003 ile eklendi |
| build_priority | TEXT | 'medium' | migration 000003 ile eklendi |
| page_type | TEXT | NULL | migration 000004 ile eklendi |
| target_url | TEXT | NULL | migration 000004 ile eklendi |
| arch_status | TEXT | 'pending' | migration 000004 ile eklendi |
| ai_reasoning | TEXT | NULL | migration 000004 ile eklendi |
| priority_rank | INTEGER | NULL | migration 000004 ile eklendi |
| content_month | INTEGER | NULL | migration 000004 ile eklendi |
| **status** | **TEXT** | **EKSIK — D-07 ile eklenecek** | `'draft' \| 'approved' \| 'rejected'` |

**Kritik bulgu:** `keyword_clusters`'da zaten `arch_status` kolonu var (`pending/approved/rejected`). Bu, site blueprint akışı için (Phase 21+) kullanılıyor. Phase 20'nin `status` kolonu farklı bir anlam taşır: kümeleme onay akışı. İki kolon ayrı tutulmalı — planner'ın farkında olması gerekir.

### projects — Mevcut Kolonlar (İlgili)

| Kolon | Tip | Default | Notlar |
|-------|-----|---------|--------|
| ... | | | |
| seo_arch_summary | TEXT | NULL | migration 000004 |
| seo_arch_built_at | TIMESTAMPTZ | NULL | migration 000004 |
| **keyword_strategy_approved** | **BOOLEAN** | **EKSIK — D-07 ile eklenecek** | DEFAULT false |

**Kritik bulgu:** `projects` tablosunda `keyword_strategy_approved` kolonu YOK. Migration gerekli.

### Migration Dosyası Adlandırma

[VERIFIED: mevcut migration dosyaları]

En son migration: `20260509000007_project_decisions.sql`. Phase 20 migration'ı için D-07'deki isim: `20260509000010_clustering_approval.sql` — 000008 ve 000009 atlanıyor, Phase 19'un 2 migration'ı için slot bırakılmış olabilir. Planner Phase 19 migration sayısını kontrol etmeli.

---

## ClusterButton Genişletme Analizi

[VERIFIED: ClusterButton.tsx okundu]

Mevcut `ClusterButton` yapısı:

```
onClick → setError(null) → startTransition → clusterAndScoreKeywords(projectId)
                                                      ↓
                                              success → (hiçbir şey olmaz, revalidatePath sayfayı günceller)
                                              failure → setError(result.error)
```

Phase 20 sonrası istenen yapı:

```
onClick → setError(null) → startTransition → clusterAndScoreKeywords(projectId)  [modified]
                                                      ↓
                                              success → setOverlayOpen(true)
                                              failure → setError(result.error)
```

**Seçenek A (önerilen):** `ClusterButton` bir `onSuccess` callback prop alır. Parent client wrapper bu callback'te overlay'i açar.

**Seçenek B:** `ClusterButton` overlay state'i de yönetir ve `ClusteringApprovalOverlay`'i içerir. Bu bileşeni büyütür; tercih edilmez.

**Seçenek C:** `clusterAndScoreKeywords` başarıyla döndüğünde, DB'deki yeni draft cluster'ları okuyup overlay'e prop geçmek gerekir. Bu ekstra bir DB read gerektirir. Alternatif: action'ın dönüş değerine draft cluster'ları eklemek (return payload genişletme).

**Tercih:** Seçenek A — `ClusterButton` `onSuccess?: (draftClusters: DraftCluster[]) => void` alır. `clusterAndScoreKeywords` dönüş tipine `clusters: DraftCluster[]` eklenir.

---

## Supabase Migration Prosedürü

[VERIFIED: supabase CLI 2.98.2, config.toml okundu]

```bash
# Local migration push
npx supabase db push

# Veya migration dosyası oluşturma
npx supabase migration new clustering_approval

# Remote push (production)
npx supabase db push --linked
```

Proje `NEXT_PUBLIC_SUPABASE_URL=https://jmailuedcajgidfzigof.supabase.co` ile remote Supabase kullanıyor. Local Supabase da çalışıyor (port 54321). Migration'lar önce local'de test edilmeli, ardından remote'a push.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (mevcut) |
| Quick run command | `npx vitest run src/lib/keywords/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KWST-03 | `clusterKeywordsWithAI` draft status ile DB'ye yazar | unit (mocked) | `npx vitest run src/lib/keywords/clustering.test.ts` | Kısmen — clustering.test.ts var ama status testi yok |
| KWST-03 | `updateClusterStatus` doğru şekilde günceller | unit | `npx vitest run src/lib/keywords/` | Hayır — Wave 0 gap |
| KWST-04 | `approveStrategy` ownership doğrular ve flag yazar | unit | `npx vitest run src/lib/keywords/` | Hayır — Wave 0 gap |
| KWST-04 | Overlay açılınca draft cluster'lar listelenir | manual/e2e | Browser testi | — |

### Wave 0 Gaps

- [ ] `src/lib/keywords/clustering-approval.test.ts` — `updateClusterStatus` ve `approveStrategy` için unit test
- [ ] `clustering.test.ts`'e `clusterKeywordsWithAI` status='draft' yazma testi ekle (mocked Supabase)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration push | Kısmen | 2.98.2 | Manuel SQL |
| OpenAI API | `clusterKeywordsWithAI` | Evet (env var mevcut) | GPT-4o-mini | `clusterEnrichedKeywords()` kural tabanlı fallback zaten var |
| Node.js | Vitest, Next.js | Evet | — | — |
| Supabase Remote | DB migration | Evet | jmailuedcajgidfzigof.supabase.co | — |

**`OPENAI_API_KEY` env var:** `.env.local`'da mevcut (görünmüyor ama `clusterKeywordsWithAI` production'da çalışıyor — dolayısıyla set edilmiş).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | Evet | Her server action'da `user_id + project_id` ownership check |
| V5 Input Validation | Evet | `status` whitelist check, UUID format validation |
| V2 Authentication | Evet | `supabase.auth.getUser()` her action'da |
| V6 Cryptography | Hayır | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Başka kullanıcının cluster'ını onaylamak | Tampering | `eq('user_id', user.id)` her sorguda |
| Geçersiz status değeri enjeksiyonu | Tampering | `VALID_CLUSTER_STATUSES` whitelist |
| IDOR — başka projenin cluster'ı | Elevation of Privilege | `eq('project_id', projectId) + eq('user_id', ...)` |
| `keyword_strategy_approved` yetkisiz set | Tampering | `approveStrategy` ownership check |

---

## State of the Art

| Eski Yaklaşım | Mevcut Yaklaşım | Ne Zaman Değişti | Etki |
|--------------|-----------------|------------------|------|
| Modal (Dialog) ile preview | `fixed inset-0` overlay | UI-SPEC kararı | Daha fazla ekran alanı, daha az z-index karmaşası |
| `router.push()` ile yeni route | `useState` overlay | Phase 20 tasarımı | URL değişmez, daha hızlı UX |
| "Kaydet" butonu ile batch kayıt | Her aksiyon anlık DB yazma | UI-SPEC kararı | Daha güvenli; tab kapansa bile onaylar kaybolmaz |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `OPENAI_API_KEY` env var set edilmiş (production'da cluster akışı çalışıyor) | Environment Availability | Clustering test edilemez; ama mevcut ClusterButton'da zaten çalışıyor |
| A2 | Phase 19'un 2 migration dosyası için 000008-000009 slot'ları ayrılmış; bu yüzden D-07 migration'ı 000010 | DB Schema | Migration adı çakışabilir; planner Phase 19 migration sayısını kontrol etmeli |
| A3 | `supabase db push` komutu local veya remote'a sorunsuz push yapabiliyor | Migration Prosedürü | Deployment bloğu; manuel SQL fallback gerekebilir |

---

## Open Questions

1. **Phase 19 Migration Sayısı**
   - Bilinen: Phase 19'un 3 plan dosyası var (19-01, 19-02, 19-03). En az 1-2 migration bekleniyor.
   - Belirsiz: Kaç migration yazılacak; dolayısıyla 000010 slot'u Phase 20'ye rezervedir mi?
   - Öneri: Planner Phase 19 plan dosyalarını okuyup migration sayısını doğrulasın. Gerekirse Phase 20 migration'ının timestamp'ini ayarlasın.

2. **`arch_status` vs `status` İki Kolon Karmaşası**
   - Bilinen: `keyword_clusters`'da `arch_status` (pending/approved/rejected) site blueprint için mevcut.
   - Belirsiz: Phase 20'nin `status` kolonu (clustering onay akışı) ile karışıklık yaratır mı?
   - Öneri: İki kolonun ayrı amaçları olduğu kod içi yorumlarla açıklanmalı. `status` = kümeleme onayı, `arch_status` = blueprint inşa durumu.

---

## Sources

### Primary (HIGH confidence)

- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/actions.ts` — Tüm server action pattern'leri, ownership check, revalidatePath kullanımı
- `src/lib/keywords/clustering.ts` — `clusterKeywordsWithAI` çıktı formatı (`ClusterResult` tipi)
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterButton.tsx` — `useTransition` pattern
- `supabase/migrations/20260422000001_create_tables.sql` — Base schema
- `supabase/migrations/20260423000003_product_layers_schema.sql` — keyword_clusters genişletme
- `supabase/migrations/20260509000004_master_seo_architecture.sql` — `arch_status` ve projects genişletme
- `.planning/phases/20-ai-keyword-clustering-approval/20-CONTEXT.md` — Tüm locked decisions
- `.planning/phases/20-ai-keyword-clustering-approval/20-UI-SPEC.md` — CSS contract, bileşen inventory, copywriting

### Secondary (MEDIUM confidence)

- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/ClusterPanel.tsx` — ScoreBadge, cluster display pattern
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/MoveKeywordDialog.tsx` — Dialog + async server action pattern
- `src/app/(dashboard)/projeler/[id]/keyword-stratejisi/AiAcquireButton.tsx` — `fetch + router.refresh()` pattern referansı
- `vitest.config.ts` — Test environment konfigürasyonu

---

## Metadata

**Confidence breakdown:**

- DB schema analizi: HIGH — tüm migration dosyaları okundu, mevcut kolonlar doğrulandı
- Server action pattern: HIGH — actions.ts tam okundu, ownership check pattern belgelendi
- UI/Overlay pattern: HIGH — UI-SPEC approved, CSS contract doğrulandı
- Migration prosedürü: MEDIUM — Supabase CLI mevcut, ancak Phase 19 migration sayısı belirsiz
- Test coverage gaps: HIGH — vitest.config.ts ve mevcut test dosyaları okundu

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (Next.js/Supabase stabil; 30 gün geçerli)
