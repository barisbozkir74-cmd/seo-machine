---
phase: 16-recovery-engine
verified: 2026-04-30T12:00:00Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "/projeler/[id]/izleme?tab=recovery sayfasına git; ContentTabBar'ın üç sekme (Cluster Performansı, Sayfa Performansı, Recovery) gösterdiğini doğrula; Recovery sekmesine tıkla; boş durum ('Tespit edilen pozisyon düşüşü yok') göründüğünü doğrula"
    expected: "Üç sekmeli tab bar görünür, Recovery sekmesi aktif olduğunda RecoveryTaskTable boş durum mesajıyla render edilir"
    why_human: "UI davranışı — yalnızca tarayıcıda doğrulanabilir"
  - test: "Supabase Studio'dan test recovery_task row'u ekle (source='page_package', status='open'); sayfayı yenile; satırın kırmızı 'Açık' badge'iyle göründüğünü doğrula; Görmezden Gel'e tıkla; satırın varsayılan görünümden kalktığını doğrula; 'Dismissed görevleri göster' toggle'ına tıkla; satırın gri badge ile geri geldiğini doğrula"
    expected: "Dismiss akışı çalışır; toggle dismissed satırları gösterir/gizler"
    why_human: "Etkileşimli client-side state + server action round-trip — programatik test edilemez"
  - test: "Güncelle butonuna tıkla (source='page_package' task üzerinde); URL'in /projeler/[id]/sayfalar'a navigate ettiğini doğrula; Supabase'de task status'unun 'in_progress' olduğunu doğrula"
    expected: "Status in_progress'e güncellenir, yönlendirme doğru sayfaya gider"
    why_human: "Server action + navigation akışı — canlı test gerektirir"
  - test: "n8n (veya curl) ile POST /api/recovery/detect çağır (N8N_WEBHOOK_SECRET ve gerçek projectId/userId ile); response'un { inserted, skipped, scanned: { page_packages, imported_pages } } shape'inde olduğunu doğrula; ikinci çağrının inserted:0, skipped:N döndürdüğünü doğrula (duplicate prevention)"
    expected: "Webhook auth çalışır; decay detection ve weak-page scan gerçek veri döndürür; idempotency onaylanır"
    why_human: "Gerçek GSC verisi ve çalışan n8n/curl ortamı gerektirir"
  - test: "Yayınlanmış bir page_package için recovery_task (status='open') oluştur; publishToWordPress aksiyonunu tetikle; izleme Recovery Tab'ını aç; satırın artık görünmediğini doğrula (status=resolved, getRecoveryTasks tarafından filtreleniyor)"
    expected: "publishToWordPress D-04 auto-resolve hook'u open/in_progress task'ı resolved'a geçirir"
    why_human: "WordPress publish + Supabase mutation + UI refresh döngüsü — canlı WP bağlantısı gerektirir"
---

# Phase 16: Recovery Engine Doğrulama Raporu

**Phase Hedefi:** Ranking decay otomatik tespit edilir, `recovery_tasks` tablosuna kaydedilir, izleme sayfasının Recovery sekmesinde gösterilir, kullanıcılar decayed sayfalar üzerinde aksiyon alabilir.
**Doğrulandı:** 2026-04-30T12:00:00Z
**Durum:** human_needed
**Yeniden Doğrulama:** Hayır — ilk doğrulama

## Hedef Başarımı

### Gözlemlenebilir Doğrular

