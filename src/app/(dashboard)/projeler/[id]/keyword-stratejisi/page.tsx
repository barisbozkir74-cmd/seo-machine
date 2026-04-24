import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { KeywordImport } from './KeywordImport'
import { IntentBadge } from './IntentBadge'
import { KeywordDeleteButton } from './KeywordDeleteButton'
import { ProjectNav } from '../ProjectNav'

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

type KeywordRow = {
  id: string
  keyword: string
  volume: number | null
  cpc: number | null
  difficulty: number | null
  search_intent: string | null
  enriched_at: string | null
  cluster_id: string | null
}

export default async function KeywordStratejisiPage({
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
    .select('id, name, domain')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  // Keyword düz sorgusu — volume azalan (D-13)
  const { data: keywordsRaw } = await supabase
    .from('keywords')
    .select('id, keyword, volume, cpc, difficulty, search_intent, enriched_at, cluster_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('volume', { ascending: false, nullsFirst: false })

  const keywords: KeywordRow[] = (keywordsRaw ?? []) as KeywordRow[]

  // Cluster adları badge gösterimi için
  const { data: clustersRaw } = await supabase
    .from('keyword_clusters')
    .select('id, cluster_name')
    .eq('project_id', id)
    .eq('user_id', user.id)

  const clusterMap: Record<string, string> = {}
  for (const c of clustersRaw ?? []) {
    clusterMap[c.id] = c.cluster_name
  }

  // Özet sayıları
  const totalKeywords = keywords.length
  const totalClusters = Object.keys(clusterMap).length
  const pendingEnrichment = keywords.filter((kw) => !kw.enriched_at).length

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Keyword Stratejisi</h1>
        <p className="text-sm text-muted-foreground mt-1">{project.domain}</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/keyword-stratejisi`} />
        </div>

        {/* Ana içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-10">

          {/* Import bölümü */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Keyword İçe Aktar</h2>
            <p className="text-sm text-muted-foreground">
              Keyword listeni yapıştır — DataForSEO, Semrush, Ahrefs veya düz metin. Format: <code className="text-xs bg-secondary px-1 py-0.5 rounded">keyword tab volume tab KD</code>
            </p>
            <KeywordImport projectId={id} />
          </section>

          <Separator />

          {/* Keyword listesi */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">
                  Keyword Listesi
                  {totalKeywords > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {totalKeywords} keyword · {totalClusters} küme
                    </span>
                  )}
                </h2>
                {pendingEnrichment > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {pendingEnrichment} keyword zenginleştirme bekliyor
                  </p>
                )}
              </div>
            </div>

            {keywords.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Henüz keyword eklenmemiş.</p>
                <p className="text-sm text-muted-foreground">Yukarıdan keyword listeni içe aktar.</p>
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40">
                      <TableHead className="text-xs w-10">{/* × */}</TableHead>
                      <TableHead className="text-xs">Keyword</TableHead>
                      <TableHead className="text-xs text-right w-20">Volume</TableHead>
                      <TableHead className="text-xs text-right w-18">CPC</TableHead>
                      <TableHead className="text-xs text-right w-16">KD</TableHead>
                      <TableHead className="text-xs w-28">Küme</TableHead>
                      <TableHead className="text-xs w-28">Intent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((kw) => {
                      const isEnriching = !kw.enriched_at
                      const { dot, label } = kdColor(kw.difficulty ?? 0)
                      const clusterName = kw.cluster_id ? clusterMap[kw.cluster_id] : null

                      return (
                        <TableRow key={kw.id} className="group">
                          <TableCell className="w-10 py-2">
                            <KeywordDeleteButton projectId={id} keywordId={kw.id} />
                          </TableCell>
                          <TableCell className={`text-sm${isEnriching ? ' opacity-50' : ''}`}>
                            {kw.keyword}
                          </TableCell>
                          <TableCell className={`text-sm text-right font-normal${isEnriching ? ' opacity-50' : ''}`}>
                            {kw.volume !== null ? formatVolume(kw.volume) : '—'}
                          </TableCell>
                          <TableCell className={`text-sm text-right font-normal${isEnriching ? ' opacity-50' : ''}`}>
                            {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className={`text-sm text-right${isEnriching ? ' opacity-50' : ''}`}>
                            {kw.difficulty !== null ? (
                              <span className="flex items-center justify-end gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                <span className="text-xs text-muted-foreground">{label}</span>
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="w-28">
                            {clusterName ? (
                              <Badge className="bg-secondary text-muted-foreground text-xs border-0">
                                {clusterName}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="w-28">
                            {isEnriching ? (
                              <svg
                                className="animate-spin h-4 w-4 text-muted-foreground"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                            ) : (
                              <IntentBadge intent={kw.search_intent} />
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
