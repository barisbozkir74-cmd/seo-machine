import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EntityTable } from '@/app/(dashboard)/projeler/[id]/isletme/EntityTable'
import type { BusinessEntity, EntityType } from '@/app/(dashboard)/projeler/[id]/isletme/actions'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'

type TabConfig = {
  type:       EntityType
  label:      string
  singular:   string   // grammatically correct singular for the type
  description: string  // SEO-aware explanation
  emptyHint:  string   // what to add and why it matters
}

const TABS: TabConfig[] = [
  {
    type:        'product',
    label:       'Ürünler',
    singular:    'Ürün',
    description: 'Sıralamak istediğiniz ürünler. Her ürün için hedef keyword ve sayfa türü belirlenir; blueprint\'te ürün sayfaları buradan türer.',
    emptyHint:   'Sattığınız veya tanıttığınız ürünleri ekleyin. Araştırma ve keyword stratejisi bu listeden yararlanır.',
  },
  {
    type:        'service',
    label:       'Hizmetler',
    singular:    'Hizmet',
    description: 'Sunduğunuz hizmetler. Hizmet bazlı keyword kümeleri ve landing page\'lerin iskeletini oluşturur.',
    emptyHint:   'Verdiğiniz hizmetleri ekleyin. Her hizmet için ayrı landing page ve keyword kümesi oluşturulabilir.',
  },
  {
    type:        'category',
    label:       'Kategoriler',
    singular:    'Kategori',
    description: 'Ürün ve hizmet kategorileri. Kategori sayfaları için içerik mimarisi buradan şekillenir; URL hiyerarşisi bu yapıya dayanır.',
    emptyHint:   'Ürün veya hizmet kategorilerinizi ekleyin. Kategori sayfaları yüksek hacimli keyword\'leri yakalar.',
  },
  {
    type:        'service_area',
    label:       'Servis Alanları',
    singular:    'Servis Alanı',
    description: 'Hizmet verilen lokasyonlar. Yerel SEO stratejisi ve şehir/bölge bazlı landing page\'lerin temelidir.',
    emptyHint:   'Hizmet verdiğiniz şehir, ilçe veya bölgeleri ekleyin. Yerel aramalarda sıralama için kritik.',
  },
  {
    type:        'persona',
    label:       'Personalar',
    singular:    'Persona',
    description: 'Hedef müşteri profilleri. İçerik tonu, keyword seçimi ve arama intent\'i bu profillerle hizalanır.',
    emptyHint:   'Ürün/hizmetlerinizi satın alan ya da kullanan kişi profillerini tanımlayın. Araştırma AI bu bilgiyi kullanır.',
  },
  {
    type:        'usp',
    label:       'USP',
    singular:    'USP',
    description: 'Benzersiz değer önerileri. Rakip karşılaştırması, içerik stratejisi ve meta açıklamalar buradan beslenir.',
    emptyHint:   'Sizi rakiplerinizden ayıran avantajları ekleyin. Araştırma ve rakip analizi bu bilgiyi içerik üretiminde kullanır.',
  },
]

// Count how many of the 6 types are non-empty
function filledSectionCount(grouped: Record<EntityType, BusinessEntity[]>): number {
  return TABS.filter((t) => grouped[t.type].length > 0).length
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  product:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  service:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
  category:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  service_area: 'bg-green-500/10 text-green-400 border-green-500/20',
  persona:      'bg-pink-500/10 text-pink-400 border-pink-500/20',
  usp:          'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  other:        'bg-secondary/60 text-muted-foreground border-border',
}

