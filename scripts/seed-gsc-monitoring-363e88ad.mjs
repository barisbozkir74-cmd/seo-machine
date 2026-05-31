/**
 * GSC monitoring seed scripti — Rüzgar Kesici Shop (363e88ad-451a-4dd3-9a19-65ceeb850e1d)
 *
 * Bu script:
 * 1. Projeye gsc_property_url ekler (GSC bağlantısı simüle)
 * 2. gsc_metrics tablosuna 28 günlük gerçekçi arama performansı verileri yükler
 * 3. recovery_tasks tablosuna pozisyon kaybı örnekleri ekler
 *
 * Çalıştır: node scripts/seed-gsc-monitoring-363e88ad.mjs
 *
 * İdempotent: Script, project'in pages tablosundan mevcut page ID'lerini okur.
 * Duplicate key hatalarını yakalar (UNIQUE(page_id, date, keyword)).
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.')
  process.exit(1)
}

const PROJECT_ID = '363e88ad-451a-4dd3-9a19-65ceeb850e1d'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── 1. Proje varlık kontrolü ──────────────────────────────────────────────────
const { data: project, error: pErr } = await sb
  .from('projects')
  .select('id, name, gsc_property_url')
  .eq('id', PROJECT_ID)
  .single()

if (pErr || !project) {
  console.error('Proje bulunamadı:', pErr)
  process.exit(1)
}
console.log(`✓ Proje: ${project.name}`)

// ── 2. gsc_property_url set ───────────────────────────────────────────────────
if (!project.gsc_property_url) {
  const { error: urlErr } = await sb
    .from('projects')
    .update({ gsc_property_url: 'sc-domain:ruzgarkesicishop.com' })
    .eq('id', PROJECT_ID)
  if (urlErr) { console.error('gsc_property_url güncellenemedi:', urlErr); process.exit(1) }
  console.log('✓ gsc_property_url set: sc-domain:ruzgarkesicishop.com')
} else {
  console.log(`✓ gsc_property_url zaten set: ${project.gsc_property_url}`)
}

// ── 3. Sayfaları ve cluster'ları yükle ───────────────────────────────────────
const { data: pagesRaw, error: pageErr } = await sb
  .from('pages')
  .select('id, title, slug, cluster_id')
  .eq('project_id', PROJECT_ID)

if (pageErr || !pagesRaw) {
  console.error('Sayfalar alınamadı:', pageErr)
  process.exit(1)
}
console.log(`✓ ${pagesRaw.length} sayfa bulundu`)

// Slug → ID map
const pageMap = {}
for (const p of pagesRaw) {
  pageMap[p.slug] = { id: p.id, title: p.title, clusterId: p.cluster_id }
}

// ── 4. Mevcut gsc_metrics kontrolü ───────────────────────────────────────────
const { count: existingCount } = await sb
  .from('gsc_metrics')
  .select('*', { count: 'exact', head: true })
  .eq('project_id', PROJECT_ID)

if (existingCount > 0) {
  console.log(`\n⚠  gsc_metrics zaten ${existingCount} satır içeriyor — üzerine ekleme yapılıyor (UNIQUE çakışmaları atlanır).`)
}

// ── 5. Tarih yardımcıları ─────────────────────────────────────────────────────
/**
 * Returns YYYY-MM-DD for `daysAgo` days before today.
 */
