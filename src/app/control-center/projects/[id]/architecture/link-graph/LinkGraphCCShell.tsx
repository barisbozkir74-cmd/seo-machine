'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { type GraphData, type NodeData } from '@/app/(dashboard)/projeler/[id]/ic-link-haritasi/computeGraph'
import { type LastCrawlJob } from '@/app/(dashboard)/projeler/[id]/ic-link-haritasi/page'
import { LinkMapShell } from '@/app/(dashboard)/projeler/[id]/ic-link-haritasi/LinkMapShell'
import { cn } from '@/lib/utils'

// ── Semantic network card view ──────────────────────────────────────────────

function getNetworkBadges(node: NodeData, isHub: boolean): { label: string; cls: string }[] {
  const badges: { label: string; cls: string }[] = []
  if (node.is_root) badges.push({ label: 'Kök', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/30' })
  if (isHub && !node.is_root) badges.push({ label: 'Hub', cls: 'text-purple-400 bg-purple-500/10 border-purple-500/30' })
  if (node.is_orphan) badges.push({ label: 'Orphan', cls: 'text-red-400 bg-red-500/10 border-red-500/30' })
  if (node.is_link_opportunity) badges.push({ label: 'Fırsat', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/25' })
  return badges
}

function NetworkCard({
  node,
  isHub,
  isSelected,
  onSelect,
}: {
  node: NodeData
  isHub: boolean
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const badges = getNetworkBadges(node, isHub)

  return (
    <button
      onClick={() => onSelect(node.page.id)}
      className={cn(
        'w-full text-left rounded-lg border p-3 transition-all hover:border-foreground/20 hover:bg-secondary/30',
        isSelected
          ? 'border-foreground/30 bg-secondary/40 ring-1 ring-foreground/20'
          : node.is_orphan
          ? 'border-red-500/25 bg-red-500/5'
          : isHub
          ? 'border-purple-500/25 bg-purple-500/5'
          : 'border-border bg-background',
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-foreground line-clamp-2 leading-snug flex-1">
          {node.page.title || node.page.slug || '(isimsiz)'}
        </span>
        {node.page.page_type && (
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/50 shrink-0 pt-0.5">
            {node.page.page_type}
          </span>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {badges.map(b => (
            <span
              key={b.label}
              className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded border', b.cls)}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{node.in_count}</span> gelen
        </span>
        <span className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{node.out_count}</span> giden
        </span>
        {node.depth !== null && (
          <span className="text-[10px] text-muted-foreground">
            D<span className="font-medium text-foreground/70">{node.depth}</span>
          </span>
        )}
        {node.gsc_impressions > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {node.gsc_impressions.toLocaleString('tr')} imp.
          </span>
        )}
      </div>
    </button>
  )
}

function PageDetailPanel({
  node,
  onClose,
}: {
  node: NodeData
  onClose: () => void
}) {
  return (
    <div className="border-t border-border bg-background/60 px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{node.page.title}</span>
        <button
          onClick={onClose}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Kapat
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Outgoing links */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
            Giden Linkler ({node.out_links.length})
          </p>
          {node.out_links.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50">Link yok</p>
          ) : (
            <ul className="space-y-1">
              {node.out_links.slice(0, 12).map(l => (
                <li key={l.link_id} className="flex items-center gap-1.5">
                  {l.is_broken_ref && (
                    <span className="text-[9px] text-red-400 shrink-0">!</span>
                  )}
                  <span className="text-[11px] text-foreground/70 truncate">
                    {l.target_title ?? '(harici / silinmiş)'}
                  </span>
                  {l.anchor_text && (
                    <span className="text-[9px] text-muted-foreground/40 truncate italic shrink-0 max-w-[60px]">
                      "{l.anchor_text}"
                    </span>
                  )}
                </li>
              ))}
              {node.out_links.length > 12 && (
                <li className="text-[10px] text-muted-foreground/40">
                  +{node.out_links.length - 12} daha
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Incoming links */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
            Gelen Linkler ({node.in_links.length})
          </p>
          {node.in_links.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50">
              {node.is_root ? 'Kök sayfa' : 'Orphan — gelen link yok'}
            </p>
          ) : (
            <ul className="space-y-1">
              {node.in_links.slice(0, 12).map(l => (
                <li key={l.link_id} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-foreground/70 truncate">
                    {l.source_title}
                  </span>
                  {l.anchor_text && (
                    <span className="text-[9px] text-muted-foreground/40 truncate italic shrink-0 max-w-[60px]">
                      "{l.anchor_text}"
                    </span>
                  )}
                </li>
              ))}
              {node.in_links.length > 12 && (
                <li className="text-[10px] text-muted-foreground/40">
                  +{node.in_links.length - 12} daha
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function NetworkView({
  nodes,
  selectedPageId,
  onSelect,
}: {
  nodes: NodeData[]
  selectedPageId: string | null
  onSelect: (id: string | null) => void
}) {
  // Calculate hub threshold: top 20% by in_count
  const sorted = useMemo(
    () => [...nodes].sort((a, b) => b.in_count - a.in_count),
    [nodes],
  )
  const hubCutoff = useMemo(() => {
    const idx = Math.floor(sorted.length * 0.2)
    return sorted[idx]?.in_count ?? 0
  }, [sorted])

  const isHub = useCallback(
    (n: NodeData) => n.in_count > 0 && n.in_count >= hubCutoff && !n.is_orphan,
    [hubCutoff],
  )

  const hubPages = useMemo(() => nodes.filter(n => isHub(n) || n.is_root), [nodes, isHub])
  const isolatedPages = useMemo(() => nodes.filter(n => n.is_orphan && !n.is_root), [nodes])
  const connectedPages = useMemo(
    () => nodes.filter(n => !isHub(n) && !n.is_orphan && !n.is_root),
    [nodes, isHub],
  )

  const selectedNode = useMemo(
    () => nodes.find(n => n.page.id === selectedPageId) ?? null,
    [nodes, selectedPageId],
  )

  const handleSelect = (id: string) => {
    onSelect(selectedPageId === id ? null : id)
  }

  const Section = ({
    title,
    count,
    children,
    accent,
  }: {
    title: string
    count: number
    children: React.ReactNode
    accent?: string
  }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('text-[10px] font-bold uppercase tracking-[0.1em]', accent ?? 'text-muted-foreground/60')}>
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground/40">({count})</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {children}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">Henüz sayfa eklenmemiş.</p>
          </div>
        ) : (
          <>
            {hubPages.length > 0 && (
              <Section title="Hub Sayfalar" count={hubPages.length} accent="text-purple-400/70">
                {hubPages.map(n => (
                  <NetworkCard
                    key={n.page.id}
                    node={n}
                    isHub={isHub(n)}
                    isSelected={n.page.id === selectedPageId}
                    onSelect={handleSelect}
                  />
                ))}
              </Section>
            )}
            {connectedPages.length > 0 && (
              <Section title="Bagli Sayfalar" count={connectedPages.length}>
                {connectedPages.map(n => (
                  <NetworkCard
                    key={n.page.id}
                    node={n}
                    isHub={false}
                    isSelected={n.page.id === selectedPageId}
                    onSelect={handleSelect}
                  />
                ))}
              </Section>
            )}
            {isolatedPages.length > 0 && (
              <Section title="Izole Sayfalar (Orphan)" count={isolatedPages.length} accent="text-red-400/70">
                {isolatedPages.map(n => (
                  <NetworkCard
                    key={n.page.id}
                    node={n}
                    isHub={false}
                    isSelected={n.page.id === selectedPageId}
                    onSelect={handleSelect}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </div>

      {/* Page detail panel — expanded inline at the bottom */}
      {selectedNode && (
        <PageDetailPanel node={selectedNode} onClose={() => onSelect(null)} />
      )}
    </div>
  )
}

// ── Main shell ──────────────────────────────────────────────────────────────

export function LinkGraphCCShell({
  projectId,
  graphData,
  lastJob,
  initialView,
  initialSelected,
}: {
  projectId: string
  graphData: GraphData
  lastJob: LastCrawlJob | null
  initialView: 'list' | 'network'
  initialSelected: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setView = useCallback(
    (v: 'list' | 'network') => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('view', v)
      params.delete('selected')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const setSelected = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id) {
        params.set('selected', id)
      } else {
        params.delete('selected')
      }
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const view = initialView
  const selectedPageId = initialSelected

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* View Toggle Bar */}
      <div className="shrink-0 border-b border-border px-5 py-2 flex items-center gap-2">
        <div className="flex items-center border border-border rounded-md p-0.5 gap-px">
          {(['list', 'network'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'text-xs px-2.5 py-1 rounded transition-colors',
                view === v
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'list' ? 'Liste' : 'Ag'}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground/40">
          {view === 'list' ? 'Tablo ve graf analizi' : 'Semantik kart gorunumu'}
        </span>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <LinkMapShell
          projectId={projectId}
          graphData={graphData}
          lastJob={lastJob}
        />
      ) : (
        <NetworkView
          nodes={graphData.nodes}
          selectedPageId={selectedPageId}
          onSelect={setSelected}
        />
      )}
    </div>
  )
}
