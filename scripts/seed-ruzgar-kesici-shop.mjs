/**
 * Demo proje seed scripti — Rüzgar Kesici Shop
 * Sektör: Açık Alan Ekipmanları / Rüzgar Kesici
 * Senaryo: yeni site, Türkiye pazarı, ürün + montaj hizmeti
 *
 * Çalıştır: node scripts/seed-ruzgar-kesici-shop.mjs
 *
 * İdempotent: Aynı domain ile proje varsa işlem atlanır.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_EMAIL = 'barisbozkir74@gmail.com'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── 1. Kullanıcıyı bul ─────────────────────────────────────────────────────────
const { data: { users }, error: userErr } = await sb.auth.admin.listUsers()
if (userErr) { console.error('Kullanıcılar alınamadı:', userErr); process.exit(1) }
const user = users.find(u => u.email === USER_EMAIL)
if (!user) { console.error(`Kullanıcı bulunamadı: ${USER_EMAIL}`); process.exit(1) }
const userId = user.id
console.log(`✓ Kullanıcı: ${userId} (${USER_EMAIL})`)

// ── 2. İdempotent kontrol ──────────────────────────────────────────────────────
const DEMO_DOMAIN = 'ruzgarkesicishop.com'
const { data: existing } = await sb
  .from('projects')
  .select('id')
  .eq('domain', DEMO_DOMAIN)
  .eq('user_id', userId)
  .maybeSingle()

if (existing) {
  console.log(`\n⚠  Proje zaten mevcut — atlanıyor.`)
  console.log('─────────────────────────────────────────')
  console.log(`Proje ID : ${existing.id}`)
  console.log(`URL      : http://localhost:3030/projeler/${existing.id}`)
  console.log('─────────────────────────────────────────')
  process.exit(0)
}

// ── 3. Proje oluştur ───────────────────────────────────────────────────────────
const { data: project, error: pErr } = await sb.from('projects').insert({
  user_id: userId,
  name: 'Rüzgar Kesici Shop',
  domain: DEMO_DOMAIN,
  sector: 'Açık Alan Ekipmanları / Rüzgar Kesici',
  target_country: 'TR',
  target_language: 'tr',
  business_model: 'ürün satışı + teklif talebi + montaj hizmeti',
  site_type: 'new_site',
  brand_tone: 'güven veren, pratik, ticari, modern',
  notes: "Türkiye'nin önde gelen rüzgar kesici (windshield) mağazası. Manuel, pistonlu ve uzaktan kumandalı modeller. Restoran, kafe, otel, villa ve açık alan tesisleri için profesyonel çözümler.",
  current_stage: 'blueprint',
  status: 'active',
  target_customer: 'Restoran, kafe, otel ve villa sahipleri; açık alan tesisi işleten ticari işletmeler; terası olan ev sahipleri',
  main_goal: 'Rüzgar kesici ürün ve montaj hizmeti için organik arama trafiği elde etmek, teklif talebi formlarını dönüştürmek',
  initial_competitors: 'windshield.com.tr, ruzgarkesici.net, acikalanmarket.com',
  target_keywords: 'rüzgar kesici, rüzgar tutucusu, windshield, açık alan rüzgar koruması, pistonlu rüzgar kesici, uzaktan kumandalı rüzgar kesici',
  research_approved: true,
  keyword_strategy_approved: true,
  blueprint_approved: true,
  technical_audit_approved: false,
}).select('id').single()
if (pErr) { console.error('Proje oluşturulamadı:', pErr); process.exit(1) }
const projectId = project.id
console.log(`✓ Proje oluşturuldu: ${projectId}`)

// ── 4. Stage'leri oluştur ──────────────────────────────────────────────────────
const STAGE_NAMES = [
  'Proje Bilgileri', 'Araştırma', 'Keyword Stratejisi', 'Site Blueprint',
  'Sayfa Planlaması', 'Sayfa Paketi', 'İçerik Üretimi', 'SEO Denetimi',
  'Yayın Hazırlığı', 'Yayın Sonrası',
]
const stageRows = STAGE_NAMES.map((stage_name, i) => ({
  user_id: userId,
  project_id: projectId,
  stage_name,
  // 0=Proje Bilgileri, 1=Araştırma, 2=Keyword Stratejisi tamamlandı; 3=Site Blueprint aktif
  status: i < 3 ? 'completed' : i === 3 ? 'active' : 'pending',
  started_at: i <= 3 ? new Date(Date.now() - (10 - i) * 86400000).toISOString() : null,
  completed_at: i < 3 ? new Date(Date.now() - (10 - i - 1) * 86400000).toISOString() : null,
}))
const { error: stageErr } = await sb.from('stages').insert(stageRows)
if (stageErr) { console.error('Stage hatası:', stageErr); process.exit(1) }
console.log('✓ Stages oluşturuldu')

// ── 5. Rakipler ────────────────────────────────────────────────────────────────
const competitorDefs = [
  {
    domain: 'windshield.com.tr',
    ranked_keywords: [
      { keyword: 'rüzgar kesici', position: 2, search_volume: 8100 },
      { keyword: 'cam rüzgar kesici', position: 3, search_volume: 2400 },
      { keyword: 'açık alan rüzgar koruması', position: 4, search_volume: 1600 },
      { keyword: 'restoran rüzgar kesici', position: 5, search_volume: 1200 },
    ],
    category_structure: {
      'Cam Modeller': { pageCount: 8, avgPosition: 4.2, totalClicks: 2800, totalEtv: 7200 },
      'Alüminyum Modeller': { pageCount: 6, avgPosition: 6.1, totalClicks: 1400, totalEtv: 3100 },
    },
    backlinks_summary: {
      total_backlinks: 210,
      referring_domains: 44,
      domain_rating: 28,
    },
  },
  {
    domain: 'ruzgarkesici.net',
    ranked_keywords: [
      { keyword: 'pistonlu rüzgar kesici', position: 1, search_volume: 1900 },
      { keyword: 'motorlu rüzgar tutucusu', position: 2, search_volume: 880 },
      { keyword: 'rüzgar kesici fiyat', position: 6, search_volume: 3200 },
    ],
    category_structure: {
      'Pistonlu Sistemler': { pageCount: 5, avgPosition: 2.8, totalClicks: 3400, totalEtv: 9100 },
      'Montaj Hizmeti': { pageCount: 3, avgPosition: 7.5, totalClicks: 620, totalEtv: 1400 },
    },
    backlinks_summary: {
      total_backlinks: 95,
      referring_domains: 18,
      domain_rating: 16,
    },
  },
  {
    domain: 'acikalanmarket.com',
    ranked_keywords: [
      { keyword: 'açık alan ekipmanları', position: 3, search_volume: 4400 },
      { keyword: 'teras aksesuarları', position: 7, search_volume: 2900 },
    ],
    category_structure: {
      'Açık Alan Genel': { pageCount: 22, avgPosition: 9.1, totalClicks: 1100, totalEtv: 2600 },
    },
    backlinks_summary: {
      total_backlinks: 530,
      referring_domains: 87,
      domain_rating: 35,
    },
  },
]

for (const c of competitorDefs) {
  const { error: cErr } = await sb.from('competitors').insert({
    user_id: userId,
    project_id: projectId,
    source: 'manual',
    domain: c.domain,
    ranked_keywords: c.ranked_keywords,
    category_structure: c.category_structure,
    backlinks_summary: c.backlinks_summary,
  })
  if (cErr) { console.error(`Rakip hatası (${c.domain}):`, cErr); process.exit(1) }
}
console.log('✓ Rakipler eklendi')

// ── 6. Keyword'ler ─────────────────────────────────────────────────────────────
const keywordDefs = [
  // Ana ticari sorgular
  { keyword: 'rüzgar kesici', volume: 8100, cpc: 1.40, difficulty: 42, search_intent: 'commercial', long_tail_flag: false },
  { keyword: 'rüzgar tutucusu', volume: 4400, cpc: 1.25, difficulty: 38, search_intent: 'commercial', long_tail_flag: false },
  { keyword: 'windshield', volume: 3600, cpc: 1.10, difficulty: 44, search_intent: 'commercial', long_tail_flag: false },
  { keyword: 'açık alan rüzgar koruması', volume: 1600, cpc: 1.55, difficulty: 35, search_intent: 'commercial', long_tail_flag: true },
  // Ürün tipi sorguları
  { keyword: 'pistonlu rüzgar kesici', volume: 1900, cpc: 1.80, difficulty: 30, search_intent: 'commercial', long_tail_flag: true },
  { keyword: 'uzaktan kumandalı rüzgar kesici', volume: 1200, cpc: 2.10, difficulty: 28, search_intent: 'transactional', long_tail_flag: true },
  { keyword: 'manuel rüzgar kesici', volume: 2200, cpc: 1.30, difficulty: 32, search_intent: 'commercial', long_tail_flag: true },
  { keyword: 'motorlu rüzgar tutucusu', volume: 880, cpc: 1.95, difficulty: 26, search_intent: 'transactional', long_tail_flag: true },
  // Kullanım alanı sorguları
  { keyword: 'restoran rüzgar kesici', volume: 1200, cpc: 1.65, difficulty: 22, search_intent: 'commercial', long_tail_flag: true },
  { keyword: 'kafe teras rüzgar koruması', volume: 720, cpc: 1.50, difficulty: 18, search_intent: 'commercial', long_tail_flag: true },
  { keyword: 'otel açık alan rüzgar kesici', volume: 480, cpc: 1.85, difficulty: 15, search_intent: 'commercial', long_tail_flag: true },
  // Fiyat ve bilgi sorguları
  { keyword: 'rüzgar kesici fiyat', volume: 3200, cpc: 0.90, difficulty: 40, search_intent: 'commercial', long_tail_flag: false },
  { keyword: 'rüzgar kesici montaj', volume: 1400, cpc: 1.20, difficulty: 28, search_intent: 'commercial', long_tail_flag: true },
  { keyword: 'rüzgar kesici nasıl çalışır', volume: 960, cpc: 0.60, difficulty: 22, search_intent: 'informational', faq_flag: true },
  { keyword: 'rüzgar kesici modelleri', volume: 2100, cpc: 1.10, difficulty: 36, search_intent: 'commercial', long_tail_flag: false },
  // Montaj / hizmet sorguları
  { keyword: 'rüzgar kesici montaj hizmeti', volume: 640, cpc: 1.75, difficulty: 20, search_intent: 'transactional', long_tail_flag: true },
  { keyword: 'teras rüzgar kesici', volume: 1700, cpc: 1.30, difficulty: 30, search_intent: 'commercial', long_tail_flag: true },
  { keyword: 'bahçe rüzgar kesici', volume: 980, cpc: 1.15, difficulty: 28, search_intent: 'commercial', long_tail_flag: true },
]

const kwRows = keywordDefs.map(k => ({
  user_id: userId,
  project_id: projectId,
  source: 'manual',
  keyword: k.keyword,
  volume: k.volume,
  cpc: k.cpc,
  difficulty: k.difficulty,
  search_intent: k.search_intent,
  opportunity_score: Math.round((k.volume / 1000) * (1 - k.difficulty / 100) * 100) / 100,
  long_tail_flag: k.long_tail_flag ?? false,
  faq_flag: k.faq_flag ?? false,
  comparison_flag: false,
  local_flag: false,
  is_starred: ['rüzgar kesici', 'pistonlu rüzgar kesici', 'uzaktan kumandalı rüzgar kesici'].includes(k.keyword),
  is_ai_suggested: false,
}))

const { data: insertedKws, error: kwErr } = await sb.from('keywords').insert(kwRows).select('id, keyword')
if (kwErr) { console.error('Keyword hatası:', kwErr); process.exit(1) }
console.log(`✓ ${insertedKws.length} keyword eklendi`)

const kwMap = Object.fromEntries(insertedKws.map(k => [k.keyword, k.id]))

// ── 7. Cluster'lar ─────────────────────────────────────────────────────────────
const clusterDefs = [
  {
    name: 'Rüzgar Kesici Genel',
    tier: 'pillar',
    focus: 'rüzgar kesici',
    intent: 'commercial',
    revenue_type: 'direct',
    build_priority: 'high',
    keywords: ['rüzgar kesici', 'rüzgar tutucusu', 'windshield', 'rüzgar kesici modelleri', 'rüzgar kesici fiyat'],
  },
  {
    name: 'Pistonlu Rüzgar Kesici',
    tier: 'cluster',
    focus: 'pistonlu rüzgar kesici',
    intent: 'commercial',
    revenue_type: 'direct',
    build_priority: 'high',
    keywords: ['pistonlu rüzgar kesici', 'motorlu rüzgar tutucusu'],
  },
  {
    name: 'Uzaktan Kumandalı Rüzgar Kesici',
    tier: 'cluster',
    focus: 'uzaktan kumandalı rüzgar kesici',
    intent: 'transactional',
    revenue_type: 'direct',
    build_priority: 'high',
    keywords: ['uzaktan kumandalı rüzgar kesici'],
  },
  {
    name: 'Manuel Rüzgar Kesici',
    tier: 'cluster',
    focus: 'manuel rüzgar kesici',
    intent: 'commercial',
    revenue_type: 'direct',
    build_priority: 'medium',
    keywords: ['manuel rüzgar kesici'],
  },
  {
    name: 'Kullanım Alanları',
    tier: 'supporting',
    focus: 'restoran rüzgar kesici',
    intent: 'commercial',
    revenue_type: 'lead',
    build_priority: 'medium',
    keywords: ['restoran rüzgar kesici', 'kafe teras rüzgar koruması', 'otel açık alan rüzgar kesici', 'teras rüzgar kesici', 'bahçe rüzgar kesici'],
  },
  {
    name: 'Montaj Hizmeti',
    tier: 'supporting',
    focus: 'rüzgar kesici montaj',
    intent: 'transactional',
    revenue_type: 'lead',
    build_priority: 'medium',
    keywords: ['rüzgar kesici montaj', 'rüzgar kesici montaj hizmeti'],
  },
  {
    name: 'Bilgi & Rehber',
    tier: 'supporting',
    focus: 'rüzgar kesici nasıl çalışır',
    intent: 'informational',
    revenue_type: 'authority',
    build_priority: 'low',
    keywords: ['rüzgar kesici nasıl çalışır', 'açık alan rüzgar koruması'],
  },
]

const clusterIds = {}
for (const c of clusterDefs) {
  const primaryId = kwMap[c.focus]
  const totalVolume = c.keywords.reduce((sum, kw) => {
    const k = keywordDefs.find(d => d.keyword === kw)
    return sum + (k?.volume ?? 0)
  }, 0)

  const { data: cluster, error: cErr } = await sb.from('keyword_clusters').insert({
    user_id: userId,
    project_id: projectId,
    cluster_name: c.name,
    primary_keyword_id: primaryId,
    intent: c.intent,
    total_volume: totalVolume,
    revenue_type: c.revenue_type,
    opportunity_score: Math.round((totalVolume / 1000) * 10) / 10,
    build_priority: c.build_priority,
    link_tier: c.tier,
    status: 'approved',
    arch_status: 'approved',
    cannibalization_status: 'clean',
    priority_rank: clusterDefs.indexOf(c) + 1,
  }).select('id').single()
  if (cErr) { console.error(`Cluster hatası (${c.name}):`, cErr); process.exit(1) }
  clusterIds[c.name] = cluster.id

  // Keyword'leri cluster'a bağla
  const updates = c.keywords.filter(kw => kwMap[kw]).map(kw =>
    sb.from('keywords').update({ cluster_id: cluster.id }).eq('id', kwMap[kw])
  )
  await Promise.all(updates)
}
console.log('✓ Cluster\'lar oluşturuldu')

// ── 8. Business Entities ───────────────────────────────────────────────────────
const entityDefs = [
  // Kategoriler
  {
    type: 'category',
    name: 'Manuel Rüzgar Kesici',
    description: 'Elle açılıp kapanan, tekerlek veya ankraj ile sabitlenen ekonomik modeller.',
    seo_intent: 'commercial',
    primary_keyword: 'manuel rüzgar kesici',
    target_url: '/urunler/manuel-ruzgar-kesici',
    is_primary: false,
    sort_order: 1,
  },
  {
    type: 'category',
    name: 'Pistonlu Rüzgar Kesici',
    description: 'Piston sistemi ile otomatik açılıp kapanan, yüksek trafik alanları için ideal modeller.',
    seo_intent: 'commercial',
    primary_keyword: 'pistonlu rüzgar kesici',
    target_url: '/urunler/pistonlu-ruzgar-kesici',
    is_primary: true,
    sort_order: 2,
  },
  {
    type: 'category',
    name: 'Uzaktan Kumandalı Rüzgar Kesici',
    description: 'Uzaktan kumanda veya uygulama ile kontrol edilen premium akıllı modeller.',
    seo_intent: 'transactional',
    primary_keyword: 'uzaktan kumandalı rüzgar kesici',
    target_url: '/urunler/uzaktan-kumandali-ruzgar-kesici',
    is_primary: false,
    sort_order: 3,
  },
  // Ürün varyantları
  {
    type: 'product',
    name: 'Tekerlekli Model',
    description: 'Taşınabilir, tekerlekli taban ile kolayca konumlandırılabilen rüzgar kesici.',
    seo_intent: 'commercial',
    primary_keyword: 'tekerlekli rüzgar kesici',
    target_url: '/urunler/tekerlekli-ruzgar-kesici',
    is_primary: false,
    sort_order: 4,
    attributes: { variant_type: 'tekerlekli', installation: 'taşınabilir' },
  },
  {
    type: 'product',
    name: 'Yere Sabitlenen Model',
    description: 'Zemine ankraj ile sabit montaj edilen, dayanıklı rüzgar kesici modeli.',
    seo_intent: 'transactional',
    primary_keyword: 'sabit rüzgar kesici montaj',
    target_url: '/urunler/sabit-ruzgar-kesici',
    is_primary: false,
    sort_order: 5,
    attributes: { variant_type: 'sabit', installation: 'ankraj' },
  },
  // Hizmetler
  {
    type: 'service',
    name: 'Montaj Hizmeti',
    description: 'Türkiye genelinde profesyonel rüzgar kesici montaj ve kurulum hizmeti.',
    seo_intent: 'transactional',
    primary_keyword: 'rüzgar kesici montaj hizmeti',
    target_url: '/hizmetler/montaj',
    is_primary: true,
    sort_order: 6,
  },
  // Kullanım alanları (service_area olarak)
  {
    type: 'service_area',
    name: 'Restoranlar',
    description: 'Restoran açık alan terası için rüzgar kesici çözümleri.',
    seo_intent: 'commercial',
    primary_keyword: 'restoran rüzgar kesici',
    target_url: '/kullanim-alanlari/restoran',
    is_primary: false,
    sort_order: 7,
  },
  {
    type: 'service_area',
    name: 'Kafeler',
    description: 'Kafe terası için rüzgar koruması çözümleri.',
    seo_intent: 'commercial',
    primary_keyword: 'kafe teras rüzgar koruması',
    target_url: '/kullanim-alanlari/kafe',
    is_primary: false,
    sort_order: 8,
  },
  {
    type: 'service_area',
    name: 'Oteller',
    description: 'Otel havuzbaşı ve açık alan için rüzgar kesici sistemleri.',
    seo_intent: 'commercial',
    primary_keyword: 'otel açık alan rüzgar kesici',
    target_url: '/kullanim-alanlari/otel',
    is_primary: false,
    sort_order: 9,
  },
  // USP
  {
    type: 'usp',
    name: 'Türkiye Geneli Montaj',
    description: '81 ilde profesyonel montaj ekibi ile hızlı kurulum garantisi.',
    seo_intent: 'local',
    primary_keyword: 'rüzgar kesici montaj',
    target_url: null,
    is_primary: false,
    sort_order: 10,
    attributes: { coverage: 'Türkiye geneli', guarantee: '2 yıl garanti' },
  },
]

for (const e of entityDefs) {
  const { error: eErr } = await sb.from('business_entities').insert({
    user_id: userId,
    project_id: projectId,
    type: e.type,
    name: e.name,
    description: e.description,
    seo_intent: e.seo_intent,
    primary_keyword: e.primary_keyword,
    target_url: e.target_url ?? null,
    is_primary: e.is_primary,
    sort_order: e.sort_order,
    attributes: e.attributes ?? {},
    status: 'active',
  })
  if (eErr) { console.error(`Business entity hatası (${e.name}):`, eErr); process.exit(1) }
}
console.log('✓ Business entities oluşturuldu')

// ── 9. Sayfalar ────────────────────────────────────────────────────────────────
const pageDefs = [
  {
    title: 'Ana Sayfa — Rüzgar Kesici Mağazası',
    slug: '/',
    page_type: 'home',
    cluster: null,
    focus: null,
    priority: 'high',
    seo_title: 'Rüzgar Kesici Mağazası | Manuel, Pistonlu & Uzaktan Kumandalı Modeller',
    meta_description: "Türkiye'nin önde gelen rüzgar kesici mağazası. Manuel, pistonlu ve uzaktan kumandalı modeller. Restoran, kafe, otel ve villa için profesyonel çözümler. Türkiye geneli montaj.",
    h1: 'Rüzgar Kesici Sistemleri — Profesyonel Açık Alan Çözümleri',
    schema_type: 'WebSite',
    strategic_purpose: 'Ana marka sayfası; ürün kategorilerine ve montaj hizmetine trafik yönlendirir',
    search_intent: 'navigational',
    status: 'draft',
  },
  {
    title: 'Rüzgar Kesici Ürünleri',
    slug: 'urunler',
    page_type: 'category',
    cluster: 'Rüzgar Kesici Genel',
    focus: 'rüzgar kesici',
    priority: 'high',
    seo_title: 'Rüzgar Kesici Modelleri ve Fiyatları | Tüm Çeşitler',
    meta_description: 'Manuel, pistonlu ve uzaktan kumandalı rüzgar kesici modelleri. Restoran, kafe ve villa için uygun fiyatlı açık alan rüzgar koruması çözümleri.',
    h1: 'Rüzgar Kesici Modelleri',
    schema_type: 'CollectionPage',
    strategic_purpose: 'Ürün kategori hub sayfası; tüm ürün tiplerine dağılım yapar',
    search_intent: 'commercial',
    status: 'draft',
  },
  {
    title: 'Pistonlu Rüzgar Kesici',
    slug: 'urunler/pistonlu-ruzgar-kesici',
    page_type: 'product',
    cluster: 'Pistonlu Rüzgar Kesici',
    focus: 'pistonlu rüzgar kesici',
    priority: 'high',
    seo_title: 'Pistonlu Rüzgar Kesici | Otomatik Açılıp Kapanan Sistemler',
    meta_description: 'Piston sistemi ile otomatik çalışan rüzgar kesici modelleri. Yüksek trafik açık alanlara özel. Montaj dahil fiyat teklifi alın.',
    h1: 'Pistonlu Rüzgar Kesici Sistemleri',
    schema_type: 'Product',
    strategic_purpose: 'En yüksek dönüşüm ürün sayfası; teklif formu odaklı',
    search_intent: 'commercial',
    status: 'draft',
  },
  {
    title: 'Uzaktan Kumandalı Rüzgar Kesici',
    slug: 'urunler/uzaktan-kumandali-ruzgar-kesici',
    page_type: 'product',
    cluster: 'Uzaktan Kumandalı Rüzgar Kesici',
    focus: 'uzaktan kumandalı rüzgar kesici',
    priority: 'high',
    seo_title: 'Uzaktan Kumandalı Rüzgar Kesici | Akıllı Kontrol Sistemi',
    meta_description: 'Uzaktan kumanda veya mobil uygulama ile kontrol edilen rüzgar kesici sistemleri. Otel, restoran ve villa için premium çözüm.',
    h1: 'Uzaktan Kumandalı Rüzgar Kesici',
    schema_type: 'Product',
    strategic_purpose: 'Premium ürün sayfası; yüksek bütçeli segment',
    search_intent: 'transactional',
    status: 'draft',
  },
  {
    title: 'Manuel Rüzgar Kesici',
    slug: 'urunler/manuel-ruzgar-kesici',
    page_type: 'product',
    cluster: 'Manuel Rüzgar Kesici',
    focus: 'manuel rüzgar kesici',
    priority: 'medium',
    seo_title: 'Manuel Rüzgar Kesici | Ekonomik ve Taşınabilir Modeller',
    meta_description: 'Elle kontrol edilen manuel rüzgar kesici modelleri. Tekerlekli ve sabit seçenekler. Kafe, teras ve bahçe için ideal.',
    h1: 'Manuel Rüzgar Kesici Modelleri',
    schema_type: 'Product',
    strategic_purpose: 'Giriş segment ürün sayfası; yüksek hacimli sorgu',
    search_intent: 'commercial',
    status: 'draft',
  },
  {
    title: 'Rüzgar Kesici Montaj Hizmeti',
    slug: 'hizmetler/montaj',
    page_type: 'service',
    cluster: 'Montaj Hizmeti',
    focus: 'rüzgar kesici montaj',
    priority: 'high',
    seo_title: 'Rüzgar Kesici Montaj Hizmeti | Türkiye Geneli Profesyonel Kurulum',
    meta_description: "Türkiye'nin her iline hızlı rüzgar kesici montaj hizmeti. Deneyimli ekip, garanti belgeli kurulum. Ücretsiz keşif için hemen iletişime geçin.",
    h1: 'Profesyonel Rüzgar Kesici Montaj Hizmeti',
    schema_type: 'Service',
    strategic_purpose: 'Hizmet dönüşüm sayfası; teklif talebi formu',
    search_intent: 'transactional',
    status: 'draft',
  },
  {
    title: 'Restoran için Rüzgar Kesici',
    slug: 'kullanim-alanlari/restoran',
    page_type: 'landing',
    cluster: 'Kullanım Alanları',
    focus: 'restoran rüzgar kesici',
    priority: 'medium',
    seo_title: 'Restoran Açık Alan Rüzgar Kesici | Teras Çözümleri',
    meta_description: 'Restoran terasları için profesyonel rüzgar kesici sistemleri. Müşteri konforunu artırın, açık sezon uzatın. Ücretsiz teklif alın.',
    h1: 'Restoran Açık Alanları için Rüzgar Kesici',
    schema_type: 'WebPage',
    strategic_purpose: 'Kullanım alanı odaklı dönüşüm sayfası',
    search_intent: 'commercial',
    status: 'draft',
  },
  {
    title: 'Rüzgar Kesici Nasıl Çalışır?',
    slug: 'blog/ruzgar-kesici-nasil-calisir',
    page_type: 'blog',
    cluster: 'Bilgi & Rehber',
    focus: 'rüzgar kesici nasıl çalışır',
    priority: 'low',
    seo_title: 'Rüzgar Kesici Nasıl Çalışır? Sistem Türleri ve Farkları',
    meta_description: 'Manuel, pistonlu ve uzaktan kumandalı rüzgar kesici sistemleri nasıl çalışır? Kurulum, bakım ve doğru model seçimi rehberi.',
    h1: 'Rüzgar Kesici Nasıl Çalışır?',
    schema_type: 'BlogPosting',
    strategic_purpose: 'Organik trafik + marka bilinirliği; ürün sayfalarına link aktarır',
    search_intent: 'informational',
    status: 'draft',
  },
  {
    title: 'Hakkımızda',
    slug: 'hakkimizda',
    page_type: 'page',
    cluster: null,
    focus: null,
    priority: 'low',
    seo_title: 'Hakkımızda | Rüzgar Kesici Shop',
    meta_description: "Türkiye'nin önde gelen rüzgar kesici üretici ve satıcısı. Yılların deneyimi, binlerce tamamlanmış proje.",
    h1: 'Biz Kimiz?',
    schema_type: 'AboutPage',
    strategic_purpose: 'Güven sinyali ve marka E-E-A-T güçlendirme',
    search_intent: 'navigational',
    status: 'draft',
  },
]

const pageIds = {}
for (let i = 0; i < pageDefs.length; i++) {
  const p = pageDefs[i]
  const { data: page, error: pErr2 } = await sb.from('pages').insert({
    user_id: userId,
    project_id: projectId,
    title: p.title,
    slug: p.slug,
    page_type: p.page_type,
    cluster_id: p.cluster ? clusterIds[p.cluster] : null,
    focus_keyword_id: p.focus ? kwMap[p.focus] : null,
    priority: p.priority,
    sort_order: i,
    seo_title: p.seo_title ?? null,
    meta_description: p.meta_description ?? null,
    h1: p.h1 ?? null,
    schema_type: p.schema_type ?? null,
    strategic_purpose: p.strategic_purpose ?? null,
    search_intent: p.search_intent ?? null,
    status: p.status ?? 'draft',
    content_blocks: [],
    heading_hierarchy: [],
    secondary_keywords: [],
    faq: [],
    cta_blocks: [],
    trust_blocks: [],
    image_plan: [],
    alt_texts: [],
    production_brief: {},
    audit_scores: {},
  }).select('id').single()
  if (pErr2) { console.error(`Sayfa hatası (${p.title}):`, pErr2); process.exit(1) }
  pageIds[p.slug] = page.id
}
console.log(`✓ ${Object.keys(pageIds).length} sayfa oluşturuldu`)

// ── 10. İç Linkler ─────────────────────────────────────────────────────────────
const linkDefs = [
  // Ana sayfa → pillar'lar
  { src: '/', tgt: 'urunler', anchor: 'Rüzgar Kesici Ürünleri', type: 'contextual' },
  { src: '/', tgt: 'hizmetler/montaj', anchor: 'Montaj Hizmeti', type: 'contextual' },
  { src: '/', tgt: 'kullanim-alanlari/restoran', anchor: 'Restoran Çözümleri', type: 'contextual' },
  // Kategori sayfası → ürünler
  { src: 'urunler', tgt: 'urunler/pistonlu-ruzgar-kesici', anchor: 'Pistonlu Modeller', type: 'contextual' },
  { src: 'urunler', tgt: 'urunler/uzaktan-kumandali-ruzgar-kesici', anchor: 'Uzaktan Kumandalı Modeller', type: 'contextual' },
  { src: 'urunler', tgt: 'urunler/manuel-ruzgar-kesici', anchor: 'Manuel Modeller', type: 'contextual' },
  // Ürün → montaj hizmeti
  { src: 'urunler/pistonlu-ruzgar-kesici', tgt: 'hizmetler/montaj', anchor: 'Montaj Teklifi Al', type: 'contextual' },
  { src: 'urunler/uzaktan-kumandali-ruzgar-kesici', tgt: 'hizmetler/montaj', anchor: 'Kurulum Teklifi Al', type: 'contextual' },
  { src: 'urunler/manuel-ruzgar-kesici', tgt: 'hizmetler/montaj', anchor: 'Montaj Hizmeti', type: 'contextual' },
  // Blog → ürün
  { src: 'blog/ruzgar-kesici-nasil-calisir', tgt: 'urunler', anchor: 'Rüzgar Kesici Ürünleri', type: 'contextual' },
  { src: 'blog/ruzgar-kesici-nasil-calisir', tgt: 'urunler/pistonlu-ruzgar-kesici', anchor: 'Pistonlu Rüzgar Kesici', type: 'contextual' },
  // Kullanım alanı → montaj
  { src: 'kullanim-alanlari/restoran', tgt: 'hizmetler/montaj', anchor: 'Teklif İste', type: 'contextual' },
  { src: 'kullanim-alanlari/restoran', tgt: 'urunler', anchor: 'Tüm Ürünler', type: 'contextual' },
]

const linkRows = linkDefs
  .filter(l => pageIds[l.src] && pageIds[l.tgt])
  .map(l => ({
    user_id: userId,
    project_id: projectId,
    source_page_id: pageIds[l.src],
    target_page_id: pageIds[l.tgt],
    anchor_text: l.anchor,
    link_type: l.type,
  }))

if (linkRows.length > 0) {
  const { error: linkErr } = await sb.from('internal_links').insert(linkRows)
  if (linkErr) { console.error('İç link hatası:', linkErr); process.exit(1) }
}
console.log(`✓ ${linkRows.length} iç link oluşturuldu`)

// ── 11. Araştırma Raporları ────────────────────────────────────────────────────
const researchSections = [
  {
    section: 'market_structures',
    sort_order: 0,
    rows: [
      {
        id: 'ms1',
        title: 'Pazar Büyüklüğü ve Talep',
        content: 'Türkiye açık alan rüzgar kesici pazarı yıllık %18 büyüme gösteriyor. Restoran ve kafe sektörü açık sezon uzatma ihtiyacıyla ana müşteri segmenti.',
        importance: 'high',
      },
      {
        id: 'ms2',
        title: 'Sezonsellik',
        content: 'Mart–Kasım arasında yoğun talep. Kış aylarında servis ve onarım taleplerinde artış. Yıl boyunca satış yapılabilir.',
        importance: 'medium',
      },
      {
        id: 'ms3',
        title: 'Ürün Segmentasyonu',
        content: 'Manuel modeller hacim liderliği yapıyor (%55). Pistonlu ve uzaktan kumandalı modeller yüksek gelir payı (%38 gelir).',
        importance: 'high',
      },
    ],
  },
  {
    section: 'competitor_strengths',
    sort_order: 1,
    rows: [
      {
        id: 'cs1',
        competitor: 'windshield.com.tr',
        strength: 'Güçlü backlink profili (210 backlink, 44 referring domain). Ana arama sorgularında üst sıralarda.',
        importance: 'high',
      },
      {
        id: 'cs2',
        competitor: 'ruzgarkesici.net',
        strength: 'Pistonlu model kategorisinde hakimiyet. Teknik içerik kalitesi yüksek.',
        importance: 'medium',
      },
    ],
  },
  {
    section: 'competitor_weaknesses',
    sort_order: 2,
    rows: [
      {
        id: 'cw1',
        competitor: 'windshield.com.tr',
        weakness: 'Mobil UX zayıf, sayfa hızı düşük. Kullanım alanı sayfaları yok.',
        importance: 'high',
      },
      {
        id: 'cw2',
        competitor: 'ruzgarkesici.net',
        weakness: 'Montaj hizmeti sayfası yetersiz. Teklif formu dönüşüm optimizasyonu eksik.',
        importance: 'high',
      },
      {
        id: 'cw3',
        competitor: 'acikalanmarket.com',
        weakness: 'Niche değil, genel açık alan ürünleri satıyor. Rüzgar kesici kategorisinde zayıf.',
        importance: 'medium',
      },
    ],
  },
  {
    section: 'quick_wins',
    sort_order: 3,
    rows: [
      {
        id: 'qw1',
        title: 'Kullanım Alanı Sayfaları',
        content: 'Rakiplerin tamamı kullanım alanı sayfasından yoksun. Restoran, kafe, otel gibi niche landing page\'ler hızlı sıralama fırsatı sunar.',
        impact: 'high',
        effort: 'low',
      },
      {
        id: 'qw2',
        title: 'Pistonlu + Uzaktan Kumandalı Ürün Sayfaları',
        content: 'Bu sorgularda rekabet düşük, ticari niyet yüksek. Detaylı ürün sayfaları ile hızlı sıralama.',
        impact: 'high',
        effort: 'medium',
      },
    ],
  },
  {
    section: 'high_value_opportunities',
    sort_order: 4,
    rows: [
      {
        id: 'hv1',
        title: '"Rüzgar kesici fiyat" sorgusu',
        content: '3200 aylık arama hacmi, düşük rekabet (zorluk 40). Fiyat karşılaştırma sayfası ile ilk sayfada yer alma potansiyeli.',
        volume: 3200,
        difficulty: 40,
        revenue_potential: 'high',
      },
      {
        id: 'hv2',
        title: 'Montaj Hizmeti Long-Tail',
        content: '"Rüzgar kesici montaj hizmeti" sorgusu için rakip yok. Teklif formu ile doğrudan satışa dönüştürme.',
        volume: 640,
        difficulty: 20,
        revenue_potential: 'high',
      },
    ],
  },
]

for (const rs of researchSections) {
  const { error: rsErr } = await sb.from('research_reports').insert({
    user_id: userId,
    project_id: projectId,
    section: rs.section,
    rows: rs.rows,
    sort_order: rs.sort_order,
  })
  if (rsErr) { console.error(`Research report hatası (${rs.section}):`, rsErr); process.exit(1) }
}
console.log('✓ Araştırma raporları oluşturuldu')

// ── 12. Proje Kararları ────────────────────────────────────────────────────────
const decisionDefs = [
  {
    decision_key: 'schema_markup',
    decision_value: 'Product',
    decision_type: 'seo_rule',
    section: null,
    decision: 'Tüm ürün sayfalarında Schema.org Product markup kullanılacak.',
    reason: 'E-ticaret + teklif talebi modeli için rich snippet görünürlüğü kritik.',
    scope_type: 'project',
  },
  {
    decision_key: 'priority_products',
    decision_value: 'pistonlu,uzaktan_kumandali',
    decision_type: 'strategy',
    section: 'keyword',
    decision: 'Pistonlu ve uzaktan kumandalı modeller öncelikli hedef; manuel model hacim için ikincil.',
    reason: 'Rakip analizi: bu ürün tiplerinde rekabet düşük, dönüşüm değeri yüksek.',
    scope_type: 'project',
  },
  {
    decision_key: 'site_architecture',
    decision_value: 'pillar_cluster',
    decision_type: 'architecture',
    section: 'blueprint',
    decision: 'Site yapısı: Ana Sayfa > Ürünler (kategori) > Ürün Tipleri > Kullanım Alanları.',
    reason: 'Pillar-cluster mimarisi ile link juice akışı optimize edilecek.',
    scope_type: 'project',
  },
  {
    decision_key: 'cta_requirement',
    decision_value: 'teklif_formu_zorunlu',
    decision_type: 'content',
    section: 'content',
    decision: 'Her ürün sayfasında teklif formu CTA ve "Montaj Dahil Fiyat Alın" buton bloğu zorunlu.',
    reason: 'Ana gelir modeli teklif dönüşümü; CTA olmayan sayfa hedef dışı.',
    scope_type: 'project',
  },
  {
    decision_key: 'brand_tone',
    decision_value: 'guven_veren_pratik',
    decision_type: 'brand',
    section: null,
    decision: 'Marka sesi: güven veren, teknik ama anlaşılır, satış baskısı düşük.',
    reason: 'Hedef kitle profesyonel işletmeler; gereksiz agresif satış dili itiş etkisi yaratır.',
    scope_type: 'project',
  },
]

for (const d of decisionDefs) {
  const { error: dErr } = await sb.from('project_decisions').insert({
    user_id: userId,
    project_id: projectId,
    decision_key: d.decision_key,
    decision_value: d.decision_value,
    decision_type: d.decision_type,
    section: d.section,
    decision: d.decision,
    reason: d.reason,
    scope_type: d.scope_type,
    is_active: true,
  })
  if (dErr) { console.error(`Karar hatası (${d.decision_key}):`, dErr); process.exit(1) }
}
console.log('✓ Proje kararları oluşturuldu')

// ── 13. Özet ──────────────────────────────────────────────────────────────────
console.log('\n═════════════════════════════════════════')
console.log(`Proje ID   : ${projectId}`)
console.log(`Domain     : ${DEMO_DOMAIN}`)
console.log(`URL        : http://localhost:3030/projeler/${projectId}`)
console.log('═════════════════════════════════════════')
console.log('Rüzgar Kesici Shop demo projesi hazır.')
console.log(`  • ${insertedKws.length} keyword`)
console.log(`  • ${clusterDefs.length} cluster`)
console.log(`  • ${entityDefs.length} business entity`)
console.log(`  • ${competitorDefs.length} rakip`)
console.log(`  • ${Object.keys(pageIds).length} sayfa`)
console.log(`  • ${linkRows.length} iç link`)
console.log(`  • ${researchSections.length} araştırma bölümü`)
console.log(`  • ${decisionDefs.length} proje kararı`)
console.log('Tüm gate flag\'leri: research=true, keyword_strategy=true, blueprint=true, technical_audit=false')