const INTENT_BADGE_STYLES: Record<string, string> = {
  commercial:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  transactional:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  informational:  'bg-sky-500/10 text-sky-400 border-sky-500/20',
  local:          'bg-lime-500/10 text-lime-400 border-lime-500/20',
  navigational:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

type GroupKey = 'product' | 'service' | 'category' | 'other'

const GROUP_LABELS: Record<GroupKey, string> = {
  product:  'Ürünler',
  service:  'Hizmetler',
  category: 'Kategoriler',
  other:    'Diğer',
}

function getGroupKey(type: string): GroupKey {
  if (type === 'product')  return 'product'
  if (type === 'service')  return 'service'
  if (type === 'category') return 'category'
  return 'other'
}

function groupEntitiesForCards(entities: BusinessEntity[]): Array<{ key: GroupKey; label: string; items: BusinessEntity[] }> {
  const map: Record<GroupKey, BusinessEntity[]> = { product: [], service: [], category: [], other: [] }
  for (const e of entities) map[getGroupKey(e.type)].push(e)
  return (Object.keys(GROUP_LABELS) as GroupKey[])
    .filter((k) => map[k].length > 0)
    .map((k) => ({ key: k, label: GROUP_LABELS[k], items: map[k] }))
}

export default async function SettingsBusinessPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }  = await params
  const { tab } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const { data: entities } = await supabase
    .from('business_entities')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  const allEntities = (entities ?? []) as BusinessEntity[]

  const activeType: EntityType = (TABS.find((t) => t.type === tab)?.type) ?? 'product'
  const activeTab = TABS.find((t) => t.type === activeType)!

  const grouped: Record<EntityType, BusinessEntity[]> = {
    product:      [],
    service:      [],
    category:     [],
    service_area: [],
    persona:      [],
    usp:          [],
  }
  for (const e of allEntities) grouped[e.type]?.push(e)

  const totalCount   = allEntities.length
  const filledCount  = filledSectionCount(grouped)
  const base         = `/control-center/projects/${id}/settings/business`

  const cardGroups = groupEntitiesForCards(allEntities)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Header ── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div>
          <span className="text-sm font-medium text-foreground">Ürünler / Hizmetler</span>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            Araştırma, keyword ve blueprint modülleri bu katalogdan bağlam üretir
          </p>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">{totalCount} kayıt</span>
        )}
      </div>

      <SplitPane
        storageKey="urunler-hizmetler"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Ürün & Hizmet Analizi"
            managerName="Ürün Yöneticisi"
            hint="Ürün kataloğunu analiz eder, SEO fırsatlarını ve eksik ürün açıklamalarını tespit eder."
            section="urunler-hizmetler"
          />
        }
      >
        {/* ── Profile completeness strip ── */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-border/40 px-6 py-2 bg-secondary/20">
          <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wide shrink-0">
            Profil
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {TABS.map((t) => {
              const count = grouped[t.type].length
              const filled = count > 0
              return (
                <Link
                  key={t.type}
                  href={`${base}?tab=${t.type}`}
                  className={[
                    'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors',
                    filled
                      ? 'text-foreground/70 bg-secondary hover:bg-secondary/80'
                      : 'text-muted-foreground/30 hover:text-muted-foreground/50',
                  ].join(' ')}
                >
                  <span className={filled ? 'text-emerald-400' : 'text-muted-foreground/20'}>
                    {filled ? '●' : '○'}
                  </span>
                  {t.label}
                  {filled && (
                    <span className="tabular-nums text-muted-foreground/50">{count}</span>
                  )}
                </Link>
              )
            })}
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
            {filledCount}/{TABS.length} bölüm
          </span>
        </div>

        {/* ── Tab bar ── */}
        <div role="tablist" aria-label="Varlık türleri" className="flex flex-shrink-0 border-b border-border px-6 gap-0 overflow-x-auto">
          {TABS.map((t) => {
            const count    = grouped[t.type].length
            const isActive = t.type === activeType
            return (
              <Link
                key={t.type}
                href={`${base}?tab=${t.type}`}
                role="tab"
                aria-selected={isActive}
                className={[
                  'px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                ].join(' ')}
              >
                {t.label}
                {count > 0 && (
                  <span className={[
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    isActive ? 'bg-secondary text-foreground' : 'bg-secondary/50 text-muted-foreground/60',
                  ].join(' ')}>
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <p className="text-xs text-muted-foreground/70 max-w-prose">{activeTab.description}</p>
          <EntityTable
            projectId={id}
            type={activeType}
            typeLabel={activeTab.singular}
            emptyHint={activeTab.emptyHint}
            entities={grouped[activeType]}
          />

          {/* ── Grouped entity cards (product / service / category / other) ── */}
          {cardGroups.length > 0 && (
            <div className="mt-6 space-y-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                Tüm Varlıklar — Türe Göre
              </p>
              {cardGroups.map(({ key, label, items }) => (
                <div key={key} className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
                    {label}
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground/30">
                      {items.length} kayıt
                    </span>
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((entity) => (
                      <div
                        key={entity.id}
                        className="rounded-lg border border-border/40 bg-secondary/10 px-4 py-3 space-y-1.5 hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-foreground/90 leading-snug line-clamp-2">
                            {entity.name}
                          </span>
                          <span
                            className={[
                              'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                              TYPE_BADGE_STYLES[entity.type] ?? TYPE_BADGE_STYLES.other,
                            ].join(' ')}
                          >
                            {TABS.find((t) => t.type === entity.type)?.singular ?? entity.type}
                          </span>
                        </div>
                        {entity.description && (
                          <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2">
                            {entity.description}
                          </p>
                        )}
                        {entity.seo_intent && (
                          <span
                            className={[
                              'inline-flex rounded border px-1.5 py-0.5 text-[9px] font-medium',
                              INTENT_BADGE_STYLES[entity.seo_intent] ?? 'bg-secondary/50 text-muted-foreground border-border',
                            ].join(' ')}
                          >
                            {entity.seo_intent}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SplitPane>
    </div>
  )
}