| # | Doğru | Durum | Kanıt |
|---|-------|-------|-------|
| 1 | `recovery_tasks` tablosu gerekli şema ile veritabanında mevcut | VERIFIED | `supabase/migrations/20260430000001_recovery_tasks.sql` tam DDL içeriyor: CREATE TABLE, 3 index, trigger, RLS SELECT + UPDATE policy. SUMMARY-01: `supabase db push` başarıyla tamamlandı |
| 2 | Decay tespiti endpoint'i (POST /api/recovery/detect) webhook secret + ownership + 400/401/404 guard ile çalışır | VERIFIED | `src/app/api/recovery/detect/route.ts` — X-N8n-Webhook-Secret header kontrolü, JSON body parse, projectId/userId validation, project ownership SELECT hepsi mevcut |
| 3 | Decay scan page_packages kaynaklı decay için delta >= +5 AND impressions > 10 eşiğini uygular | VERIFIED | `route.ts` DECAY_DELTA_THRESHOLD=5, DECAY_MIN_IMPRESSIONS=10 sabitleri; `scanPagePackagesDecay()` gsc_metrics'ten son 7d/prior 7d okur, reduceMetrics ile aggregate eder, delta hesaplar |
| 4 | Imported pages weak-page scan flag_weak_page=true AND gsc_avg_position > 20 koşulunu uygular | VERIFIED | `scanImportedPagesWeak()` project_imported_pages tablosunu `.eq('flag_weak_page', true).gt('gsc_avg_position', WEAK_POSITION_THRESHOLD)` ile sorgular |
| 5 | Duplicate prevention: aynı source_id+source için zaten open/in_progress task varsa INSERT atlanır | VERIFIED | Her INSERT öncesinde `.maybeSingle()` existence check mevcut; hem page_package hem imported_page pass'ında |
| 6 | Recovery Tab izleme sayfasında üç sekmeli içerik navigasyonu ile render edilir | VERIFIED | `izleme/page.tsx` ContentTabBar'ı import edip render ediyor; `activeTab === 'recovery'` koşullu section içinde `RecoveryTaskTable tasks={recoveryTasks} projectId={id}` mevcut; `getRecoveryTasks(supabase, id, true)` ile parallel fetch |
| 7 | updateRecoveryTaskStatus server action session auth + proje ownership doğrular, revalidatePath çağırır | VERIFIED | `izleme/actions.ts` — `supabase.auth.getUser()`, `projects` tablosunda `.eq('user_id', user.id)`, `.in('status', ['open', 'in_progress'])` guard, `revalidatePath(/projeler/${projectId}/izleme)` hepsi mevcut |
| 8 | publishToWordPress başarılı WP publish'te open/in_progress recovery_tasks satırlarını resolved'a geçirir (D-04) | VERIFIED | `sayfa-paketi/actions.ts` satır 640-677: try/catch ile non-fatal hook; `.from('recovery_tasks').update({status:'resolved'}).eq('source_id', pkg.id).eq('source','page_package').in('status',['open','in_progress'])`; `revalidatePath(/projeler/${projectId}/izleme)` satır 681 |
| 9 | middleware.ts /api/recovery/detect için auth bypass sağlar | VERIFIED | `middleware.ts` satır 8-13: `pathname.startsWith('/api/gsc/sync') || pathname.startsWith('/api/recovery/detect')` koşulu ile `NextResponse.next()` döndürür |

**Puan:** 9/9 doğru doğrulandı

### Roadmap Success Criteria Karşılık Tablosu

| SC | Metin | Durum | Kanıt |
|----|-------|-------|-------|
| SC-1 | n8n scheduled workflow günlük çalışır; önceki 7 gün ve son 7 günü karşılaştırarak belirlenen eşiğin üzerinde pozisyon kaybı olan sayfaları tespit eder ve Supabase'e decay kaydı olarak yazar | VERIFIED (insan onayı gerekli: canlı n8n) | `route.ts` tüm mantığı içeriyor; endpoint hazır; middleware bypass mevcut |
| SC-2 | Decay kaydı oluştuğunda ilgili page_package üzerinde güncelleme görevi otomatik oluşturulur; kullanıcı monitoring dashboard veya sayfa listesinden görebilir ve güncelleme akışını başlatabilir | VERIFIED (insan onayı gerekli: UI akışı) | `recovery_tasks` tablosu mevcut; izleme/page.tsx Recovery Tab render ediyor; updateRecoveryTaskStatus + publishToWordPress auto-resolve wired |
| SC-3 | Phase 15.5 tamamlandıysa: imported pages'deki weak_page + düşük GSC pozisyonu kombinasyonu recovery kandidatı olarak işaretlenir | VERIFIED | `scanImportedPagesWeak()` tam implementasyon; flag_weak_page=true AND gsc_avg_position>20 filtresi mevcut |

## Gerekli Artifact'lar

