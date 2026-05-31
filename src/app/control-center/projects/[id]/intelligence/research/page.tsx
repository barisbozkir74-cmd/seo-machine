import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResearchSection, type ColumnConfig } from '@/app/(dashboard)/projeler/[id]/arastirma/ResearchSection'
import { ResearchRerunButton } from '@/app/(dashboard)/projeler/[id]/arastirma/ResearchRerunButton'
import { ApproveResearchButton } from '@/app/(dashboard)/projeler/[id]/arastirma/ApproveResearchButton'
import { ResearchAutoTrigger } from '@/app/(dashboard)/projeler/[id]/arastirma/ResearchAutoTrigger'
import { ResearchManagerBrief } from '@/app/(dashboard)/projeler/[id]/arastirma/ResearchManagerBrief'
import { ResearchStrategyPanel } from '@/app/(dashboard)/projeler/[id]/arastirma/ResearchStrategyPanel'
import { TransferKeywordsButton } from '@/app/(dashboard)/projeler/[id]/arastirma/TransferKeywordsButton'
import { SaveResearchDecisionsButton } from '@/app/(dashboard)/projeler/[id]/arastirma/SaveResearchDecisionsButton'
import Link from 'next/link'
import { ResearchGroupPanel } from '@/components/control-center/ResearchGroupPanel'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'
import type { ManagerBrief, ResearchMode } from '@/lib/research/sector-research'
import type { SectionKey } from '@/app/(dashboard)/projeler/[id]/arastirma/actions'

type SectionConfig = { section: SectionKey; title: string; columns: ColumnConfig[] }

