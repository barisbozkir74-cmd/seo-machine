import { Badge } from '@/components/ui/badge'
import { IntentBadge } from './IntentBadge'
import { ClusterDeleteButton } from './ClusterDeleteButton'
import { PrimaryKeywordStar } from './PrimaryKeywordStar'
import { MoveKeywordDialog } from './MoveKeywordDialog'
import { RevenueBadge } from './RevenueBadge'
import { RevenueOverrideSelect } from './RevenueOverrideSelect'

type ClusterKeyword = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  opportunity_score: number | null
}

type ClusterData = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  opportunity_score: number | null   // Phase 17
  revenue_type: string | null        // Phase 17
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
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Henüz küme oluşturulmadı.</p>
        <p className="text-sm text-muted-foreground">
          &ldquo;Kümelere Böl&rdquo; butonuna basarak keyword&apos;leri otomatik gruplandır.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {clusters.map((cluster) => (
        <div key={cluster.id} className="rounded-md border border-border bg-card overflow-hidden">
          {/* Cluster header */}
          <div className="group flex items-center justify-between bg-secondary/40 px-3 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">{cluster.cluster_name}</span>
              <IntentBadge intent={cluster.intent} />
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
          {cluster.keywords.map((kw) => {
            const isPrimary = kw.id === cluster.primary_keyword_id
            const { dot, label } = kdColor(kw.difficulty ?? 0)

            return (
              <div
                key={kw.id}
                className="group flex items-center px-3 py-2 border-t border-border/50 hover:bg-secondary/20 gap-2"
              >
                <PrimaryKeywordStar
                  clusterId={cluster.id}
                  keywordId={kw.id}
                  projectId={projectId}
                  isPrimary={isPrimary}
                />
                <span className={`flex-1 text-sm min-w-0 truncate ${isPrimary ? 'font-semibold' : 'font-normal'}`}>
                  {kw.keyword}
                </span>
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
