'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { IntentBadge } from './IntentBadge'
import { KeywordDeleteButton } from './KeywordDeleteButton'
import { bulkDeleteKeywords } from './actions'

type KeywordRow = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  search_intent: string | null
  enriched_at: string | null
  cluster_id: string | null
  opportunity_score: number | null
  source: 'manual' | 'competitor' | 'expansion' | 'seed'
  is_starred: boolean
  is_ai_suggested: boolean
  long_tail_flag: boolean
  faq_flag: boolean
  comparison_flag: boolean
  keyword_role: string | null
}

type SortCol = 'volume' | 'cpc' | 'difficulty' | 'opportunity_score'
type SortDir = 'asc' | 'desc'

const ROLE_COLORS: Record<string, string> = {
  focus:         'bg-amber-500/20 text-amber-400',
  supporting:    'bg-blue-500/20 text-blue-400',
  synonym:       'bg-teal-500/20 text-teal-400',
  long_tail:     'bg-secondary text-muted-foreground',
  question:      'bg-sky-500/20 text-sky-400',
  commercial:    'bg-orange-500/20 text-orange-400',
  local:         'bg-emerald-500/20 text-emerald-400',
  comparison:    'bg-orange-500/20 text-orange-400',
  separate_page: 'bg-violet-500/20 text-violet-400',
}

const ROLE_LABELS: Record<string, string> = {
  focus: 'Focus', supporting: 'Supporting', synonym: 'Synonym',
  long_tail: 'L.Tail', question: 'Q&A', commercial: 'Comm.',
  local: 'Local', comparison: 'Comp.', separate_page: 'Sep.Page',
}

function kdColor(kd: number) {
  if (kd < 30) return { dot: 'bg-emerald-400', label: 'Kolay' }
  if (kd <= 60) return { dot: 'bg-amber-400', label: 'Orta' }
  return { dot: 'bg-red-400', label: 'Zor' }
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}

const INTENT_OPTS = ['informational', 'commercial', 'transactional', 'navigational']
const INTENT_LABELS: Record<string, string> = {
  informational: 'Bilgi', commercial: 'Ticari',
  transactional: 'İşlem', navigational: 'Nav.',
}
const ROLE_OPTS = [
  'focus', 'supporting', 'synonym', 'long_tail',
  'question', 'commercial', 'local', 'comparison', 'separate_page',
]
const SOURCE_OPTS = ['manual', 'seed', 'competitor', 'expansion']
const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manuel', seed: 'Tohum', competitor: 'Rakip', expansion: 'Genişletme',
}

// ─── Filter Select ────────────────────────────────────────────────────────────

function FilterSelect({
  label, value, options, getLabel, onChange,
}: {
  label: string
  value: string | null
  options: string[]
  getLabel?: (v: string) => string
  onChange: (v: string | null) => void
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`h-7 pl-2 pr-6 text-xs rounded border appearance-none cursor-pointer focus:outline-none transition-colors ${
          value
            ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
            : 'border-border bg-secondary/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
        }`}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-background text-foreground">
            {getLabel ? getLabel(opt) : opt}
          </option>
        ))}
      </select>
      <svg
        width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/60"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  search, onSearch,
  filterIntent, onIntent,
  filterRole, onRole,
  filterSource, onSource,
  filterCluster, onCluster,
  clusterMap, total, filteredCount, onClear,
}: {
  search: string
  onSearch: (v: string) => void
  filterIntent: string | null
  onIntent: (v: string | null) => void
  filterRole: string | null
  onRole: (v: string | null) => void
  filterSource: string | null
  onSource: (v: string | null) => void
  filterCluster: string | null
  onCluster: (v: string | null) => void
  clusterMap: Record<string, string>
  total: number
  filteredCount: number
  onClear: () => void
}) {
  const hasFilter = !!(search || filterIntent || filterRole || filterSource || filterCluster)
  const clusterEntries = Object.entries(clusterMap)

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-background shrink-0 flex-wrap">
      {/* Search */}
      <div className="relative">
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Keyword ara…"
          className="h-7 pl-7 pr-3 text-xs rounded border border-border bg-secondary/40 focus:outline-none focus:border-border/80 placeholder:text-muted-foreground/40 w-40"
        />
      </div>

      <FilterSelect
        label="Intent"
        value={filterIntent}
        options={INTENT_OPTS}
        getLabel={(v) => INTENT_LABELS[v] ?? v}
        onChange={onIntent}
      />
      <FilterSelect
        label="Rol"
        value={filterRole}
        options={ROLE_OPTS}
        getLabel={(v) => ROLE_LABELS[v] ?? v}
        onChange={onRole}
      />
      <FilterSelect
        label="Kaynak"
        value={filterSource}
        options={SOURCE_OPTS}
        getLabel={(v) => SOURCE_LABELS[v] ?? v}
        onChange={onSource}
      />

      {clusterEntries.length > 0 && (
        <div className="relative">
          <select
            value={filterCluster ?? ''}
            onChange={(e) => onCluster(e.target.value || null)}
            className={`h-7 pl-2 pr-6 text-xs rounded border appearance-none cursor-pointer focus:outline-none transition-colors max-w-36 ${
              filterCluster
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-border bg-secondary/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
            }`}
          >
            <option value="">Küme</option>
            <option value="none" className="bg-background text-foreground">— Küme yok</option>
            {clusterEntries.map(([cid, name]) => (
              <option key={cid} value={cid} className="bg-background text-foreground">{name}</option>
            ))}
          </select>
          <svg
            width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/60"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}

      {/* Count */}
      <span className="text-xs text-muted-foreground/50 tabular-nums">
        {hasFilter ? (
          <><span className="text-foreground/70">{filteredCount}</span>/{total}</>
        ) : (
          <>{total} keyword</>
        )}
      </span>

      {/* Clear */}
      {hasFilter && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Temizle
        </button>
      )}
    </div>
  )
}

