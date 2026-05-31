'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CompetitorFetchButton } from './CompetitorFetchButton'
import { RakiplerAccordion } from './RakiplerAccordion'
import { RakiplerComparison } from './RakiplerComparison'
import {
  type FullCompetitor,
  type SummaryStats,
  type FilterId,
  getThreat,
  getDominantCat,
  getBestKeyword,
  getDataState,
  DATA_STATE_CONFIG,
  whyImportant,
  quickWin,
} from './rakipler-types'

// Re-export types consumed by page.tsx
export type { FullCompetitor, SummaryStats }

// ─── Filter definitions ───────────────────────────────────────────────────────

const FILTER_DEFS: Array<{ id: FilterId; label: string; dynamic?: boolean }> = [
  { id: 'all',             label: 'Tümü',                  dynamic: true },
  { id: 'withData',        label: 'Veri Çekilenler',       dynamic: true },
  { id: 'highThreat',      label: 'Yüksek Tehdit',         dynamic: true },
  { id: 'mediumThreat',    label: 'Orta Tehdit',           dynamic: true },
  { id: 'hasGaps',         label: 'Gap Olanlar' },
  { id: 'guideStrong',     label: 'Blog / Rehber Güçlü' },
  { id: 'serviceStrong',   label: 'Hizmet Sayfası Güçlü' },
  { id: 'conversionStrong',label: 'Dönüşüm Analizi Hazır' },
  { id: 'localStrong',     label: 'Yerel Güçlü' },
  { id: 'serp',            label: 'SERP Keşfi' },
  { id: 'manual',          label: 'Manuel' },
]

function applyFilter(comps: FullCompetitor[], filter: FilterId): FullCompetitor[] {
  switch (filter) {
    case 'withData':         return comps.filter(c => c.category_structure !== null)
    case 'highThreat':       return comps.filter(c => c.totalEtv >= 10000)
    case 'mediumThreat':     return comps.filter(c => c.totalEtv >= 2000 && c.totalEtv < 10000)
    case 'hasGaps':          return comps.filter(c => c.gapCount > 0)
    case 'guideStrong':      return comps.filter(c => !!c.category_structure?.['Blog'])
    case 'serviceStrong':    return comps.filter(c => !!c.category_structure?.['Hizmetler'])
    case 'conversionStrong': return comps.filter(c => !!c.analysis)
    case 'localStrong':      return comps.filter(c => !!c.category_structure?.['Hizmetler'] || !!c.category_structure?.['Mağaza'])
    case 'serp':             return comps.filter(c => c.source === 'serp')
    case 'manual':           return comps.filter(c => c.source !== 'serp')
    default:                 return comps
  }
}

function applySearch(comps: FullCompetitor[], q: string): FullCompetitor[] {
  const lq = q.toLowerCase().trim()
  if (!lq) return comps
  return comps.filter(c =>
    c.domain.toLowerCase().includes(lq) ||
    c.ranked_keywords?.some(kw => kw.keyword.toLowerCase().includes(lq)) ||
    (c.category_structure && Object.keys(c.category_structure).some(cat => cat.toLowerCase().includes(lq)))
  )
}

// ─── Flow indicator ───────────────────────────────────────────────────────────

