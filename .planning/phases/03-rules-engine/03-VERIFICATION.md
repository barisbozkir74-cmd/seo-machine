---
phase: 03-rules-engine
verified: 2026-04-23T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "/ayarlar/kurallar sayfasını tarayıcıda aç, toggle'a tıkla"
    expected: "Toggle animasyonlu kapanır/açılır, Supabase'de rule_value güncellenir, sayfa yenilenir"
    why_human: "Optimistic UI + Server Action tetiklenme zinciri çalışma zamanında doğrulanmalı; grep ile toggle click -> action call -> DB write akışı izlenemez"
  - test: "/projeler/[id]/kurallar sayfasında bir kuralı toggle'la, sonra ✕ butonuna bas"
    expected: "Toggle sonrası [Proje] badge görünür; ✕ sonrası [Global] badge geri döner"
    why_human: "resetProjectRule -> DELETE -> revalidatePath -> scope badge değişimi akışı görsel olarak doğrulanmalı"
  - test: "Yeni kullanıcı olarak /ayarlar/kurallar sayfasına ilk kez git"
    expected: "Sayfa boş görünmeden 12 kuralı listeler (seed guard çalışıyor)"
    why_human: "Seed guard'ın gerçek 'sıfır kayıt' senaryosunda tetiklendiği yalnızca ilk oturum testinde doğrulanabilir"
---

# Phase 03: Rules Engine — Doğrulama Raporu

**Faz Hedefi:** Rules Engine — 12 boolean SEO kuralı tanımlama ve inline güncelleme sistemi; global ve proje bazlı scope yönetimi
**Doğrulandı:** 2026-04-23
**Durum:** human_needed
**Yeniden Doğrulama:** Hayır — ilk doğrulama

---

## Hedef Başarı Değerlendirmesi

### ROADMAP Başarı Kriterleri

| # | Kriter | Durum | Kanıt |
|---|--------|-------|-------|
| 1 | Kullanıcı proje bazlı SEO kuralları tanımlayabilir (H1 exact match, slug exact match vb.) | DOGRULANDI | `projeler/[id]/kurallar/page.tsx` — toggleProjectRule.bind(null, id) ile 12 kural proje scope'ta upsert edilebiliyor |
| 2 | Kural seti panelden güncellenebilir; sistem güncel kuralları sonraki üretimlerde uygular | DOGRULANDI | `RuleToggleRow.tsx` optimistic toggle + `toggleRule`/`toggleProjectRule` Server Actions — DB'ye anında yazar, revalidatePath ile sayfa yenilenir |
| 3 | Global ve proje bazlı kurallar birbirinden ayrılır; proje kuralı global kuralı ezer | DOGRULANDI | `resolvedRules` merge pattern: `projectOverrides` varsa scope='project', yoksa `globalValues`'den scope='global' döner |

**Puan: 7/7 must-have dogrulandi**

---

### Observable Truths — Plan 03-01

| # | Truth | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | Kullanıcı /ayarlar/kurallar adresine gittiğinde 12 SEO kuralını 4 kategori altında görebilir | DOGRULANDI | `RULE_META` 12 anahtar (rule-meta.ts), `CATEGORIES` 4 eleman; page.tsx her kategori için Table render ediyor |
| 2 | İlk açılışta kurallar otomatik seed edilir — boş sayfa hiçbir zaman görünmez | DOGRULANDI (insan dogrulamasi gerekli) | Seed guard: `if (!rules \|\| rules.length === 0) { await seedGlobalRules() ... }` — çalışma zamanında insan testi gerekli |
| 3 | Her kural satırında kural etiketi, önerilen değer ipucu ve toggle switch görünür | DOGRULANDI | RuleToggleRow: label, `Önerilen: Açık/Kapalı`, `<Switch checked={localValue} .../>` — tüm unsurlar mevcut |
| 4 | Toggle tıklanınca global kural anında Supabase'e yazılır, sayfa yenilenir | DOGRULANDI (insan dogrulamasi gerekli) | `handleToggle -> toggleAction(ruleKey, checked) -> supabase.from('rules').update(...) -> revalidatePath` — çalışma zamanında insan testi gerekli |

### Observable Truths — Plan 03-02