| Artifact | Beklenen | Durum | Detay |
|----------|----------|-------|-------|
| `supabase/migrations/20260430000001_recovery_tasks.sql` | recovery_tasks tablo şeması, index, RLS, trigger | VERIFIED | CREATE TABLE, 3 index, trigger, 2 RLS policy — tam |
| `src/lib/monitoring/recovery-tasks.ts` | RecoveryTaskStatus, RecoveryTaskRow, getRecoveryTasks | VERIFIED | 4 export: RecoveryTaskStatus, RecoveryTaskSource, RecoveryTaskRow, getRecoveryTasks |
| `src/app/(dashboard)/projeler/[id]/izleme/content-tab-bar.tsx` | ContentTabBar 3-sekme bileşeni | VERIFIED | 'clusters' \| 'pages' \| 'recovery' sekmeleri; period threading; Türkçe label'lar |
| `src/app/(dashboard)/projeler/[id]/izleme/recovery-task-table.tsx` | RecoveryTaskTable boş durum, badge, dismiss toggle, aksiyon butonları | VERIFIED | Tam implementasyon; 4 durum badge; Güncelle + Görmezden Gel; dismissed toggle |
| `src/app/(dashboard)/projeler/[id]/izleme/actions.ts` | updateRecoveryTaskStatus tam implementasyon (stub değil) | VERIFIED | 'use server'; auth + ownership + status guard + revalidatePath — STUB marker yok |
| `src/app/(dashboard)/projeler/[id]/izleme/page.tsx` | Recovery Tab entegrasyonu; ContentTabBar + RecoveryTaskTable render | VERIFIED | getRecoveryTasks(supabase, id, true); ContentTabBar; activeTab===recovery koşullu render |
| `src/app/api/recovery/detect/route.ts` | n8n webhook endpoint; decay + weak-page scan | VERIFIED | POST export; iki pass (scanPagePackagesDecay + scanImportedPagesWeak); response shape uygun |
| `middleware.ts` | /api/recovery/detect bypass | VERIFIED | pathname.startsWith('/api/recovery/detect') eklendi |
| `src/app/(dashboard)/projeler/[id]/sayfa-paketi/actions.ts` (recovery hook) | publishToWordPress D-04 auto-resolve | VERIFIED | Phase 16 D-04 blok satır 640-677; try/catch; filters; revalidatePath |

## Key Link Doğrulama

| Kaynak | Hedef | Bağlantı | Durum | Detay |
|--------|-------|----------|-------|-------|
| `recovery_tasks.project_id` | `projects.id` | FK ON DELETE CASCADE | VERIFIED | Migration: `REFERENCES public.projects(id) ON DELETE CASCADE` |
| RLS SELECT/UPDATE | `projects.user_id = auth.uid()` | EXISTS subquery | VERIFIED | Migration'da her iki policy de mevcut |
| `set_recovery_tasks_updated_at` trigger | `public.set_updated_at()` | BEFORE UPDATE EXECUTE FUNCTION | VERIFIED | Trigger tam mevcut |
| `izleme/page.tsx` | `getRecoveryTasks(supabase, id, true)` | Promise.all parallel fetch | VERIFIED | Satır 60: üçüncü slot mevcut |
| `izleme/page.tsx` | `ContentTabBar + RecoveryTaskTable` | JSX render / activeTab===recovery | VERIFIED | Satır 98 ve 114-119 |
| `updateRecoveryTaskStatus` | `recovery_tasks.update(...)` | anon-key client + .in status guard | VERIFIED | `from('recovery_tasks').update` + `.in('status',['open','in_progress'])` |
| `updateRecoveryTaskStatus` | `revalidatePath(/projeler/${projectId}/izleme)` | Next.js cache invalidation | VERIFIED | Satır 85 mevcut |
| `publishToWordPress` (post-publish) | `recovery_tasks UPDATE status='resolved'` | `.eq('source_id', pkg.id)` | VERIFIED | Satır 654-663 |
| `POST /api/recovery/detect` | `N8N_WEBHOOK_SECRET` | X-N8n-Webhook-Secret header | VERIFIED | Satır 28-31 |
| `POST /api/recovery/detect` | `recovery_tasks INSERT` | service role + maybeSingle duplicate check | VERIFIED | Her iki pass'ta da `from('recovery_tasks').insert` mevcut |
| `middleware.ts` | `/api/recovery/detect bypass` | pathname.startsWith | VERIFIED | Satır 10 mevcut |

## Data-Flow Trace (Level 4)

| Artifact | Data Değişkeni | Kaynak | Gerçek Veri Üretiyor mu | Durum |
|----------|----------------|--------|------------------------|-------|
| `recovery-task-table.tsx` | `tasks` prop | `izleme/page.tsx` → `getRecoveryTasks()` → `recovery_tasks` tablosu | Evet — Supabase SELECT ile real DB | FLOWING |
| `izleme/page.tsx` | `recoveryTasks` | `getRecoveryTasks(supabase, id, true)` | Evet — `.from('recovery_tasks').select()` | FLOWING |
| `route.ts` | `inserted/skipped/scanned` | `gsc_metrics` + `project_imported_pages` DB sorguları | Evet — gerçek tablo sorguları | FLOWING |

## Gereksinimlerin Karşılanması

| Gereksinim | Kaynak Plan | Açıklama | Durum | Kanıt |
|------------|-------------|----------|-------|-------|
| REC-01 | 16-01, 16-06 | Sistem pozisyon düşüşü olan sayfaları eşik değere göre otomatik tespit eder | SATISFIED | route.ts: delta>=5 AND impressions>10; migration: tablo ve indexler |
| REC-02 | 16-02, 16-03, 16-04, 16-05 | Tespit edilen decay için ilgili sayfa paketi üzerinde güncelleme görevi otomatik açılır | SATISFIED | recovery_tasks INSERT + izleme Recovery Tab + updateRecoveryTaskStatus + publishToWordPress auto-resolve |
| REC-03 | 16-01, 16-06 | imported pages weak_page + düşük GSC pozisyonu kombinasyonu da recovery kandidatı | SATISFIED | scanImportedPagesWeak: flag_weak_page=true AND gsc_avg_position>20 |

