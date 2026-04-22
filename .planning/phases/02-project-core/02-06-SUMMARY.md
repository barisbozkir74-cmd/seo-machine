---
phase: 02-project-core
plan: "06"
subsystem: decision-memory
tags: [next.js, server-action, client-component, supabase, audits, notes, auth-guard]

# Dependency graph
requires:
  - phase: 02-04
    provides: "projeler/[id]/page.tsx — 2 sütunlu detay sayfası"
  - phase: 02-05
    provides: "actions.ts — advanceStage Server Action (bu dosyaya addNote eklendi)"
  - phase: 02-01
    provides: "textarea.tsx, button.tsx bileşenleri"
provides:
  - "src/app/(dashboard)/projeler/[id]/notes-section.tsx — NotesSection Client Component"
  - "src/app/(dashboard)/projeler/[id]/actions.ts — addNote Server Action (audits INSERT)"
affects: [projeler/[id]/page.tsx — notes placeholder yerine NotesSection entegrasyonu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action ownership doğrulaması: stages sorgusunda eq('id', stageId).eq('project_id', projectId).eq('user_id', user.id)"
    - "Defense-in-depth notes sorgusu: RLS + explicit user_id filter aynı anda"
    - "audits tablosu not kaydı: event_type='note', entity_type='stage', entity_id=stageId, payload={content}"
    - "Client Component manual isPending state: useTransition yerine try/finally ile isPending yönetimi"
    - "revalidatePath + Server Component re-render: not eklenince initialNotes prop'u otomatik güncellenir"
    - "TR locale tarih: toLocaleString('tr-TR', {day, month, year, hour, minute})"

key-files:
  created:
    - src/app/(dashboard)/projeler/[id]/notes-section.tsx
  modified:
    - src/app/(dashboard)/projeler/[id]/actions.ts
    - src/app/(dashboard)/projeler/[id]/page.tsx

key-decisions:
  - "user çekimi page.tsx üstüne alındı: getUser() inline yerine tek çağrı ile hem auth kontrolü hem notes sorgusunda kullanım"
  - "addNote stage doğrulaması .single() ile: stageId + projectId + user_id üçlüsünün eşleşmesi gerekiyor; bulunamazsa hata"
  - "activeStage yoksa NotesSection render edilmez: tüm aşamalar tamamlandığında not bölümü gizlenir"
  - "Content max 5000 karakter: T-02-06-03 gereği DoS koruması"

# Metrics
duration: ~8min
completed: 2026-04-22
---

# Phase 2 Plan 06: Karar Hafızası — Not Formu + Audits Tablosu Summary

**Aktif stage için audits tablosuna note INSERT yapan addNote Server Action ve textarea + geçmiş listesi sunan NotesSection Client Component oluşturuldu; detay sayfasına entegre edildi**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T22:14:37Z
- **Completed:** 2026-04-22T22:22:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `src/app/(dashboard)/projeler/[id]/actions.ts` dosyasına `addNote` eklendi
  - `addNote(stageId, projectId, content)` Server Action export'u
  - Content validasyon: boş içerik → "Not içeriği boş olamaz.", max 5000 → "Not en fazla 5000 karakter olabilir." (T-02-06-03)
  - Auth: `supabase.auth.getUser()` — oturum yoksa erken return
  - Stage ownership doğrulaması: `stages` tablosunda `id + project_id + user_id` üçlüsü kontrol (T-02-06-01)
  - audits INSERT: `event_type='note'`, `entity_type='stage'`, `entity_id=stageId`, `payload={content: content.trim()}` (T-02-06-02)
  - `revalidatePath` ile sayfa yenileme
  - `advanceStage` hâlâ mevcut — dosya baştan yazılmadı, fonksiyon eklendi
- `src/app/(dashboard)/projeler/[id]/page.tsx` güncellendi
  - `user` çekimi üste alındı (tek `getUser()` çağrısı, tekrar yok)
  - Aktif stage için `audits` sorgusu: `entity_type + entity_id + project_id + user_id` filtreleriyle (T-02-06-04)
  - `NotesSection` import + placeholder yerine bileşen entegrasyonu
  - `activeStage && user` koşuluyla not sorgusu çalışır; aksi hâlde `data: []`
- `src/app/(dashboard)/projeler/[id]/notes-section.tsx` oluşturuldu
  - `'use client'` direktifi
  - `NotesSection` export'u
  - `content`, `isPending`, `error` state'leri
  - Textarea: placeholder "Bu aşama için notunuzu buraya yazın...", rows=3, disabled=isPending
  - Hata mesajı: `{error && <p className="text-sm text-destructive">{error}</p>}`
  - Submit butonu: "Notu Ekle" / "Kaydediliyor...", disabled koşulları
  - Boş durum: "Bu aşama için henüz not eklenmemiş."
  - Not listesi: border-l-2 border-border pl-3, TR locale tarih, not içeriği
- TypeScript hatasız — `npx tsc --noEmit` temiz

## Task Commits

Her görev atomik olarak commit edildi:

1. **Task T-02-06-01: addNote Server Action + server-side notes query** — `0e9db29` (feat)
2. **Task T-02-06-02: NotesSection Client Component + page.tsx entegrasyonu** — `57137a7` (feat)

## Files Created/Modified

- `src/app/(dashboard)/projeler/[id]/notes-section.tsx` — Client Component; textarea formu, isPending state, hata gösterimi, geçmiş not listesi, TR locale tarih, boş durum mesajı
- `src/app/(dashboard)/projeler/[id]/actions.ts` — addNote Server Action eklendi; content validasyon, auth guard, stage ownership doğrulama, audits INSERT, revalidatePath
- `src/app/(dashboard)/projeler/[id]/page.tsx` — user çekimi üste alındı, initialNotes server query, NotesSection import + entegrasyonu

## Decisions Made

- `user` çekimi `page.tsx` üstüne alındı: Hem auth guard hem notes sorgusunda kullanılacak user.id için tek `getUser()` yeterli; tekrar çağrı gereksiz
- `addNote` stage doğrulaması `.single()` ile: Stage bulunamazsa `data: null` döner ve `'Aşama bulunamadı.'` hata mesajı ile fonksiyon sonlanır
- `activeStage && user` koşulu: İkisi de yoksa (tüm aşamalar tamamlandı veya oturum yok) notes sorgusu çalışmaz, `data: []` döner
- `content.trim()` ile payload: Textarea'daki baştaki/sondaki boşluklar veritabanına yazılmaz

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inline getUser() yerine üstte tek çağrı**
- **Found during:** T-02-06-01 — page.tsx güncelleme
- **Issue:** Plan'daki notes sorgusu örneği `(await supabase.auth.getUser()).data.user?.id` şeklinde inline çağrı öneriyordu. Bu hem verimsiz (ekstra network çağrısı) hem de TypeScript type narrowing açısından daha zayıf.
- **Fix:** `user` değişkeni sayfanın başında bir kez çekildi; her iki sorgu (notes + ownership check) bu referansı kullanıyor.
- **Files modified:** `src/app/(dashboard)/projeler/[id]/page.tsx`
- **Commit:** `0e9db29`

## Known Stubs

Yok — plan hedefi olan not formu ve geçmiş not listesi tam olarak uygulandı.

## Threat Flags

Yeni tehdit yüzeyi eklenmedi — tüm tehditler plan'ın threat_model'inde tanımlanmış ve mitigate edildi:
- T-02-06-01: Stage ownership doğrulaması stages sorgusunda `id + project_id + user_id` üçlüsü ile uygulandı
- T-02-06-02: Content JSONB payload'a parametrize yazıldı, XSS için Next.js JSX escape uyguluyor
- T-02-06-03: Max 5000 karakter kontrolü Server Action'da uygulandı
- T-02-06-04: Notes sorgusu explicit `user_id` filtresiyle + RLS double protection

## User Setup Required

None — harici servis konfigürasyonu gerekmiyor.

## Next Phase Readiness

- Phase 2 tüm planları tamamlandı (02-01 → 02-06)
- Stage engine eksiksiz çalışıyor: Intake → ... → Post-Launch geçişleri + onay dialogu + not kaydetme
- audits tablosu not geçmişi için hazır; gelecek fazlarda farklı event_type'larla genişletilebilir

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/projeler/[id]/notes-section.tsx
- FOUND: src/app/(dashboard)/projeler/[id]/actions.ts (addNote export)
- FOUND: commit 0e9db29
- FOUND: commit 57137a7

---
*Phase: 02-project-core*
*Completed: 2026-04-22*