| # | Truth | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | RuleToggleRow bileşeni toggle tıklandığında ilgili Server Action'ı çağırır | DOGRULANDI | `handleToggle` → `await toggleAction(ruleKey, checked)` — toggleAction prop injection ile her iki sayfada farklı action geçiliyor |
| 2 | Toggle geçişi sırasında disabled + opacity-50 loading state gösterilir | DOGRULANDI | `Switch disabled={isPending}` + `className={isPending ? 'opacity-50 cursor-wait' : ''}` |
| 3 | Hata durumunda toggle önceki değere döner ve inline hata mesajı görünür | DOGRULANDI | `setLocalValue(prev)` rollback + `setError(result.error ?? '...')` → `<p className="text-xs text-destructive">` |
| 4 | toggleProjectRule proje ownership kontrolü yaparak upsert gerçekleştirir | DOGRULANDI | `supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()` ownership check + upsert onConflict |
| 5 | resetProjectRule proje override satırını siler (global'e döner) | DOGRULANDI | `.delete().eq('scope', 'project')` — yalnızca project-scope satır siliniyor |
| 6 | Global kurallar sayfasında RuleToggleRow bileşeni toggle'larla wire edilmiştir | DOGRULANDI | `<RuleToggleRow ... scope="global" toggleAction={toggleRule} />` — statik span kaldırıldı |

### Observable Truths — Plan 03-03

| # | Truth | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | Kullanıcı dashboard'da üst navda 'Ayarlar' linkini görebilir ve /ayarlar/kurallar sayfasına ulaşabilir | DOGRULANDI | `layout.tsx`: `<Link href="/ayarlar/kurallar">Ayarlar</Link>` — üst nav'da mevcut |
| 2 | Proje detay sayfasında sol sütunun altında 'Proje Kuralları' linki görünür | DOGRULANDI | `projeler/[id]/page.tsx` satır 167-174: Separator + `href={\`/projeler/${id}/kurallar\`}` |
| 3 | /projeler/[id]/kurallar sayfası 12 kuralı proje + global override birleştirmesiyle gösterir | DOGRULANDI | `resolvedRules` merge pattern — globalRules + projectRules sorguları, RULE_META üzerinden 12 kural render |
| 4 | Global değer taşıyan kurallar [Global] badge, override olan kurallar [Proje] ✕ badge gösterir | DOGRULANDI | RuleToggleRow: `scope === 'global'` → slate badge, `scope === 'project'` → blue badge + ✕ Button |
| 5 | Proje override toggle değiştirilince toggleProjectRule çağrılır | DOGRULANDI | `toggleAction={toggleProjectRule.bind(null, id)}` — partial application ile proje ID sabitlenmiş |
| 6 | ✕ tıklanınca resetProjectRule çağrılır ve kural [Global]'e döner | DOGRULANDI | `resetAction={isProjectScope ? resetProjectRule.bind(null, id, ruleKey) : undefined}` — yalnızca proje scope'ta resetAction geçiliyor |

---

## Artifact Doğrulama

### Seviye 1-2-3: Varlık + İçerik + Bağlantı

| Artifact | Durum | Detay |
|----------|-------|-------|
| `src/components/ui/switch.tsx` | DOGRULANDI | 32 satır, base-ui Switch wrapper, `onCheckedChange` prop destekleniyor, `export { Switch }` |
| `src/app/(dashboard)/ayarlar/kurallar/actions.ts` | DOGRULANDI | `'use server'`, `seedGlobalRules` (12 kural upsert, onConflict), `toggleRule` (auth guard, `.from('rules').update`), `revalidatePath` |
| `src/app/(dashboard)/ayarlar/kurallar/page.tsx` | DOGRULANDI | Seed guard, RULE_META+CATEGORIES import (rule-meta.ts), RuleToggleRow import + wire, toggleRule prop injection |
| `src/components/rules/RuleToggleRow.tsx` | DOGRULANDI | `'use client'`, optimistic toggle, rollback, isPending, Global/Proje badge, `opacity-50 cursor-wait`, amber sapma |
| `src/app/(dashboard)/projeler/[id]/kurallar/actions.ts` | DOGRULANDI | `'use server'`, `toggleProjectRule` (ownership check + upsert), `resetProjectRule` (ownership check + DELETE scope='project') |
| `src/app/(dashboard)/projeler/[id]/kurallar/page.tsx` | DOGRULANDI | Auth guard, project ownership notFound(), global+proje merge (resolvedRules), RuleToggleRow wire, toggleProjectRule.bind+resetProjectRule.bind |
| `src/app/(dashboard)/layout.tsx` | DOGRULANDI | `<nav>`, `<Link href="/projeler">Projeler</Link>`, `<Link href="/ayarlar/kurallar">Ayarlar</Link>`, server-side auth guard korunmuş |
| `src/app/(dashboard)/projeler/[id]/page.tsx` | DOGRULANDI | `<Separator className="my-4" />` + `<Link href={\`/projeler/${id}/kurallar\`}>Proje Kuralları</Link>` — satır 167-174 |
| `src/lib/rules/rule-meta.ts` | DOGRULANDI | `RULE_META` (12 anahtar, 4 kategori), `CATEGORIES` (4 eleman), her iki sayfa bu dosyayı import ediyor |

### Seviye 4: Data Flow Trace

| Artifact | Veri Değişkeni | Kaynak | Gerçek Veri Üretiyor mu | Durum |
|----------|----------------|--------|------------------------|-------|
| `ayarlar/kurallar/page.tsx` | `rules` | `supabase.from('rules').select().eq('scope','global')` | Evet — DB sorgusu, seed guard | AKTIF |
| `projeler/[id]/kurallar/page.tsx` | `globalRules`, `projectRules` | İki ayrı `supabase.from('rules')` sorgusu | Evet — her ikisi gerçek DB sorgusu | AKTIF |
| `RuleToggleRow.tsx` | `localValue` | `currentValue` prop (Server Component'ten geliyor) | Evet — DB'den gelen değer prop olarak geçiliyor | AKTIF |

---

## Key Link Doğrulama

| Kaynak | Hedef | Via | Durum |
|--------|-------|-----|-------|
| `ayarlar/kurallar/page.tsx` | `ayarlar/kurallar/actions.ts` | `import { seedGlobalRules, toggleRule }` | BAGLANMIS |
| `ayarlar/kurallar/actions.ts` | rules tablosu | `supabase.from('rules').upsert/.update` | BAGLANMIS |
| `ayarlar/kurallar/page.tsx` | `RuleToggleRow.tsx` | `import { RuleToggleRow }`, `toggleAction={toggleRule}` | BAGLANMIS |
| `projeler/[id]/kurallar/page.tsx` | `projeler/[id]/kurallar/actions.ts` | `import { toggleProjectRule, resetProjectRule }`, bind pattern | BAGLANMIS |
| `projeler/[id]/kurallar/actions.ts` | rules tablosu | `supabase.from('rules').upsert/.delete` | BAGLANMIS |
| `layout.tsx` | `/ayarlar/kurallar` | `<Link href="/ayarlar/kurallar">` | BAGLANMIS |
| `projeler/[id]/page.tsx` | `/projeler/[id]/kurallar` | `` <Link href={`/projeler/${id}/kurallar`}> `` | BAGLANMIS |

---

## Gereksinim Kapsamı

| Gereksinim | Plan | Açıklama | Durum | Kanıt |
|------------|------|----------|-------|-------|
| RULE-01 | 03-01, 03-03 | Kullanıcı proje bazlı SEO kuralları tanımlayabilir | KARSILANDI | toggleProjectRule upsert, /projeler/[id]/kurallar sayfası |
| RULE-02 | 03-01, 03-02 | Kural seti panelden güncellenebilir | KARSILANDI | toggleRule + toggleProjectRule Server Actions, RuleToggleRow inline güncelleme |
| RULE-03 | 03-02, 03-03 | Global/proje kural ayrımı; proje kuralı global'i ezer | KARSILANDI | resolvedRules merge: projectOverrides > globalValues, scope badge gösterimi |

---

## Anti-Pattern Taraması

| Dosya | Satır | Pattern | Önem | Etki |
|-------|-------|---------|------|------|
| Hiçbir dosyada bulunamadı | — | — | — | — |

Tarama kapsamı: TODO, FIXME, HACK, PLACEHOLDER, `return null`, `return []`, `return {}`, eski statik span placeholder (`currentValue ? 'Açık' : 'Kapalı'`). Hiçbir anti-pattern tespit edilmedi.

**Dikkat Notu — Switch Bileşeni:** `switch.tsx` shadcn yerine `@base-ui/react/switch` kullanıyor. `onCheckedChange` prop'u base-ui'de destekleniyor (tip tanımı doğrulandı). İşlevsel eşdeğerlik sağlanmış — bu bir blocker değil.

---

## Behavioral Spot-Checks

Step 7b: Sunucu gerektirdiğinden (Next.js SSR + Supabase bağlantısı) otomatik spot-check çalıştırılamaz. İnsan doğrulaması gerekli (aşağıya bakın).

---

## İnsan Doğrulaması Gereken Maddeler

### 1. Global Toggle Akışı

**Test:** `/ayarlar/kurallar` sayfasını tarayıcıda aç, herhangi bir toggle'a tıkla.
**Beklenen:** Toggle animasyonlu kapanır/açılır (loading opacity-50 görünür), Supabase `rules` tablosunda `rule_value` güncellenir, sayfa tekrar yüklenir.
**İnsan neden gerekli:** Optimistic UI + Server Action tetiklenme zinciri çalışma zamanında doğrulanmalı; grep ile toggle click -> action call -> DB write akışı izlenemez.

### 2. Proje Override ve Reset Akışı

**Test:** `/projeler/[id]/kurallar` sayfasında bir kuralı toggle'la. `[Proje]` badge belirtiğini doğrula. Ardından `✕` butonuna bas.
**Beklenen:** Toggle sonrası `[Proje]` badge (mavi) görünür. `✕` sonrası `[Global]` badge (slate) geri döner. DB'de project-scope satır silinir.
**İnsan neden gerekli:** resetProjectRule -> DELETE -> revalidatePath -> scope badge değişimi akışı görsel olarak doğrulanmalı.

### 3. Seed Guard İlk Açılış

**Test:** Yeni bir oturumda (temiz kurallar) `/ayarlar/kurallar` sayfasına ilk kez git.
**Beklenen:** Sayfa hiç boş görünmeden 12 kuralı listeler — seed guard tetikleniyor ve kurallar otomatik oluşturuluyor.
**İnsan neden gerekli:** Seed guard'ın gerçek 'sıfır kayıt' senaryosunda tetiklendiği yalnızca ilk oturum testinde doğrulanabilir.

---

## Sapma Kaydı

| Sapma | Tür | Etki |
|-------|-----|------|
| `switch.tsx` shadcn yerine `@base-ui/react/switch` kullanıyor | Uygulama detayı | Sıfır — `onCheckedChange` prop uyumu tip tanımıyla doğrulandı |
| Plan 03-03'te `rule-meta.ts` ortak sabit dosyası oluşturuldu (plan her iki yaklaşımı kabul ediyordu) | Otomatik iyileştirme | Olumlu — duplicate kod ortadan kalktı |
| Plan 03-02'de global page.tsx'e 4. sütun başlığı ("Kapsam") eklendi | Zorunlu düzeltme | Gerekli — RuleToggleRow 4 `<td>` döndürüyor |
| `resolvedRules` scope alanı `'global' \| 'project'` explicit annotation eklendi | Bug fix (TS2322) | Gerekli — TypeScript hatasız derleme |

---

## Özet

Phase 3 Rules Engine, 7/7 must-have'i kodla doğrulandı. Tüm artifacts mevcut, içerik substantif ve birbirleriyle wired durumda. Veri akışı DB'den UI'a kadar izlenebilir.

**Otomatik doğrulamalar geçti:**
- 9 artifact (varlık + içerik + bağlantı)
- 7 key link bağlantısı
- 3 requirement (RULE-01, RULE-02, RULE-03) tamamı karşılandı
- Anti-pattern taraması: temiz

**İnsan testi bekliyor:** 3 madde — toggle akışı, override/reset döngüsü, seed guard ilk açılış. Bu maddeler çalışma zamanı davranışını kapsar ve grep ile doğrulanamaz.

---

_Dogrulandi: 2026-04-23T00:00:00Z_
_Dogrulayici: Claude (gsd-verifier)_