function FlowIndicator({ activeStep }: { activeStep: 1 | 2 | 3 | 4 }) {
  const steps: Array<{ n: 1 | 2 | 3 | 4; label: string }> = [
    { n: 1, label: 'Rakip Seç' },
    { n: 2, label: 'Detayı İncele' },
    { n: 3, label: 'Karara Aktar' },
    { n: 4, label: 'Karşılaştır' },
  ]
  return (
    <div className="flex items-center gap-1 text-[11px]">
      {steps.map((s, i) => (
        <span key={s.n} className="flex items-center gap-1">
          <span className={`px-2 py-0.5 rounded-full transition-colors ${
            s.n === activeStep
              ? 'bg-primary/15 text-primary/90 font-medium'
              : s.n < activeStep
                ? 'text-muted-foreground/40'
                : 'text-muted-foreground/50'
          }`}>
            {s.n}. {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground/25">›</span>}
        </span>
      ))}
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

type CardState = 'normal' | 'danger' | 'warning' | 'good' | 'action' | 'dim'

function StatCard({
  label, value, sub, danger, hint, cardState = 'normal',
}: {
  label: string; value: string; sub?: string; danger?: boolean
  hint?: string; cardState?: CardState
}) {
  const isHot = danger && value !== '0'
  const effective: CardState = isHot ? 'danger' : cardState

  const borderCls = {
    normal:  'border-border',
    danger:  'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    good:    'border-emerald-500/30 bg-emerald-500/5',
    action:  'border-blue-500/30 bg-blue-500/5',
    dim:     'border-border/40 opacity-60',
  }[effective]

  const valueCls = {
    normal:  '',
    danger:  'text-red-400',
    warning: 'text-amber-400',
    good:    'text-emerald-400',
    action:  'text-blue-400',
    dim:     'text-muted-foreground',
  }[effective]

  const hintCls = {
    normal:  'text-muted-foreground/70',
    danger:  'text-red-400/70',
    warning: 'text-amber-400/70',
    good:    'text-emerald-400/70',
    action:  'text-blue-400/70',
    dim:     'text-muted-foreground/50',
  }[effective]

  return (
    <div className={`rounded-lg border p-3 ${borderCls}`}>
      <p className="text-[10px] text-muted-foreground mb-1 leading-none">{label}</p>
      <p className={`text-base font-semibold leading-tight truncate ${valueCls}`} title={value}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={sub}>{sub}</p>}
      {hint && <p className={`text-[10px] mt-1 leading-tight ${hintCls}`}>{hint}</p>}
    </div>
  )
}

function SummaryBar({ stats, hasOwnData }: { stats: SummaryStats; hasOwnData: boolean }) {
  const noRivals    = stats.total === 0
  const missing     = stats.total - stats.withData
  const allMissing  = missing > 0 && stats.withData === 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
      <StatCard
        label="Toplam Rakip"
        value={String(stats.total)}
        cardState={noRivals ? 'dim' : 'normal'}
        hint={noRivals ? 'Domain ekleyerek başlayın' : undefined}
      />
      <StatCard
        label="Veri Çekilen"
        value={String(stats.withData)}
        cardState={allMissing ? 'warning' : missing > 0 ? 'warning' : stats.withData > 0 ? 'good' : 'dim'}
        hint={
          allMissing ? 'Veri çekimi bekleniyor' :
          missing > 0 ? `${missing} rakipte veri eksik` :
          undefined
        }
      />
      <StatCard
        label="Yüksek Tehdit"
        value={String(stats.highThreat)}
        danger
        hint={stats.highThreat > 0 ? 'Detayı hemen incele' : undefined}
      />
      <StatCard
        label="Orta Tehdit"
        value={String(stats.mediumThreat)}
        cardState={stats.mediumThreat > 0 ? 'warning' : 'normal'}
      />
      <StatCard
        label="Yaygın Tip"
        value={stats.dominantPageType ?? '—'}
        cardState={stats.dominantPageType ? 'normal' : 'dim'}
        hint={stats.dominantPageType ? `Rakipler bu tipte güçlü` : undefined}
      />
      <StatCard
        label="En Güçlü Rakip"
        value={stats.strongestCompetitor ?? '—'}
        sub={stats.strongestCompetitor ? 'yüksek ETV' : undefined}
        cardState={stats.strongestCompetitor ? 'danger' : 'dim'}
        hint={!hasOwnData && stats.strongestCompetitor ? 'Kendi site analizi gerekli' : undefined}
      />
      <StatCard
        label="Hızlı Fırsat"
        value={stats.fastestOpportunity ?? '—'}
        sub={stats.fastestOpportunity ? 'içerik açığı' : undefined}
        cardState={stats.fastestOpportunity ? 'good' : 'dim'}
        hint={stats.fastestOpportunity ? 'İçerik üret' : undefined}
      />
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  active,
  onFilter,
  search,
  onSearch,
  competitors,
}: {
  active: FilterId
  onFilter: (f: FilterId) => void
  search: string
  onSearch: (s: string) => void
  competitors: FullCompetitor[]
}) {
  const counts: Partial<Record<FilterId, number>> = {
    all:          competitors.length,
    withData:     competitors.filter(c => c.category_structure !== null).length,
    highThreat:   competitors.filter(c => c.totalEtv >= 10000).length,
    mediumThreat: competitors.filter(c => c.totalEtv >= 2000 && c.totalEtv < 10000).length,
  }

  return (
    <div className="space-y-2">
      {/* Search */}
      <Input
        placeholder="Domain, keyword veya sayfa tipi ara…"
        value={search}
        onChange={e => onSearch(e.target.value)}
        className="max-w-sm h-8 text-sm"
      />
      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_DEFS.map(f => {
          const count = counts[f.id]
          const isActive = active === f.id
          return (
            <button
              key={f.id}
              onClick={() => onFilter(f.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-secondary/30 text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground/70'
              }`}
            >
              {f.label}{count !== undefined ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Comparison bar (bottom sticky) ──────────────────────────────────────────

function ComparisonBar({ selected, competitors, onCompare, onClear, onDeselect }: {
  selected: Set<string>
  competitors: FullCompetitor[]
  onCompare: () => void
  onClear: () => void
  onDeselect: (id: string) => void
}) {
  if (selected.size < 2) return null
  const items = [...selected]
    .map(id => competitors.find(c => c.id === id))
    .filter((c): c is FullCompetitor => !!c)

  return (
    <div className="sticky bottom-4 z-20 mx-auto max-w-2xl">
      <div className="rounded-xl border border-border bg-background/95 backdrop-blur shadow-xl px-4 py-3 space-y-2">
        {/* Selected domain chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground shrink-0">{selected.size} rakip seçildi:</span>
          {items.map(comp => (
            <span
              key={comp.id}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary/60 border border-border"
            >
              <span className="truncate max-w-[120px]">{comp.domain}</span>
              <button
                onClick={() => onDeselect(comp.id)}
                className="text-muted-foreground hover:text-foreground leading-none ml-0.5"
                aria-label={`${comp.domain} seçimini kaldır`}
              >×</button>
            </span>
          ))}
        </div>
        {/* Action row */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground">
            ETV · keyword · gap · güçlü/zayıf yön karşılaştırması
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Temizle
            </button>
            <button
              onClick={onCompare}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
            >
              Karşılaştır ({selected.size}) →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Insight strip ────────────────────────────────────────────────────────────

function InsightStrip({ comp }: { comp: FullCompetitor }) {
  const why = whyImportant(comp)
  const win = quickWin(comp)
  const isDefault = why === 'Henüz analiz edilmedi'
  if (isDefault && !win && comp.gapCategories.length === 0) return null

  return (
    <div className="px-4 pb-2 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground min-w-[820px]">
      <span className="text-foreground/55 truncate max-w-xs">{why}</span>
      <div className="flex items-center gap-1">
        {comp.gapCategories.slice(0, 3).map(cat => (
          <span key={cat} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/20 text-[10px] whitespace-nowrap">
            {cat}
          </span>
        ))}
      </div>
      {win && (
        <span className="text-emerald-400/70 truncate max-w-[220px]">→ {win}</span>
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

const COL = 'grid grid-cols-[24px_minmax(160px,2fr)_72px_88px_minmax(100px,1fr)_minmax(110px,1fr)_52px_80px_48px] gap-x-3'

function CompetitorRow({
  comp,
  projectId,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
}: {
  comp: FullCompetitor
  projectId: string
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
}) {
  const threat    = comp.totalEtv > 0 ? getThreat(comp.totalEtv) : null
  const domCat    = getDominantCat(comp.category_structure)
  const bestKw    = getBestKeyword(comp.ranked_keywords)
  const state     = getDataState(comp)
  const stateCfg  = DATA_STATE_CONFIG[state]

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Main row */}
      <div
        className={`${COL} px-4 py-3 items-center hover:bg-secondary/15 transition-colors min-w-[820px]`}
      >
        {/* Checkbox */}
        <div onClick={e => { e.stopPropagation(); onToggleSelect() }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded border-border accent-primary cursor-pointer"
            aria-label={`${comp.domain} karşılaştırma seç`}
          />
        </div>

        {/* Domain + expand trigger */}
        <div
          className="flex items-center gap-2 min-w-0 cursor-pointer"
          onClick={onToggleExpand}
        >
          <span className={`text-muted-foreground/50 text-[10px] transition-transform duration-150 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium text-sm truncate">{comp.domain}</span>
          {!comp.content_areas && !comp.category_structure && (
            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded border border-slate-500/30 bg-slate-500/10 text-slate-400 leading-none">
              Eksik Analiz
            </span>
          )}
        </div>

        {/* Kaynak */}
        <div>
          <Badge className={`text-[10px] py-0 cursor-default ${comp.source === 'serp'
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
            {comp.source === 'serp' ? 'SERP' : 'Manuel'}
          </Badge>
        </div>

        {/* Tehdit */}
        <div
          className="cursor-pointer"
          onClick={onToggleExpand}
        >
          {threat
            ? <Badge className={`${threat.cls} border text-[10px] py-0`}>{threat.label}</Badge>
            : <span className="text-muted-foreground text-xs">—</span>
          }
        </div>

        {/* Baskın tip */}
        <div className="text-xs text-muted-foreground truncate cursor-pointer" onClick={onToggleExpand}>
          {domCat ?? '—'}
        </div>

        {/* Top keyword */}
        <div className="text-xs text-foreground/80 truncate cursor-pointer" onClick={onToggleExpand}>
          {bestKw?.keyword ?? '—'}
        </div>

        {/* Gap */}
        <div className="text-right text-xs cursor-pointer" onClick={onToggleExpand}>
          {comp.gapCount > 0
            ? <span className="text-amber-400 font-semibold">{comp.gapCount}</span>
            : <span className="text-muted-foreground">—</span>
          }
        </div>

        {/* Veri durumu */}
        <div>
          <Badge className={`${stateCfg.cls} border text-[10px] py-0 cursor-default`}>
            {stateCfg.label}
          </Badge>
        </div>

        {/* Fetch button — compact icon */}
        <div onClick={e => e.stopPropagation()} className="flex justify-center">
          <CompetitorFetchButton
            competitorId={comp.id}
            projectId={projectId}
            lastFetched={comp.top_pages ? comp.updated_at : null}
            compact
          />
        </div>
      </div>

      {/* Insight strip — visible without opening accordion */}
      {!isExpanded && <InsightStrip comp={comp} />}

      {/* Accordion panel */}
      {isExpanded && (
        <div className="border-t border-border/50 bg-background/40 p-4">
          <RakiplerAccordion comp={comp} projectId={projectId} />
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RakiplerTable({
  competitors,
  projectId,
  summaryStats,
  hasOwnData,
}: {
  competitors: FullCompetitor[]
  projectId: string
  summaryStats: SummaryStats
  hasOwnData: boolean
}) {
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [search, setSearch]             = useState('')
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [showComparison, setShowComparison] = useState(false)

  const flowStep: 1 | 2 | 3 | 4 = showComparison ? 4 : expandedId ? 2 : 1

  const filtered = useMemo(() => {
    const afterSearch = applySearch(competitors, search)
    return applyFilter(afterSearch, activeFilter)
  }, [competitors, activeFilter, search])

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCompetitors = competitors.filter(c => selectedIds.has(c.id))

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <SummaryBar stats={summaryStats} hasOwnData={hasOwnData} />

      {/* Flow indicator */}
      <FlowIndicator activeStep={flowStep} />

      {/* Filters + search */}
      <FilterBar
        active={activeFilter}
        onFilter={f => { setActiveFilter(f); setExpandedId(null) }}
        search={search}
        onSearch={setSearch}
        competitors={competitors}
      />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center rounded-lg border border-border space-y-1.5">
          <p className="text-sm text-muted-foreground">
            {search ? `"${search}" için sonuç bulunamadı.` : 'Bu filtreye uyan rakip yok.'}
          </p>
          <p className="text-xs text-muted-foreground/50">
            {search ? 'Domain adı, keyword veya kategori adıyla arayabilirsiniz.' : '"Tümü" filtresine geçin veya başka bir filtre deneyin.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          {/* Header */}
          <div className={`${COL} px-4 py-2.5 bg-secondary/30 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[820px]`}>
            <div title="Karşılaştırma seç">☐</div>
            <div>Domain</div>
            <div>Kaynak</div>
            <div>Tehdit</div>
            <div>Baskın Tip</div>
            <div>Güçlü Keyword</div>
            <div className="text-right">Gap</div>
            <div>Veri</div>
            <div title="Veri çek / yenile">↺</div>
          </div>

          {filtered.map(comp => (
            <CompetitorRow
              key={comp.id}
              comp={comp}
              projectId={projectId}
              isExpanded={expandedId === comp.id}
              isSelected={selectedIds.has(comp.id)}
              onToggleExpand={() => toggleExpand(comp.id)}
              onToggleSelect={() => toggleSelect(comp.id)}
            />
          ))}
        </div>
      )}

      {/* Comparison sticky bar */}
      <ComparisonBar
        selected={selectedIds}
        competitors={competitors}
        onCompare={() => setShowComparison(true)}
        onClear={() => setSelectedIds(new Set())}
        onDeselect={id => toggleSelect(id)}
      />

      {/* Comparison modal */}
      {showComparison && selectedCompetitors.length >= 2 && (
        <RakiplerComparison
          competitors={selectedCompetitors}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  )
}