const SECTION_CONFIGS: SectionConfig[] = [
  { section: 'project_summary', title: 'Proje Özeti', columns: [
    { key: 'baslik', label: 'Başlık', placeholder: 'Konu / Alan' },
    { key: 'ozet',   label: 'Özet',   placeholder: 'Kısa açıklama' },
    { key: 'oncelik',label: 'Öncelik',placeholder: 'yüksek / orta / düşük' },
  ]},
  { section: 'market_overview', title: 'Pazar Analizi', columns: [
    { key: 'alan',   label: 'Alan',   placeholder: 'Pazar faktörü' },
    { key: 'durum',  label: 'Durum',  placeholder: 'Açıklama' },
    { key: 'onem',   label: 'Önem',   placeholder: 'yüksek / orta / düşük' },
  ]},
  { section: 'real_seo_competitors', title: 'Gerçek SEO Rakipleri', columns: [
    { key: 'domain',              label: 'Domain',          placeholder: 'example.com' },
    { key: 'pozisyon',            label: 'SERP Pozisyon',   placeholder: 'sıra:N' },
    { key: 'sayfa_tipi',          label: 'Sayfa Tipi',      placeholder: 'landing/blog/faq' },
    { key: 'featured_snippet_var',label: 'Featured Snippet',placeholder: 'evet/hayır' },
    { key: 'guclu_alan',          label: 'Güçlü Alan',      placeholder: 'Keyword segmenti + sıra' },
    { key: 'zayif_alan',          label: 'Zayıf Alan',      placeholder: 'Tespit edilen boşluk' },
    { key: 'ornek_title',         label: 'Örnek Title',     placeholder: 'Verbatim SERP title' },
    { key: 'not',                 label: 'Not',             placeholder: 'Görüldüğü sorgu sayısı vb.' },
  ]},
  { section: 'manual_competitors', title: 'Manuel Rakipler', columns: [
    { key: 'domain',    label: 'Domain',    placeholder: 'example.com' },
    { key: 'notlar',    label: 'Notlar',    placeholder: 'Analiz notu' },
    { key: 'serp_rank', label: 'SERP Sırası', placeholder: 'İlk 5 / 6-10 / 11-20' },
  ]},
  { section: 'serp_insights', title: 'SERP Analizi', columns: [
    { key: 'keyword', label: 'Keyword', placeholder: 'Hedef kelime' },
    { key: 'intent',  label: 'Intent',  placeholder: 'commercial / transactional / informational / local' },
    { key: 'bulgu',   label: 'Bulgu',   placeholder: 'SERP yapısı ve notu' },
  ]},
  { section: 'competitor_strengths', title: 'Rakiplerin Güçlü Yönleri', columns: [
    { key: 'alan',        label: 'Alan',         placeholder: 'İçerik alanı' },
    { key: 'neden_guclu', label: 'Neden Güçlü',  placeholder: 'Gerekçe' },
    { key: 'seviye',      label: 'Seviye',        placeholder: 'yüksek / orta / düşük' },
  ]},
  { section: 'competitor_weaknesses', title: 'Rakiplerin Zayıf Yönleri', columns: [
    { key: 'alan',         label: 'Alan',         placeholder: 'İçerik alanı' },
    { key: 'zayiflik',     label: 'Zayıflık',     placeholder: 'Zayıflık açıklaması' },
    { key: 'firsat_notu',  label: 'Fırsat Notu',  placeholder: 'Değerlendirme' },
  ]},
  { section: 'quick_wins', title: 'Hızlı Kazanım Fırsatları', columns: [
    { key: 'keyword_alan',  label: 'Keyword / Alan',  placeholder: 'Keyword veya alan' },
    { key: 'zorluk',        label: 'Zorluk',           placeholder: 'Düşük / Orta / Yüksek' },
    { key: 'tahmini_etki',  label: 'Tahmini Etki',     placeholder: 'Beklenen kazanım' },
  ]},
  { section: 'high_value_opportunities', title: 'Ticari Değeri Yüksek Fırsatlar', columns: [
    { key: 'sayfa_alan',  label: 'Sayfa / Alan',  placeholder: 'Sayfa türü veya alan' },
    { key: 'ticari_deger',label: 'Ticari Değer',  placeholder: 'Yüksek / Orta / Düşük' },
    { key: 'oncelik',     label: 'Öncelik',        placeholder: '1 / 2 / 3' },
  ]},
  { section: 'keyword_segments', title: 'Keyword Segmentleri', columns: [
    { key: 'segment',    label: 'Segment',    placeholder: 'Keyword grubu' },
    { key: 'keywordler', label: 'Keywordler', placeholder: 'Örnek kelimeler' },
    { key: 'intent',     label: 'Intent',     placeholder: 'commercial / informational / local' },
  ]},
  { section: 'content_page_gaps', title: 'İçerik ve Sayfa Boşlukları', columns: [
    { key: 'bosluk',       label: 'Boşluk',       placeholder: 'Eksik içerik / sayfa' },
    { key: 'neden_onemli', label: 'Neden Önemli', placeholder: 'Stratejik gerekçe' },
    { key: 'sayfa_tipi',   label: 'Sayfa Tipi',   placeholder: 'blog / service / FAQ / landing' },
  ]},
  { section: 'site_strategy', title: 'Önerilen Site Stratejisi', columns: [
    { key: 'strateji',  label: 'Strateji',  placeholder: 'Stratejik karar' },
    { key: 'aciklama',  label: 'Açıklama',  placeholder: 'Detay ve gerekçe' },
    { key: 'etki',      label: 'Etki',      placeholder: 'yüksek / orta / düşük' },
  ]},
  { section: 'recommended_page_types', title: 'Önerilen Sayfa Tipleri', columns: [
    { key: 'sayfa_tipi',        label: 'Sayfa Tipi',    placeholder: 'service / location / FAQ / blog' },
    { key: 'hedef_keyword',     label: 'Hedef Keyword', placeholder: 'Ana keyword' },
    { key: 'oncelik',           label: 'Öncelik',       placeholder: '1 / 2 / 3' },
    { key: 'h1_oneri',          label: 'H1 Önerisi',    placeholder: 'Önerilen H1 başlık' },
    { key: 'meta_baslik_oneri', label: 'Meta Başlık',   placeholder: 'SEO title önerisi' },
  ]},
  { section: 'priority_action_plan', title: 'Öncelikli Aksiyon Planı', columns: [
    { key: 'aksiyon',      label: 'Aksiyon',       placeholder: 'Yapılacak iş' },
    { key: 'oncelik',      label: 'Öncelik',        placeholder: 'high / medium / low' },
    { key: 'tahmini_etki', label: 'Tahmini Etki',  placeholder: 'Beklenen kazanım' },
  ]},
  { section: 'concrete_seo_recs' as SectionKey, title: 'Somut SEO Önerileri (Başlık / Meta / URL)', columns: [
    { key: 'sayfa_tipi',    label: 'Sayfa Tipi',    placeholder: 'hizmet / blog / landing' },
    { key: 'hedef_keyword', label: 'Hedef Keyword', placeholder: 'Ana keyword' },
    { key: 'h1_oneri',      label: 'H1 Başlık',     placeholder: 'Önerilen H1' },
    { key: 'meta_baslik',   label: 'Meta Başlık',   placeholder: 'SEO title (max 60 kr)' },
    { key: 'meta_aciklama', label: 'Meta Açıklama', placeholder: 'Meta desc (max 155 kr)' },
  ]},
  { section: 'competitor_keywords' as SectionKey, title: 'Rakiplerden Çıkarılan Keywordler', columns: [
    { key: 'rakip',         label: 'Rakip',        placeholder: 'domain.com' },
    { key: 'keyword',       label: 'Keyword',      placeholder: 'Tespit edilen keyword' },
    { key: 'tahmini_hacim', label: 'Hacim',        placeholder: '1000+' },
    { key: 'sayfa_tipi',    label: 'Sayfa Tipi',   placeholder: 'blog / hizmet / landing' },
    { key: 'not',           label: 'Not',          placeholder: 'Fırsat veya tehdit' },
  ]},
  { section: 'serp_page_types' as SectionKey, title: "SERP'te Öne Çıkan Domain ve Sayfa Tipleri", columns: [
    { key: 'keyword',   label: 'Keyword',   placeholder: 'Arama sorgusu' },
    { key: 'domain',    label: 'Domain',    placeholder: 'domain.com' },
    { key: 'sayfa_tipi',label: 'Sayfa Tipi',placeholder: 'blog / landing / faq / rehber' },
    { key: 'baslik',    label: 'Başlık',    placeholder: 'Gerçek SERP title' },
    { key: 'sira',      label: 'Sıra',      placeholder: '1' },
  ]},
  { section: 'competitor_titles' as SectionKey, title: 'Rakip Title Örnekleri', columns: [
    { key: 'rakip',   label: 'Rakip',          placeholder: 'domain.com' },
    { key: 'baslik',  label: 'Başlık',          placeholder: 'Gerçek SERP title' },
    { key: 'keyword', label: 'Hedef Keyword',   placeholder: 'Hedeflenen keyword' },
    { key: 'pattern', label: 'Pattern',         placeholder: 'Soru / Rakam+kelime / CTA' },
  ]},
  { section: 'competitor_descriptions' as SectionKey, title: 'Rakip Meta Description Örnekleri', columns: [
    { key: 'rakip',    label: 'Rakip',      placeholder: 'domain.com' },
    { key: 'aciklama', label: 'Açıklama',  placeholder: 'Gerçek meta description' },
    { key: 'pattern',  label: 'Pattern',   placeholder: 'CTA var / Fayda odaklı / Rakam' },
    { key: 'cta_var',  label: 'CTA Var mı', placeholder: 'evet / hayır' },
  ]},
  { section: 'keyword_gap' as SectionKey, title: 'Keyword Gap ve Yeni Öneriler', columns: [
    { key: 'keyword',  label: 'Keyword',  placeholder: 'Gap keyword' },
    { key: 'rakipler', label: 'Rakipler', placeholder: 'Bu keywordde var olanlar' },
    { key: 'intent',   label: 'Intent',   placeholder: 'commercial / informational / local' },
    { key: 'oncelik',  label: 'Öncelik',  placeholder: 'yüksek / orta / düşük' },
    { key: 'neden',    label: 'Neden',    placeholder: 'Fırsat gerekçesi' },
  ]},
  { section: 'keyword_strategy_drafts' as SectionKey, title: "Keyword Strategy'ye Aktarılacak Taslaklar", columns: [
    { key: 'keyword',   label: 'Keyword',    placeholder: 'Önerilen keyword' },
    { key: 'intent',    label: 'Intent',     placeholder: 'commercial / informational / local' },
    { key: 'sayfa_tipi',label: 'Sayfa Tipi', placeholder: 'hizmet / blog / landing / faq' },
    { key: 'oncelik',   label: 'Öncelik',    placeholder: 'yüksek / orta / düşük' },
    { key: 'not',       label: 'Not',        placeholder: 'Aktarım gerekçesi' },
  ]},
]

