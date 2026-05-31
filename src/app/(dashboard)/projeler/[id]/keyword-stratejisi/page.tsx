import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { IntentBadge } from './IntentBadge'
import { KeywordDeleteButton } from './KeywordDeleteButton'
import { ProjectNav } from '../ProjectNav'
import { AiAcquireButton } from './AiAcquireButton'
import { ClusterPanel } from './ClusterPanel'
import { AddKeywordDialog } from './AddKeywordDialog'
import { ProjectPageShell } from '../ProjectPageShell'
import { MasterSeoMap } from './MasterSeoMap'
import { AiSuggestButton } from './AiSuggestButton'
import { KeywordStratejisiToolbar } from './KeywordStratejisiToolbar'
import { AnalysisButtons } from './AnalysisButtons'
import { DeepAnalysisPoller } from './DeepAnalysisPoller'
import { intentToPageType } from '../site-blueprint/page-utils'
import { type DialogRow } from '../site-blueprint/GeneratePagesDialog'

// ─── Phase 24: dfs_fetched_at helper fonksiyonları ───────────────────────────

function isDfsStale(dfs_fetched_at: string, ttlDays: number): boolean {
  const diffMs = Date.now() - new Date(dfs_fetched_at).getTime()
  return diffMs > ttlDays * 24 * 60 * 60 * 1000
}

function formatDfsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

const DFS_TTL_DAYS = 3 // standard TTL default

function kdColor(kd: number): { dot: string; label: string } {
  if (kd < 30) return { dot: 'bg-emerald-400', label: 'Kolay' }
  if (kd <= 60) return { dot: 'bg-amber-400', label: 'Orta' }
  return { dot: 'bg-red-400', label: 'Zor' }
}

// D-05: inline copy (3-line helper, DRY feda edilebilir per D-05)
function stripIntentSuffix(name: string): string {
  return name
    .replace(/\s*\((commercial|informational|navigational|transactional|unknown)\)\s*$/i, '')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}

type KeywordRow = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  search_intent: string | null
  enriched_at: string | null
  dfs_fetched_at: string | null  // Phase 24: DFS-07
  cluster_id: string | null
  opportunity_score: number | null
  source: 'manual' | 'competitor' | 'expansion'
  parent_keyword_id: string | null
  is_starred: boolean
  is_ai_suggested: boolean
}

type ClusterWithKeywords = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  opportunity_score: number | null
  revenue_type: string | null
  status: string | null  // YENİ — D-07
  keywords: KeywordRow[]
}