## Anti-Pattern Taraması

Tüm 8 ana artifact dosyası tarandı.

| Dosya | Satır | Pattern | Önem | Etki |
|-------|-------|---------|------|------|
| `izleme/actions.ts` | — | STUB marker yok | — | Temiz — 16-03 stub tam olarak 16-04'te değiştirildi |
| `recovery-task-table.tsx` | 100 | `Tespit edilen pozisyon düşüşü yok` boş durum | — | Kasıtlı boş durum — stub değil |
| `route.ts` | 197 | `if (decayedPageIds.length === 0) return 0` erken çıkış | — | Kasıtlı — gerçek veri yok veya decay yok durumu |

Blocker veya uyarı seviyesinde anti-pattern bulunamadı.

## Behavioral Spot-Checks

Canlı sunucu gerektiren kontroller için SKIPPED — tüm davranış doğrulamaları insan doğrulama bölümüne taşındı.

## İnsan Doğrulama Gereksinimleri

### 1. Recovery Tab UI Render

**Test:** `/projeler/[id]/izleme?tab=recovery` adresine git; ContentTabBar'ın Cluster Performansı, Sayfa Performansı ve Recovery sekmelerini gösterdiğini doğrula; Recovery sekmesine tıkla; boş durum görüntüsünü kontrol et
**Beklenen:** "Tespit edilen pozisyon düşüşü yok — Sayfalar sağlıklı görünüyor." mesajı gösterilir
**İnsan neden gerekli:** UI render ve tab navigasyonu yalnızca tarayıcıda doğrulanabilir

### 2. Dismiss ve Toggle Akışı

**Test:** Supabase Studio'dan test recovery_task row'u ekle (source='page_package', status='open'); sayfayı yenile; satırın kırmızı 'Açık' badge'iyle göründüğünü doğrula; "Görmezden Gel"e tıkla; satırın varsayılan görünümden kalktığını doğrula; "Dismissed görevleri göster" toggle'ına tıkla; satırın gri badge ile geri geldiğini doğrula
**Beklenen:** Dismiss akışı çalışır; dismissed satırlar toggle ile görünür hale gelir
**İnsan neden gerekli:** Etkileşimli client-side state + server action round-trip

### 3. Güncelle Akışı

**Test:** Status='open' bir satır için Güncelle'ye tıkla; URL'in /projeler/[id]/sayfalar'a yönlendiğini doğrula; Supabase'de task status'unun 'in_progress' olduğunu kontrol et
**Beklenen:** Status in_progress güncellenir, yönlendirme /sayfalar'a gider (page_package source için)
**İnsan neden gerekli:** Server action + client navigation — canlı test gerektirir

### 4. n8n / curl Webhook Doğrulaması

**Test:** `curl -X POST http://localhost:3000/api/recovery/detect -H 'Content-Type: application/json' -H 'X-N8n-Webhook-Secret: <secret>' -d '{"projectId":"<gerçek id>","userId":"<gerçek id>"}'`; response shape'ini ve idempotency'i doğrula (ikinci çağrıda inserted:0)
**Beklenen:** `{ inserted: N, skipped: M, scanned: { page_packages: P, imported_pages: Q } }`; ikinci çağrıda inserted:0
**İnsan neden gerekli:** Gerçek GSC verisi ve çalışan ortam gerektirir

### 5. publishToWordPress Auto-Resolve Akışı

**Test:** Test recovery_task (status='open', source='page_package', source_id=gerçek pkg.id) oluştur; publishToWordPress aksiyonunu tetikle; izleme Recovery Tab'ını aç; satırın artık görünmediğini doğrula
**Beklenen:** D-04 hook open/in_progress task'ı resolved'a geçirir; getRecoveryTasks resolved satırı filtreler
**İnsan neden gerekli:** WP publish + Supabase mutation + SSR refresh döngüsü; canlı WP bağlantısı gerektirir

## Gaps Özeti

Boşluk bulunamadı. Tüm 9 doğrulanabilir doğru programatik olarak geçti. 5 insan doğrulama maddesi UI davranışı, etkileşimli akışlar ve canlı dış servis entegrasyonu içerdiğinden insan testi gerektirir — bunlar programatik olarak doğrulanamaz, eksiklik değildir.

---

_Doğrulandı: 2026-04-30T12:00:00Z_
_Doğrulayan: Claude (gsd-verifier)_