function dateStr(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

/**
 * Generates a sinusoidal trend for positions — lower is better.
 * basePos: average position. range: ±variation. waveLen: days per wave cycle.
 */
function positionTrend(daysAgo, basePos, range, waveLen = 14) {
  const wave = Math.sin((daysAgo / waveLen) * 2 * Math.PI) * range
  return Math.max(1.0, basePos + wave + (Math.random() - 0.5) * 0.5)
}

function clicksFromImpressions(impressions, ctrBase) {
  const ctr = ctrBase + (Math.random() - 0.5) * 0.01
  return Math.max(0, Math.round(impressions * ctr))
}

// ── 6. Sayfa performans tanımları ─────────────────────────────────────────────
// Her sayfa için: basePosition (ort. arama pozisyonu), dailyImpressions, ctr, keywords
// Veriler Türkiye pazarı + rüzgar kesici niş için gerçekçi değerler içerir.
// "prior" period (28-56 gün önce) ile "current" period (0-28 gün) arasında
// bazı sayfalarda pozisyon iyileşmesi, bazılarında düşüş simüle edilir.

const pagePerformanceDefs = [
  {
    slug: '/',
    // Ana sayfa: orta pozisyon, yüksek gösterim, brand sorgular dominant
    currentPos: 4.2,
    priorPos: 5.1,   // improved
    dailyImpressions: 180,
    ctr: 0.042,
    keywords: [
      { keyword: 'rüzgar kesici', ctrMulti: 2.2, posOffset: 0 },
      { keyword: 'rüzgar kesici shop', ctrMulti: 3.5, posOffset: -2 },
      { keyword: 'windshield türkiye', ctrMulti: 1.8, posOffset: 1 },
      { keyword: 'rüzgar kesici mağaza', ctrMulti: 2.0, posOffset: 0.5 },
    ],
  },
  {
    slug: 'urunler',
    // Kategori hub: yüksek gösterim, orta pozisyon
    currentPos: 6.8,
    priorPos: 7.4,   // slightly improved
    dailyImpressions: 140,
    ctr: 0.028,
    keywords: [
      { keyword: 'rüzgar kesici modelleri', ctrMulti: 1.8, posOffset: 0 },
      { keyword: 'rüzgar kesici fiyat', ctrMulti: 1.2, posOffset: 1 },
      { keyword: 'rüzgar tutucusu fiyat', ctrMulti: 1.0, posOffset: 2 },
      { keyword: 'windshield fiyat', ctrMulti: 0.9, posOffset: 1.5 },
    ],
  },
  {
    slug: 'urunler/pistonlu-ruzgar-kesici',
    // En iyi performans: düşük pozisyon (iyi), yüksek CTR
    currentPos: 2.8,
    priorPos: 4.2,   // strong improvement
    dailyImpressions: 95,
    ctr: 0.085,
    keywords: [
      { keyword: 'pistonlu rüzgar kesici', ctrMulti: 3.2, posOffset: 0 },
      { keyword: 'motorlu rüzgar tutucusu', ctrMulti: 2.8, posOffset: 0.5 },
      { keyword: 'pistonlu rüzgar kesici fiyat', ctrMulti: 2.5, posOffset: -0.5 },
      { keyword: 'otomatik rüzgar kesici', ctrMulti: 2.2, posOffset: 1 },
    ],
  },
  {
    slug: 'urunler/uzaktan-kumandali-ruzgar-kesici',
    // Premium ürün: en iyi pozisyon, yüksek CTR
    currentPos: 1.9,
    priorPos: 2.4,   // improved
    dailyImpressions: 68,
    ctr: 0.11,
    keywords: [
      { keyword: 'uzaktan kumandalı rüzgar kesici', ctrMulti: 4.0, posOffset: 0 },
      { keyword: 'akıllı rüzgar kesici', ctrMulti: 3.2, posOffset: 0.5 },
      { keyword: 'remote control windshield', ctrMulti: 2.8, posOffset: 1 },
    ],
  },
  {
    slug: 'urunler/manuel-ruzgar-kesici',
    // Düşüş yaşıyor (recovery task için)
    currentPos: 9.1,
    priorPos: 3.8,   // DECAY — pozisyon kötüleşti (yüksek numara = kötü)
    dailyImpressions: 112,
    ctr: 0.018,
    keywords: [
      { keyword: 'manuel rüzgar kesici', ctrMulti: 1.4, posOffset: 0 },
      { keyword: 'elle açılan rüzgar kesici', ctrMulti: 1.1, posOffset: 1 },
      { keyword: 'ekonomik rüzgar kesici', ctrMulti: 0.9, posOffset: 2 },
    ],
  },
  {
    slug: 'hizmetler/montaj',
    // Montaj hizmeti: orta pozisyon, yüksek dönüşüm
    currentPos: 5.4,
    priorPos: 5.9,   // slightly improved
    dailyImpressions: 58,
    ctr: 0.062,
    keywords: [
      { keyword: 'rüzgar kesici montaj hizmeti', ctrMulti: 3.8, posOffset: 0 },
      { keyword: 'rüzgar kesici montaj', ctrMulti: 2.4, posOffset: 1 },
      { keyword: 'profesyonel montaj rüzgar kesici', ctrMulti: 2.2, posOffset: 0.5 },
    ],
  },
  {
    slug: 'kullanim-alanlari/restoran',
    // Kullanım alanı sayfası: yeni, düşük ama iyileşiyor
    currentPos: 8.2,
    priorPos: 13.5,  // strong improvement (newly indexed)
    dailyImpressions: 44,
    ctr: 0.031,
    keywords: [
      { keyword: 'restoran rüzgar kesici', ctrMulti: 2.6, posOffset: 0 },
      { keyword: 'restoran teras rüzgar koruması', ctrMulti: 2.2, posOffset: 1 },
      { keyword: 'kafe rüzgar kesici', ctrMulti: 1.8, posOffset: 2 },
    ],
  },
  {
    slug: 'blog/ruzgar-kesici-nasil-calisir',
    // Blog: yüksek gösterim, düşük pozisyon, trafik kaybı yaşıyor
    currentPos: 12.4,
    priorPos: 7.1,   // DECAY
    dailyImpressions: 86,
    ctr: 0.012,
    keywords: [
      { keyword: 'rüzgar kesici nasıl çalışır', ctrMulti: 1.6, posOffset: 0 },
      { keyword: 'rüzgar kesici ne işe yarar', ctrMulti: 1.2, posOffset: 2 },
      { keyword: 'rüzgar kesici avantajları', ctrMulti: 1.1, posOffset: 3 },
    ],
  },
  {
    slug: 'hakkimizda',
    // Hakkımızda: düşük trafik, stabil
    currentPos: 6.1,
    priorPos: 6.3,
    dailyImpressions: 12,
    ctr: 0.025,
    keywords: [
      { keyword: 'rüzgar kesici shop hakkında', ctrMulti: 2.0, posOffset: 0 },
      { keyword: 'rüzgarkesicishop.com', ctrMulti: 3.5, posOffset: -3 },
    ],
  },
  {
    slug: 'kullanim-alanlari/kafe',
    // Kafe kullanım alanı: yeni sayfa, iyileşiyor
    currentPos: 9.6,
    priorPos: 15.2,  // recently indexed, improving
    dailyImpressions: 32,
    ctr: 0.026,
    keywords: [
      { keyword: 'kafe teras rüzgar koruması', ctrMulti: 2.8, posOffset: 0 },
      { keyword: 'kafe açık alan rüzgar kesici', ctrMulti: 2.2, posOffset: 1 },
    ],
  },
  {
    slug: 'kullanim-alanlari/otel',
    // Otel kullanım alanı: stabil, orta pozisyon
    currentPos: 11.2,
    priorPos: 11.8,
    dailyImpressions: 24,
    ctr: 0.02,
    keywords: [
      { keyword: 'otel açık alan rüzgar kesici', ctrMulti: 2.4, posOffset: 0 },
      { keyword: 'havuzbaşı rüzgar koruması', ctrMulti: 1.8, posOffset: 2 },
    ],
  },
  {
    slug: 'montaj-hizmeti',
    // Montaj hizmeti alt sayfası: yüksek niyet, iyi CTR
    currentPos: 4.1,
    priorPos: 4.8,   // improved
    dailyImpressions: 38,
    ctr: 0.072,
    keywords: [
      { keyword: 'rüzgar kesici montaj istanbul', ctrMulti: 3.2, posOffset: 0 },
      { keyword: 'rüzgar kesici kurulum', ctrMulti: 2.6, posOffset: 1 },
    ],
  },
  {
    slug: 'teklif-al',
    // Teklif formu: düşük hacim, yüksek niyet
    currentPos: 7.3,
    priorPos: 8.1,   // slightly improved
    dailyImpressions: 18,
    ctr: 0.055,
    keywords: [
      { keyword: 'rüzgar kesici fiyat teklifi', ctrMulti: 4.0, posOffset: 0 },
      { keyword: 'rüzgar kesici teklif al', ctrMulti: 3.8, posOffset: 0.5 },
    ],
  },
  {
    slug: 'blog/restoran-ruzgar-kesici-secimi',
    // Blog: bilgi odaklı, düşük trafik
    currentPos: 14.1,
    priorPos: 14.8,
    dailyImpressions: 28,
    ctr: 0.009,
    keywords: [
      { keyword: 'restoran için doğru rüzgar kesici', ctrMulti: 1.4, posOffset: 0 },
      { keyword: 'restoran teras çözüm', ctrMulti: 1.1, posOffset: 2 },
    ],
  },
]

// ── 7. gsc_metrics satırlarını oluştur ────────────────────────────────────────
// Her sayfa için current (son 28 gün) + prior (28-56 gün) periyot
// Günlük keyword bazlı satırlar eklenir.

const metricsRows = []

for (const def of pagePerformanceDefs) {
  const pageEntry = pageMap[def.slug]
  if (!pageEntry) {
    console.warn(`  ⚠ Sayfa bulunamadı, atlanıyor: ${def.slug}`)
    continue
  }
  const pageId = pageEntry.id

  // Current period: son 28 gün (1..28 gün önce)
  for (let d = 1; d <= 28; d++) {
    const date = dateStr(d)

    for (const kw of def.keywords) {
      const pos = positionTrend(d, def.currentPos + kw.posOffset, 1.2)
      const impressions = Math.round(
        (def.dailyImpressions / def.keywords.length) * (0.8 + Math.random() * 0.4)
      )
      const ctr = def.ctr * kw.ctrMulti * (0.85 + Math.random() * 0.3)
      const clicks = clicksFromImpressions(impressions, ctr)

      metricsRows.push({
        project_id: PROJECT_ID,
        page_id: pageId,
        date,
        keyword: kw.keyword,
        clicks,
        impressions,
        avg_position: Math.round(pos * 100) / 100,
      })
    }
  }

  // Prior period: 29-56 gün önce
  for (let d = 29; d <= 56; d++) {
    const date = dateStr(d)
    // prior period uses priorPos
    const priorRange = Math.abs(def.priorPos - def.currentPos) * 0.3 + 0.8

    for (const kw of def.keywords) {
      const pos = positionTrend(d, def.priorPos + kw.posOffset, priorRange)
      const impressions = Math.round(
        (def.dailyImpressions / def.keywords.length) * (0.8 + Math.random() * 0.4)
      )
      const ctr = def.ctr * kw.ctrMulti * (0.85 + Math.random() * 0.3)
      const clicks = clicksFromImpressions(impressions, ctr)

      metricsRows.push({
        project_id: PROJECT_ID,
        page_id: pageId,
        date,
        keyword: kw.keyword,
        clicks,
        impressions,
        avg_position: Math.round(pos * 100) / 100,
      })
    }
  }
}

console.log(`  Oluşturulan metrik satırı: ${metricsRows.length}`)

// Batch insert (500'er gruplar halinde)
const BATCH_SIZE = 500
let insertedTotal = 0
let skippedTotal = 0

for (let i = 0; i < metricsRows.length; i += BATCH_SIZE) {
  const batch = metricsRows.slice(i, i + BATCH_SIZE)
  const { data: insertedData, error: insertErr } = await sb
    .from('gsc_metrics')
    .upsert(batch, { onConflict: 'page_id,date,keyword', ignoreDuplicates: true })
    .select('id')

  if (insertErr) {
    console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} hatası:`, insertErr)
    process.exit(1)
  }
  const batchInserted = insertedData?.length ?? 0
  const batchSkipped = batch.length - batchInserted
  insertedTotal += batchInserted
  skippedTotal += batchSkipped
}

console.log(`✓ gsc_metrics: ${insertedTotal} satır eklendi, ${skippedTotal} mevcut satır atlandı`)

// ── 8. Recovery tasks ─────────────────────────────────────────────────────────
// 2 sayfa decay yaşıyor: manuel rüzgar kesici (9.1 → 3.8) ve blog (12.4 → 7.1)
// Bunlara recovery_tasks ekliyoruz.

// Önce mevcut recovery_tasks kontrolü
const { count: existingRecovery } = await sb
  .from('recovery_tasks')
  .select('*', { count: 'exact', head: true })
  .eq('project_id', PROJECT_ID)

if (existingRecovery > 0) {
  console.log(`✓ recovery_tasks zaten ${existingRecovery} görev içeriyor — ekleme atlanıyor`)
} else {
  const manuelPageId = pageMap['urunler/manuel-ruzgar-kesici']?.id
  const blogPageId = pageMap['blog/ruzgar-kesici-nasil-calisir']?.id

  const recoveryRows = []

  if (manuelPageId) {
    recoveryRows.push({
      project_id: PROJECT_ID,
      source: 'page_package',
      source_id: manuelPageId,   // page_id kullanıyoruz (page_package.id yok ise fallback)
      title: 'Manuel Rüzgar Kesici',
      page_url: '/urunler/manuel-ruzgar-kesici',
      position_before: 3.8,
      position_after: 9.1,
      status: 'open',
      detected_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    })
  }

  if (blogPageId) {
    recoveryRows.push({
      project_id: PROJECT_ID,
      source: 'page_package',
      source_id: blogPageId,
      title: 'Rüzgar Kesici Nasıl Çalışır?',
      page_url: '/blog/ruzgar-kesici-nasil-calisir',
      position_before: 7.1,
      position_after: 12.4,
      status: 'open',
      detected_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    })
  }

  if (recoveryRows.length > 0) {
    const { error: recErr } = await sb.from('recovery_tasks').insert(recoveryRows)
    if (recErr) { console.error('Recovery tasks hatası:', recErr); process.exit(1) }
    console.log(`✓ ${recoveryRows.length} recovery task eklendi`)
  }
}

// ── 9. Özet ───────────────────────────────────────────────────────────────────
console.log('\n═════════════════════════════════════════════════════════')
console.log(`Proje      : Rüzgar Kesici Shop`)
console.log(`ID         : ${PROJECT_ID}`)
console.log(`GSC domain : sc-domain:ruzgarkesicishop.com`)
console.log('─────────────────────────────────────────────────────────')
console.log('İzleme sayfası artık şunları gösterir:')
console.log('  • KPI bar: Tıklama / Gösterim / Düşen Sayfa / Açık Görev')
console.log('  • Cluster Performansı tab: 6 cluster ile tıklama + pozisyon')
console.log('  • Sayfa Performansı tab: 9 sayfa — 2 düşüş, 2 güçlü iyileşme')
console.log('  • Recovery tab: 2 açık görev (manuel + blog)')
console.log('═════════════════════════════════════════════════════════')