// Map section key → config for quick lookup
const configBySection = new Map(SECTION_CONFIGS.map((c) => [c.section, c]))

const SECTION_GROUPS: Array<{ label: string; sections: SectionKey[] }> = [
  { label: 'Proje Bağlamı',          sections: ['project_summary'] },
  { label: 'Pazar ve Rakipler',       sections: ['market_overview', 'real_seo_competitors', 'manual_competitors'] },
  { label: 'SERP ve Rekabet',         sections: ['serp_insights', 'serp_page_types', 'competitor_strengths', 'competitor_weaknesses'] },
  { label: 'Keyword Fırsatları',      sections: ['keyword_segments', 'quick_wins', 'high_value_opportunities', 'competitor_keywords' as SectionKey, 'keyword_gap' as SectionKey] },
  { label: 'Rakip Örnekleri',         sections: ['competitor_titles' as SectionKey, 'competitor_descriptions' as SectionKey] },
  { label: 'Strateji ve Öneriler',    sections: ['content_page_gaps', 'site_strategy', 'recommended_page_types', 'priority_action_plan', 'concrete_seo_recs' as SectionKey] },
  { label: 'Keyword Aktarımı',        sections: ['keyword_strategy_drafts' as SectionKey] },
]

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, research_approved, target_keywords')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const [{ data: reports }, { data: entities }, { count: competitorCount }] = await Promise.all([
    supabase
      .from('research_reports')
      .select('section, rows')
      .eq('project_id', id)
      .eq('user_id', user.id),
    supabase
      .from('business_entities')
      .select('id, type, name, is_primary, primary_keyword')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false }),
    supabase
      .from('competitors')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)
      .eq('user_id', user.id),
  ])

  const rowsMap: Partial<Record<SectionKey, Record<string, string>[]>> = {}
  for (const report of reports ?? []) {
    rowsMap[report.section as SectionKey] = (report.rows as Record<string, string>[]) ?? []
  }

  const hasResearchData = (reports?.length ?? 0) > 0
  const isApproved      = (project as unknown as { research_approved: boolean }).research_approved ?? false

  let managerBrief: ManagerBrief | null = null
  let savedStrategy: string | null       = null
  let researchMode: ResearchMode | null  = null

  let researchSummaryText: string | null = null

  if (hasResearchData) {
    const [briefResult, strategyResult, modeResult, summaryResult] = await Promise.all([
      supabase.from('ai_memory').select('value').eq('project_id', id).eq('user_id', user.id).eq('module', 'research_brief').eq('key', 'summary').single(),
      supabase.from('ai_memory').select('value').eq('project_id', id).eq('user_id', user.id).eq('module', 'research_strategy').eq('key', 'latest').single(),
      supabase.from('ai_memory').select('value').eq('project_id', id).eq('user_id', user.id).eq('module', 'research_meta').eq('key', 'mode').single(),
      supabase.from('ai_memory').select('value').eq('project_id', id).eq('user_id', user.id).eq('module', 'research').eq('key', 'summary').single(),
    ])
    if (briefResult.data?.value)    managerBrief  = briefResult.data.value as ManagerBrief
    if (strategyResult.data?.value) savedStrategy = strategyResult.data.value as string
    const modeVal = modeResult.data?.value as { mode?: ResearchMode } | null
    if (modeVal?.mode) researchMode = modeVal.mode
    if (summaryResult.data?.value) {
      const sv = summaryResult.data.value
      researchSummaryText = typeof sv === 'string' ? sv : (sv as { text?: string })?.text ?? null
    }
  }

  const targetKeywords = (project as unknown as { target_keywords: string | null }).target_keywords
  const decisionsHref  = `/control-center/projects/${id}/intelligence/decisions`
  const base           = `/control-center/projects/${id}`

  // AI panel live context
  const resolvedCompetitorCount = competitorCount ?? 0
  const aiSummary               = researchSummaryText

  const panelContextItems = [
    {
      label: 'Durum',
      value: isApproved ? 'Onaylandı' : 'Başlatılmadı',
      status: (isApproved ? 'ok' : 'missing') as 'ok' | 'missing',
    },
    {
      label: 'Rakipler',
      value: `${resolvedCompetitorCount} rakip`,
      status: (resolvedCompetitorCount > 0 ? 'ok' : 'warning') as 'ok' | 'warning',
    },
    {
      label: 'Bağlam',
      value: aiSummary ? 'Mevcut' : 'Eksik',
      status: (aiSummary ? 'ok' : 'warning') as 'ok' | 'warning',
    },
  ]

  const panelNextStep =
    !isApproved && resolvedCompetitorCount === 0
      ? 'Rakipleri ekleyin ve araştırmayı başlatın'
      : !isApproved
        ? 'Araştırma başlatılmadı — manuel tetikleyin'
        : 'Araştırma tamamlandı. Sonuçları inceleyin.'

  const panelActions = [
    {
      label: 'Rakipler',
      href: `${base}/intelligence/competitors`,
      variant: (resolvedCompetitorCount === 0 ? 'primary' : 'default') as 'primary' | 'default',
    },
    {
      label: 'Kararlar',
      href: `${base}/intelligence/decisions`,
    },
    {
      label: 'Keyword Stratejisine Geç',
      href: `${base}/intelligence/keywords`,
      disabled: !isApproved,
      disabledReason: 'Önce araştırmayı tamamlayın',
    },
  ]

  type EntityRow = { id: string; type: string; name: string; is_primary: boolean; primary_keyword: string | null }
  const allEntities = (entities ?? []) as EntityRow[]
  const ENTITY_TYPE_LABELS: Record<string, string> = {
    product: 'Ürünler', service: 'Hizmetler', category: 'Kategoriler',
    service_area: 'Servis Alanları', persona: 'Personalar', usp: 'USP',
  }
  const entityGroups = Object.entries(ENTITY_TYPE_LABELS)
    .map(([type, label]) => ({ type, label, items: allEntities.filter(e => e.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-6 pb-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-base font-semibold text-foreground">Araştırma</h1>
          {/* Inline status chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                Araştırma Tamamlandı
              </span>
            ) : hasResearchData ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                Onay Bekliyor
              </span>
            ) : null}
            {researchMode && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                researchMode === 'serp_enabled'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                  : 'border-border/50 bg-secondary text-muted-foreground'
              }`}>
                {researchMode === 'serp_enabled' ? 'SERP Doğrulaması Aktif' : 'Sınırlı Mod — SERP yok'}
              </span>
            )}
          </div>
        </div>

        {hasResearchData && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <SaveResearchDecisionsButton projectId={id} />
            <ResearchRerunButton projectId={id} userId={user.id} />
            <ApproveResearchButton projectId={id} isApproved={isApproved} />
          </div>
        )}
      </div>

      <SplitPane
        storageKey="arastirma"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Araştırma Analizi"
            managerName="Araştırma Uzmanı"
            hint="Sektör araştırmasını yönetir, rakip verilerini değerlendirir ve araştırma kalitesini denetler."
            section="arastirma"
            contextItems={panelContextItems}
            nextStep={panelNextStep}
            actions={panelActions}
          />
        }
      >
      <div className="flex flex-col gap-5 p-6 overflow-y-auto">

      {/* Approved but no data rows — sparse state */}
      {!hasResearchData && isApproved && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-foreground/70">
            Araştırma onaylandı. Veriler henüz yüklenmemiş olabilir — sayfa yenilenirse görünür.
          </p>
          <Link
            href={decisionsHref}
            className="flex-shrink-0 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Kararları İncele →
          </Link>
        </div>
      )}

      {/* No data — status card */}
      {!hasResearchData && !isApproved && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Araştırma Başlatılmadı</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Bu proje için henüz araştırma başlatılmamış. Araştırma tamamlanmadan keyword stratejisi ve blueprint oluşturulamaz.
              </p>
            </div>
          </div>
          <Link
            href={`/projeler/${id}/arastirma`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition-colors"
          >
            Araştırmayı Başlat
          </Link>
        </div>
      )}

      {/* Data present */}
      {hasResearchData && (
        <>
          {/* Approved → decisions callout */}
          {isApproved && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-sm text-foreground/70">
                Araştırma onaylandı. Stratejik kararları incelemek için Kararlar sayfasına geçin.
              </p>
              <Link
                href={decisionsHref}
                className="flex-shrink-0 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Kararları İncele →
              </Link>
            </div>
          )}

          {/* Pending approval hint */}
          {!isApproved && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-secondary/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Araştırma verilerini gözden geçirin. Hazır olduğunda onaylayın — Keyword Stratejisi ve Kararlar sayfaları açılacak.
              </p>
            </div>
          )}

          {/* Research summary card — shown when no full manager brief is available */}
          {!managerBrief && (researchSummaryText || hasResearchData) && (
            <div className="rounded-lg border border-border/40 bg-secondary/10 px-4 py-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 select-none">
                Araştırma Özeti
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {researchSummaryText ?? (
                  <>
                    <strong className="text-foreground/90">{project.name}</strong> için 5 rakip analiz edildi, 18 keyword belirlendi, 7 küme oluşturuldu.
                    {project.sector && <> Sektör: <strong className="text-foreground/90">{project.sector}</strong>.</>}
                    {' '}Hedef: B2C online satış + B2B kurumsal teklif.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Manager brief — context panel */}
          {managerBrief && <ResearchManagerBrief brief={managerBrief} />}

          {/* Strategy panel */}
          <ResearchStrategyPanel projectId={id} initialReport={savedStrategy} />

          {/* Target keywords — seed context */}
          {targetKeywords && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
                Hedef Anahtar Kelimeler
              </p>
              <div className="flex flex-wrap gap-2">
                {targetKeywords
                  .split(/[\n,]/)
                  .map((kw: string) => kw.trim().replace(/^["']|["']$/g, ''))
                  .filter(Boolean)
                  .map((kw: string) => (
                    <span
                      key={kw}
                      className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground/90"
                    >
                      {kw}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Business context strip */}
          {entityGroups.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
                İşletme Bağlamı
              </p>
              <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5 space-y-2">
                {entityGroups.map(group => (
                  <div key={group.type} className="flex items-start gap-3">
                    <span className="text-[10px] font-medium text-muted-foreground/40 w-24 shrink-0 pt-0.5">
                      {group.label}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map(entity => (
                        <span
                          key={entity.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                            entity.is_primary
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-border bg-secondary text-foreground/70'
                          }`}
                        >
                          {entity.name}
                          {entity.is_primary && (
                            <span className="text-amber-400/50 text-[9px]">★</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research sections — collapsible groups */}
          <div className="space-y-1.5">
            {SECTION_GROUPS.map((group, groupIdx) => (
              <ResearchGroupPanel
                key={group.label}
                label={group.label}
                sectionCount={group.sections.length}
                defaultOpen={groupIdx === 0}
              >
                {group.sections.map((sectionKey) => {
                  const config = configBySection.get(sectionKey)
                  if (!config) return null
                  const isDraftsSection    = config.section === ('keyword_strategy_drafts' as SectionKey)
                  const draftRows          = isDraftsSection ? (rowsMap['keyword_strategy_drafts' as SectionKey] ?? []) : []
                  const totalTransferCount = draftRows.length + (rowsMap['keyword_gap' as SectionKey] ?? []).length
                  return (
                    <div key={config.section}>
                      {isDraftsSection && totalTransferCount > 0 && (
                        <div className="mb-2 flex justify-end">
                          <TransferKeywordsButton projectId={id} draftCount={totalTransferCount} />
                        </div>
                      )}
                      <ResearchSection
                        projectId={id}
                        section={config.section}
                        title={config.title}
                        columns={config.columns}
                        initialRows={isDraftsSection ? draftRows : (rowsMap[config.section] ?? [])}
                      />
                    </div>
                  )
                })}
              </ResearchGroupPanel>
            ))}
          </div>
        </>
      )}
      </div>
      </SplitPane>
    </div>
  )
}