// ─── Sortable Column Header ───────────────────────────────────────────────────

function SortHead({
  col, label, sortCol, sortDir, onSort, className,
}: {
  col: SortCol
  label: string
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
  className?: string
}) {
  const active = sortCol === col
  return (
    <TableHead
      className={`text-xs py-2 cursor-pointer select-none hover:text-foreground transition-colors ${active ? 'text-foreground' : ''} ${className ?? ''}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-0.5 justify-end">
        {label}
        {active ? (
          <span className="text-violet-400 ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>
        ) : (
          <span className="text-muted-foreground/20 ml-0.5">↕</span>
        )}
      </span>
    </TableHead>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface KeywordFlatListProps {
  keywords: KeywordRow[]
  projectId: string
  clusterMap: Record<string, string>
  localeFlaggedIds?: Set<string>
}

export function KeywordFlatList({ keywords, projectId, clusterMap, localeFlaggedIds }: KeywordFlatListProps) {
  const router = useRouter()

  const [search, setSearch]               = useState('')
  const [filterIntent, setFilterIntent]   = useState<string | null>(null)
  const [filterRole, setFilterRole]       = useState<string | null>(null)
  const [filterSource, setFilterSource]   = useState<string | null>(null)
  const [filterCluster, setFilterCluster] = useState<string | null>(null)
  const [sortCol, setSortCol]             = useState<SortCol>('volume')
  const [sortDir, setSortDir]             = useState<SortDir>('desc')

  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError]         = useState<string | null>(null)

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setFilterIntent(null)
    setFilterRole(null)
    setFilterSource(null)
    setFilterCluster(null)
  }

  const displayKeywords = useMemo(() => {
    let result = keywords

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((kw) => kw.keyword.toLowerCase().includes(q))
    }
    if (filterIntent) result = result.filter((kw) => kw.search_intent === filterIntent)
    if (filterRole)   result = result.filter((kw) => kw.keyword_role === filterRole)
    if (filterSource) result = result.filter((kw) => kw.source === filterSource)
    if (filterCluster === 'none') result = result.filter((kw) => !kw.cluster_id)
    else if (filterCluster)       result = result.filter((kw) => kw.cluster_id === filterCluster)

    return [...result].sort((a, b) => {
      const av = (a[sortCol] ?? -1) as number
      const bv = (b[sortCol] ?? -1) as number
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [keywords, search, filterIntent, filterRole, filterSource, filterCluster, sortCol, sortDir])

  const allSelected  = displayKeywords.length > 0 && displayKeywords.every((kw) => selected.has(kw.id))
  const someSelected = !allSelected && displayKeywords.some((kw) => selected.has(kw.id))

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        displayKeywords.forEach((kw) => next.delete(kw.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        displayKeywords.forEach((kw) => next.add(kw.id))
        return next
      })
    }
  }

  const handleBulkDelete = () => {
    if (selected.size === 0 || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await bulkDeleteKeywords(projectId, Array.from(selected))
      if (!result.success) { setError(result.error); return }
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col h-full">

      {/* Filter bar */}
      <FilterBar
        search={search}               onSearch={setSearch}
        filterIntent={filterIntent}   onIntent={setFilterIntent}
        filterRole={filterRole}       onRole={setFilterRole}
        filterSource={filterSource}   onSource={setFilterSource}
        filterCluster={filterCluster} onCluster={setFilterCluster}
        clusterMap={clusterMap}
        total={keywords.length}
        filteredCount={displayKeywords.length}
        onClear={clearFilters}
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selected.size} keyword seçildi</span>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Seçimi Kaldır
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Siliniyor…
                </>
              ) : `${selected.size} Keyword'i Sil`}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {displayKeywords.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">
              {keywords.length === 0
                ? 'Henüz keyword eklenmemiş.'
                : 'Filtrelerle eşleşen keyword yok.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background border-b border-border">
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableHead className="w-8 py-2 pl-3">
                  <button
                    onClick={toggleAll}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                      allSelected
                        ? 'bg-foreground border-foreground text-background'
                        : someSelected
                        ? 'bg-foreground/30 border-foreground/50'
                        : 'border-border hover:border-foreground/40'
                    }`}
                    aria-label={allSelected ? 'Tüm seçimi kaldır' : 'Tümünü seç'}
                  >
                    {allSelected && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {someSelected && !allSelected && (
                      <span className="w-2 h-0.5 bg-foreground/80 rounded-full" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-8 py-2" />
                <TableHead className="text-xs py-2">Keyword</TableHead>
                <SortHead col="volume"            label="Vol"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-20" />
                <SortHead col="cpc"               label="CPC"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-16" />
                <SortHead col="difficulty"        label="KD"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-20" />
                <SortHead col="opportunity_score" label="Skor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-14" />
                <TableHead className="text-xs w-24 py-2">Kaynak</TableHead>
                <TableHead className="text-xs w-32 py-2">Küme</TableHead>
                <TableHead className="text-xs w-24 py-2">Intent</TableHead>
                <TableHead className="text-xs w-28 py-2">Rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayKeywords.map((kw) => {
                const isEnriching = !kw.enriched_at
                const { dot, label } = kdColor(kw.difficulty ?? 0)
                const clusterName = kw.cluster_id ? clusterMap[kw.cluster_id] : null
                const isSelected = selected.has(kw.id)
                const roleColor = kw.keyword_role ? (ROLE_COLORS[kw.keyword_role] ?? 'bg-secondary text-muted-foreground') : null
                const roleLabel = kw.keyword_role ? (ROLE_LABELS[kw.keyword_role] ?? kw.keyword_role) : null

                return (
                  <TableRow
                    key={kw.id}
                    className={`group h-9 cursor-pointer ${isSelected ? 'bg-secondary/60' : ''}`}
                    onClick={() => toggleRow(kw.id)}
                  >
                    <TableCell className="w-8 py-1 pl-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleRow(kw.id)}
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-foreground border-foreground text-background'
                            : 'border-border opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isSelected && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="w-8 py-1" onClick={(e) => e.stopPropagation()}>
                      {selected.size === 0 && (
                        <KeywordDeleteButton projectId={projectId} keywordId={kw.id} />
                      )}
                    </TableCell>
                    <TableCell className={`py-1 text-sm${isEnriching ? ' opacity-50' : ''}`}>
                      <span className="flex items-center gap-1.5">
                        {kw.keyword}
                        {localeFlaggedIds?.has(kw.id) && (
                          <span
                            className="shrink-0 rounded border border-blue-400/30 bg-blue-400/10 px-1 py-0 text-[9px] font-medium text-blue-400/70 select-none"
                            title="Dil Uyarısı: Bu keyword Türkçe karakter içermiyor"
                          >
                            EN?
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className={`py-1 text-xs text-right tabular-nums${isEnriching ? ' opacity-50' : ''}`}>
                      {kw.volume !== null ? formatVolume(kw.volume) : '—'}
                    </TableCell>
                    <TableCell className={`py-1 text-xs text-right tabular-nums${isEnriching ? ' opacity-50' : ''}`}>
                      {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className={`py-1${isEnriching ? ' opacity-50' : ''}`}>
                      {kw.difficulty !== null ? (
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-1 text-right w-14">
                      {kw.opportunity_score === null ? (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      ) : kw.opportunity_score >= 70 ? (
                        <Badge className="bg-violet-500/20 text-violet-400 text-xs border-0 px-1.5 py-0">
                          {kw.opportunity_score.toFixed(0)}
                        </Badge>
                      ) : kw.opportunity_score >= 40 ? (
                        <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0 px-1.5 py-0">
                          {kw.opportunity_score.toFixed(0)}
                        </Badge>
                      ) : (
                        <Badge className="bg-secondary text-muted-foreground text-xs border-0 px-1.5 py-0">
                          {kw.opportunity_score.toFixed(0)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-1 w-24">
                      {kw.source === 'manual' ? (
                        <Badge className="bg-secondary text-muted-foreground text-xs border-0 px-1.5 py-0">Manuel</Badge>
                      ) : kw.source === 'competitor' ? (
                        <Badge className="bg-blue-500/20 text-blue-400 text-xs border-0 px-1.5 py-0">Rakip</Badge>
                      ) : kw.source === 'seed' ? (
                        <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0 px-1.5 py-0">Tohum</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs border-0 px-1.5 py-0">Genişletme</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-1 w-32">
                      {clusterName ? (
                        <span className="text-xs text-muted-foreground truncate block max-w-28">{clusterName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 w-24">
                      {isEnriching ? (
                        <svg className="animate-spin h-3 w-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <IntentBadge intent={kw.search_intent} />
                      )}
                    </TableCell>
                    <TableCell className="py-1 w-28">
                      {roleLabel && roleColor ? (
                        <Badge className={`text-[10px] border-0 px-1.5 py-0 ${roleColor}`}>{roleLabel}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