export default async function KeywordStratejisiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string; sort?: string; dir?: string }>
}) {
  const { id } = await params
  const { view, sort, dir } = await searchParams
  const isMapView = view === 'map'
  const isClusterView = view !== 'flat' && view !== 'map'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, seo_arch_summary, seo_arch_built_at, keyword_strategy_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const { data: keywordsRaw } = await supabase
    .from('keywords')
    .select('id, keyword, volume, cpc, difficulty, search_intent, enriched_at, dfs_fetched_at, cluster_id, opportunity_score, source, parent_keyword_id, is_starred, is_ai_suggested')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('volume', { ascending: false, nullsFirst: false })

  const keywords: KeywordRow[] = (keywordsRaw ?? []) as KeywordRow[]

  const sortColumn = sort === 'niche_score' ? 'opportunity_score' : 'total_volume'
  const ascending = dir === 'asc'

  const { data: clustersRaw } = await supabase
    .from('keyword_clusters')
    .select('id, cluster_name, intent, primary_keyword_id, opportunity_score, revenue_type, total_volume, page_type, target_url, arch_status, ai_reasoning, priority_rank, content_month, status')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order(sortColumn, { ascending, nullsFirst: false })

  const clusters = clustersRaw ?? []

  // Phase 24: workflow_runs — aktif deep analysis var mı? (SSR)
  const { data: activeWorkflow } = await supabase
    .from('workflow_runs')
    .select('id, status, created_at')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .eq('workflow_type', 'dfs_deep_analysis')
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Phase 24: cluster sayısı — AnalysisButtons standardDisabled kontrolü için
  const { count: clusterCount } = await supabase
    .from('keyword_clusters')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id)
    .eq('user_id', user.id)

  // D-06: alreadyExists hesabı — cluster_id'si bir sayfaya bağlı olanları bul
  const { data: pagesWithClusters } = await supabase
    .from('pages')
    .select('cluster_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .not('cluster_id', 'is', null)

  const clusterIdsWithPages = new Set(
    (pagesWithClusters ?? []).map((p: { cluster_id: string }) => p.cluster_id)
  )

  const clusterMap: Record<string, string> = {}
  for (const c of clusters) {
    clusterMap[c.id] = c.cluster_name
  }

  const clusterKeywordMap: Record<string, KeywordRow[]> = {}
  for (const kw of keywords) {
    if (kw.cluster_id) {
      if (!clusterKeywordMap[kw.cluster_id]) clusterKeywordMap[kw.cluster_id] = []
      clusterKeywordMap[kw.cluster_id].push(kw)
    }
  }

  const clustersWithKeywords: ClusterWithKeywords[] = clusters.map((c) => ({
    ...c,
    status: (c as unknown as { status: string | null }).status ?? null,  // YENİ
    keywords: clusterKeywordMap[c.id] ?? [],
  }))

  // Zero-query approach: keyword metni zaten keywords[] içinde — yeni sorgu yok
  const keywordIdToText = new Map<string, string>()
  for (const kw of keywords) {
    keywordIdToText.set(kw.id, kw.keyword)
  }

  // D-02: sadece approved + primary_keyword_id olan cluster'lar dialog'a girer
  const approvedDialogRows: DialogRow[] = clustersWithKeywords
    .filter((c) => c.status === 'approved' && c.primary_keyword_id !== null)
    .map((c) => ({
      clusterId: c.id,
      clusterName: c.cluster_name,
      proposedName: stripIntentSuffix(c.cluster_name),
      proposedType: intentToPageType(c.intent),
      focusKeyword: c.primary_keyword_id
        ? (keywordIdToText.get(c.primary_keyword_id) ?? null)
        : null,
      focusKeywordId: c.primary_keyword_id,
      alreadyExists: clusterIdsWithPages.has(c.id),
    }))

  const allClusters = clusters.map((c) => ({
    id: c.id,
    cluster_name: c.cluster_name,
    intent: c.intent,
    keyword_count: (clusterKeywordMap[c.id] ?? []).length,
  }))

  const totalKeywords = keywords.length
  const totalClusters = clusters.length
  const pendingEnrichment = keywords.filter((kw) => !kw.enriched_at).length

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Üst başlık çubuğu ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/projeler/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            ← {project.name}
          </Link>
          <span className="text-muted-foreground/40 shrink-0">·</span>
          <span className="text-sm font-medium truncate">Keyword Stratejisi</span>
          {totalKeywords > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {totalKeywords} keyword · {totalClusters} küme
              {pendingEnrichment > 0 && (
                <span className="ml-1 text-amber-400">· {pendingEnrichment} zenginleştirilecek</span>
              )}
            </span>
          )}
        </div>

        {/* Araç çubuğu */}
        <div className="flex items-center gap-2 shrink-0">
          <AddKeywordDialog
            projectId={id}
            clusters={clusters.map((c) => ({ id: c.id, cluster_name: c.cluster_name }))}
          />
          <AiAcquireButton projectId={id} userId={user.id} />
          {totalKeywords > 0 && (
            <>
              <AiSuggestButton projectId={id} />
              <KeywordStratejisiToolbar
                projectId={id}
                hasExistingClusters={totalClusters > 0}
                hasApprovedCluster={clustersWithKeywords.some((c) => c.status === 'approved')}
                isStrategyApproved={(project as unknown as { keyword_strategy_approved: boolean | null }).keyword_strategy_approved ?? false}
                approvedDialogRows={approvedDialogRows}
              />
              {/* Phase 24: DataForSEO analiz butonları — separator + cyan buton grubu */}
              <span className="h-4 w-px bg-border/50 shrink-0" />
              <AnalysisButtons
                projectId={id}
                keywordCount={keywords.length}
                clusterCount={clusterCount ?? 0}
                isAnalysisRunning={!!activeWorkflow}
              />
              {/* Phase 24: Deep analiz polling — activeWorkflow varsa mount et */}
              {activeWorkflow && (
                <DeepAnalysisPoller
                  initialStatus={activeWorkflow.status as 'pending' | 'running'}
                  currentStatus={activeWorkflow.status as 'pending' | 'running' | 'done' | 'failed' | 'timeout'}
                />
              )}
            </>
          )}
          {/* Görünüm seçici */}
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <Link
              href={`/projeler/${id}/keyword-stratejisi`}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${isClusterView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Kümeler
            </Link>
            <Link
              href={`/projeler/${id}/keyword-stratejisi?view=flat`}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${view === 'flat' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Liste
            </Link>
            <Link
              href={`/projeler/${id}/keyword-stratejisi?view=map`}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${isMapView ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              SEO Haritası
            </Link>
          </div>
        </div>
      </div>

      {/* ── Ana içerik (sol nav + tablo + AI chat) ── */}
      <ProjectPageShell projectId={id} section="keyword-stratejisi">

        {/* Sol navigasyon */}
        <div className="w-56 shrink-0 border-r border-border overflow-y-auto p-3">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/keyword-stratejisi`} />
        </div>

        {/* Tablo / Harita alanı */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">

          {isMapView ? (
            <MasterSeoMap
              projectId={id}
              clusters={clusters.map((c) => ({
                id: c.id,
                cluster_name: c.cluster_name,
                page_type: (c as unknown as Record<string, string | null>).page_type ?? null,
                target_url: (c as unknown as Record<string, string | null>).target_url ?? null,
                arch_status: (c as unknown as Record<string, string | null>).arch_status ?? null,
                ai_reasoning: (c as unknown as Record<string, string | null>).ai_reasoning ?? null,
                priority_rank: (c as unknown as Record<string, number | null>).priority_rank ?? null,
                content_month: (c as unknown as Record<string, number | null>).content_month ?? null,
                intent: c.intent ?? null,
                total_volume: (c as unknown as Record<string, number | null>).total_volume ?? null,
                keyword_count: (clusterKeywordMap[c.id] ?? []).length,
              }))}
              archSummary={(project as unknown as Record<string, string | null>).seo_arch_summary ?? null}
              archBuiltAt={(project as unknown as Record<string, string | null>).seo_arch_built_at ?? null}
            />
          ) : keywords.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Henüz keyword eklenmemiş.</p>
                <p className="text-xs text-muted-foreground">Sağ üstten keyword ekleyebilir veya AI ile çekebilirsin.</p>
              </div>
            </div>

          ) : isClusterView ? (
            <div className="flex-1 overflow-y-auto p-4">
              {clustersWithKeywords.length > 0 && (
                <div className="flex items-center justify-end gap-3 pb-2">
                  <span className="text-xs text-muted-foreground w-28 text-left">Revenue</span>
                  {(() => {
                    const isActive = sort === 'niche_score'
                    const nextDir = isActive && dir === 'desc' ? 'asc'
                      : isActive && dir === 'asc' ? undefined
                      : 'desc'
                    const href = nextDir
                      ? `/projeler/${id}/keyword-stratejisi?view=cluster&sort=niche_score&dir=${nextDir}`
                      : `/projeler/${id}/keyword-stratejisi?view=cluster`
                    return (
                      <Link
                        href={href}
                        className="text-xs text-muted-foreground hover:text-foreground w-24 text-right transition-colors"
                      >
                        Niche Skoru{isActive && dir === 'desc' ? ' ↓' : isActive && dir === 'asc' ? ' ↑' : ''}
                      </Link>
                    )
                  })()}
                  <div className="w-8" />
                </div>
              )}
              <ClusterPanel
                clusters={clustersWithKeywords}
                allClusters={allClusters}
                projectId={id}
              />
            </div>

          ) : (
            /* Düz tablo — tam yükseklik, sticky header */
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b border-border">
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                    <TableHead className="text-xs w-8 py-2" />
                    <TableHead className="text-xs py-2">Keyword</TableHead>
                    <TableHead className="text-xs text-right w-20 py-2">Volume</TableHead>
                    <TableHead className="text-xs text-right w-16 py-2">CPC</TableHead>
                    <TableHead className="text-xs w-20 py-2">KD</TableHead>
                    <TableHead className="text-xs w-24 py-2">Kaynak</TableHead>
                    <TableHead className="text-xs w-32 py-2">Küme</TableHead>
                    <TableHead className="text-xs text-right w-14 py-2">Skor</TableHead>
                    <TableHead className="text-xs w-24 py-2">Intent</TableHead>
                    {/* Phase 24: DFS Tarihi sütunu */}
                    <TableHead className="text-xs w-28 py-2 text-cyan-400/70">DFS Tarihi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((kw) => {
                    const isEnriching = !kw.enriched_at
                    const { dot, label } = kdColor(kw.difficulty ?? 0)
                    const clusterName = kw.cluster_id ? clusterMap[kw.cluster_id] : null

                    return (
                      <TableRow key={kw.id} className="group h-9">
                        <TableCell className="w-8 py-1 pl-3">
                          <KeywordDeleteButton projectId={id} keywordId={kw.id} />
                        </TableCell>
                        <TableCell className={`py-1 text-sm${isEnriching ? ' opacity-50' : ''}`}>
                          {kw.keyword}
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
                        <TableCell className="py-1 w-24">
                          {kw.source === 'manual' ? (
                            <Badge className="bg-secondary text-muted-foreground text-xs border-0 px-1.5 py-0">Manual</Badge>
                          ) : kw.source === 'competitor' ? (
                            <Badge className="bg-blue-500/20 text-blue-400 text-xs border-0 px-1.5 py-0">Rakip</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs border-0 px-1.5 py-0">Genişletme</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1 w-32">
                          {clusterName ? (
                            <span className="text-xs text-muted-foreground truncate block max-w-28">
                              {clusterName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
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
                          {isEnriching ? (
                            <svg className="animate-spin h-3 w-3 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <IntentBadge intent={kw.search_intent} />
                          )}
                        </TableCell>
                        {/* Phase 24: DFS Tarihi hücresi — 3 state: never/stale/fresh */}
                        <TableCell className="py-1 w-28">
                          {kw.dfs_fetched_at === null ? (
                            <Badge className="bg-secondary text-muted-foreground/50 text-[10px] border-0 px-1.5 py-0">
                              Veri yok
                            </Badge>
                          ) : isDfsStale(kw.dfs_fetched_at, DFS_TTL_DAYS) ? (
                            <Badge className="bg-amber-500/20 text-amber-400 text-[10px] border-0 px-1.5 py-0">
                              Güncel değil
                            </Badge>
                          ) : (
                            <span
                              className="text-[11px] text-muted-foreground"
                              title={`Son güncelleme: ${kw.dfs_fetched_at} · ${Math.floor((Date.now() - new Date(kw.dfs_fetched_at).getTime()) / (1000 * 60 * 60 * 24))} gün önce`}
                            >
                              {formatDfsDate(kw.dfs_fetched_at)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

        </div>
      </ProjectPageShell>
    </div>
  )
}
