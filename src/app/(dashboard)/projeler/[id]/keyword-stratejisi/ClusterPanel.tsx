import { Badge } from '@/components/ui/badge'
import { IntentBadge } from './IntentBadge'
import { StatusBadge } from './StatusBadge'
import { ClusterDeleteButton } from './ClusterDeleteButton'
import { PrimaryKeywordStar } from './PrimaryKeywordStar'
import { MoveKeywordDialog } from './MoveKeywordDialog'
import { KeywordDeleteButton } from './KeywordDeleteButton'
import { RevenueBadge } from './RevenueBadge'
import { RevenueOverrideSelect } from './RevenueOverrideSelect'
import { LongTailButton } from './LongTailButton'

type ClusterKeyword = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  opportunity_score: number | null
  parent_keyword_id: string | null
  is_starred: boolean
  is_ai_suggested: boolean
  project_id?: string
}

type ClusterData = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  opportunity_score: number | null   // Phase 17
  revenue_type: string | null        // Phase 17
  status: string | null              // Phase 20 — 'draft' | 'approved' | 'rejected'
  keywords: ClusterKeyword[]
}

type ClusterOption = {
  id: string
  cluster_name: string
  intent: string | null
  keyword_count: number
}

function kdColor(kd: number): { dot: string; label: string } {
  if (kd < 30) return { dot: 'bg-emerald-400', label: 'Kolay' }
  if (kd <= 60) return { dot: 'bg-amber-400', label: 'Orta' }
  return { dot: 'bg-red-400', label: 'Zor' }
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-muted-foreground">—</span>
  if (score >= 70) return <Badge className="bg-violet-500/20 text-violet-400 text-xs border-0">{score.toFixed(1)}</Badge>
  if (score >= 40) return <Badge className="bg-amber-500/20 text-amber-400 text-xs border-0">{score.toFixed(1)}</Badge>
  return <Badge className="bg-secondary text-muted-foreground text-xs border-0">{score.toFixed(1)}</Badge>
}

export function ClusterPanel({
  clusters,
  allClusters,
  projectId,
}: {
  clusters: ClusterData[]
  allClusters: ClusterOption[]
  projectId: string
}) {
  if (clusters.length === 0) {
    return (
      <div className="py-12 text-center space-y-1">
        <p className="text-sm text-muted-foreground">Henüz küme oluşturulmadı.</p>
        <p className="text-xs text-muted-foreground">
          Sağ üstteki &ldquo;AI ile Kümelendirme&rdquo; butonuna bas — GPT keyword&apos;leri anlamsal gruplara ayırsın.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {clusters.map((cluster) => (
        <div
          key={cluster.id}
          className={`rounded-md border border-border bg-card overflow-hidden ${
            cluster.status === 'rejected' ? 'opacity-60' : ''
          }`}
        >
          {/* Cluster header */}
          <div className="group flex items-center justify-between bg-secondary/40 px-3 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">{cluster.cluster_name}</span>
              <StatusBadge status={cluster.status} />
              <IntentBadge intent={cluster.intent} />
              <span className="text-xs text-muted-foreground shrink-0">
                {cluster.keywords.length} kw
                {cluster.keywords.reduce((s, k) => s + (k.volume ?? 0), 0) > 0 && (
                  <> · {formatVolume(cluster.keywords.reduce((s, k) => s + (k.volume ?? 0), 0))} vol</>
                )}
              </span>
            </div>
            {/* Phase 17: Revenue + Niche Skoru sütunları */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Revenue sütunu — w-28 */}
              <div className="w-28 flex items-center gap-1">
                <RevenueBadge revenueType={cluster.revenue_type} />
                <RevenueOverrideSelect
                  clusterId={cluster.id}
                  projectId={projectId}
                  currentRevenue={cluster.revenue_type}
                />
              </div>
              {/* Niche Skoru sütunu — w-24, text-right */}
              <div className="w-24 flex justify-end">
                <ScoreBadge score={cluster.opportunity_score} />
              </div>
              <ClusterDeleteButton
                projectId={projectId}
                clusterId={cluster.id}
                clusterName={cluster.cluster_name}
              />
            </div>
          </div>

          {/* Keyword satırları */}
          {cluster.keywords
            .filter((kw) => !kw.parent_keyword_id)
            .map((kw) => {
              const isPrimary = kw.id === cluster.primary_keyword_id
              const { dot, label } = kdColor(kw.difficulty ?? 0)
              const longTails = cluster.keywords.filter((c) => c.parent_keyword_id === kw.id)

              return (
                <div key={kw.id}>
                  <div className="group flex items-center px-3 py-2 border-t border-border/50 hover:bg-secondary/20 gap-2">
                    <PrimaryKeywordStar
                      keywordId={kw.id}
                      projectId={projectId}
                      isStarred={kw.is_starred}
                      isAiSuggested={kw.is_ai_suggested}
                    />
                    <span className={`flex-1 text-sm min-w-0 truncate ${kw.is_starred ? 'font-semibold' : 'font-normal'}`}>
                      {kw.keyword}
                    </span>
                    {isPrimary && (
                      <LongTailButton
                        keywordId={kw.id}
                        projectId={projectId}
                        hasLongTail={longTails.length > 0}
                      />
                    )}
                    <span className="text-sm text-right w-16 shrink-0 font-normal">
                      {kw.volume !== null ? formatVolume(kw.volume) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className="text-sm text-right w-14 shrink-0 font-normal">
                      {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className="text-sm text-right w-16 shrink-0">
                      {kw.difficulty !== null ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <div className="w-16 flex justify-end shrink-0">
                      <ScoreBadge score={kw.opportunity_score} />
                    </div>
                    <MoveKeywordDialog
                      keywordId={kw.id}
                      keywordText={kw.keyword}
                      currentClusterId={cluster.id}
                      projectId={projectId}
                      allClusters={allClusters}
                    />
                    <KeywordDeleteButton projectId={projectId} keywordId={kw.id} />
                  </div>

                  {/* Uzun kuyruk satırları */}
                  {longTails.map((lt) => (
                    <div
                      key={lt.id}
                      className="group flex items-center pl-9 pr-3 py-1.5 border-t border-border/30 bg-secondary/10 hover:bg-secondary/20 gap-2"
                    >
                      <span className="text-xs text-muted-foreground/50 shrink-0">↳</span>
                      <span className="flex-1 text-xs text-muted-foreground min-w-0 truncate">{lt.keyword}</span>
                      <span className="text-xs text-right w-16 shrink-0 tabular-nums text-muted-foreground">
                        {lt.volume !== null ? formatVolume(lt.volume) : '—'}
                      </span>
                      <span className="text-xs text-right w-14 shrink-0 tabular-nums text-muted-foreground">
                        {lt.cpc !== null ? `$${lt.cpc.toFixed(2)}` : '—'}
                      </span>
                      <span className="w-16 shrink-0" />
                      <span className="w-16 shrink-0" />
                      <span className="w-6 shrink-0" />
                      <KeywordDeleteButton projectId={projectId} keywordId={lt.id} />
                    </div>
                  ))}
                </div>
              )
            })}

          {/* Footer */}
          <div className="flex items-center justify-end px-3 py-2 border-t border-border/50 bg-secondary/20">
            <span className="text-xs text-muted-foreground">{cluster.keywords.length} keyword</span>
          </div>
        </div>
      ))}
    </div>
  )
}
