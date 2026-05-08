import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SeoFetchButton } from './SeoFetchButton'
import { CompetitorAnalysisButton } from './CompetitorAnalysisButton'
import { type CompetitorAnalysis } from './actions'
import { ProjectNav } from '../../ProjectNav'

type RankedKeyword = {
  keyword: string
  position: number | null
  search_volume: number
  etv: number
  cpc: number
}

type BacklinksSummary = {
  total_backlinks: number
  referring_domains: number
  referring_ips: number
  rank: number
}

type CategoryEntry = {
  pageCount: number
  sampleUrls: string[]
  totalEtv: number
}

type TopPagesNormalized = { total_count: number; pages: Array<{ url: string; etv: number }> }

function normalizeTopPages(raw: unknown): TopPagesNormalized | null {
  if (!raw) return null
  if (Array.isArray(raw)) return { total_count: raw.length, pages: raw }
  const obj = raw as TopPagesNormalized
  if (obj.pages) return obj
  return null
}

type Competitor = {
  id: string
  domain: string
  source: string
  top_pages: unknown
  category_structure: Record<string, CategoryEntry> | null
  content_areas: Record<string, CategoryEntry> | null
  ranked_keywords: RankedKeyword[] | null
  backlinks_summary: BacklinksSummary | null
  analysis: CompetitorAnalysis | null
  updated_at: string
}

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string; competitorId: string }>
}) {
  const { id, competitorId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, own_category_structure')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const { data: comp } = await supabase
    .from('competitors')
    .select('id, domain, source, top_pages, category_structure, content_areas, ranked_keywords, backlinks_summary, analysis, updated_at')
    .eq('id', competitorId)
    .eq('project_id', id)
    .eq('user_id', user.id)
    .single()
  if (!comp) notFound()

  const competitor = comp as Competitor
  const topPages = normalizeTopPages(competitor.top_pages)

  const totalEtv = topPages
    ? topPages.pages.reduce((s, p) => s + (p.etv ?? 0), 0)
    : null

  const competitionLevel =
    totalEtv === null
      ? null
      : totalEtv >= 10000
        ? { label: 'Yüksek', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
        : totalEtv >= 2000
          ? { label: 'Orta', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
          : { label: 'Düşük', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }

  const ownCategoryData = (project.own_category_structure as Record<string, number> | null) ?? null

  const categoryGaps: string[] = []
  if (competitor.category_structure && ownCategoryData) {
    for (const cat of Object.keys(competitor.category_structure)) {
      if (cat !== 'Diğer' && !ownCategoryData[cat]) {
        categoryGaps.push(cat)
      }
    }
  }

  const hasSeenData = !!topPages
  const hasSeoData = !!(competitor.ranked_keywords || competitor.backlinks_summary)

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}/rakipler`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← Rakipler
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{competitor.domain}</h1>
            <p className="text-sm text-muted-foreground mt-1">{project.name} projesi rakibi</p>
          </div>
          <SeoFetchButton competitorId={competitorId} projectId={id} hasData={hasSeoData} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol sütun */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/rakipler`} />
        </div>

        {/* Sağ sütun */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-8">

          {!hasSeenData && (
            <div className="p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground">
              Bu rakip için henüz veri çekilmemiş. Rakipler listesinden &quot;Veri Çek&quot; butonunu kullanın.
            </div>
          )}

          {/* Özet kartlar */}
          {hasSeenData && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Tahmini Trafik</p>
                <p className="text-xl font-semibold">{totalEtv?.toLocaleString('tr-TR') ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Top Sayfa</p>
                <p className="text-xl font-semibold">{topPages?.total_count ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Kategori</p>
                <p className="text-xl font-semibold">
                  {competitor.category_structure
                    ? Object.keys(competitor.category_structure).filter((c) => c !== 'Diğer').length
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Rekabet</p>
                {competitionLevel ? (
                  <Badge className={`${competitionLevel.cls} border text-sm font-semibold mt-0.5`}>
                    {competitionLevel.label}
                  </Badge>
                ) : (
                  <p className="text-xl font-semibold">—</p>
                )}
              </div>
            </div>
          )}

          {/* Backlinks */}
          {competitor.backlinks_summary && (
            <>
              <Separator />
              <div>
                <h2 className="text-base font-semibold mb-4">Backlink Özeti</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Toplam Backlink</p>
                    <p className="text-xl font-semibold">
                      {competitor.backlinks_summary.total_backlinks.toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Referring Domain</p>
                    <p className="text-xl font-semibold">
                      {competitor.backlinks_summary.referring_domains.toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Referring IP</p>
                    <p className="text-xl font-semibold">
                      {competitor.backlinks_summary.referring_ips.toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Domain Rank</p>
                    <p className="text-xl font-semibold">{competitor.backlinks_summary.rank}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* AI Analizi */}
          {hasSeenData && (
            <>
              <Separator />
              <CompetitorAnalysisButton
                competitorId={competitorId}
                projectId={id}
                initialAnalysis={competitor.analysis}
              />
            </>
          )}

          {/* Kategori dağılımı */}
          {competitor.category_structure && Object.keys(competitor.category_structure).length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-base font-semibold mb-4">Kategori Dağılımı</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Sayfa</TableHead>
                      <TableHead className="text-right">Tahmini Trafik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(competitor.category_structure)
                      .sort((a, b) => b[1].totalEtv - a[1].totalEtv)
                      .map(([cat, data]) => (
                        <TableRow key={cat}>
                          <TableCell className="font-medium">{cat}</TableCell>
                          <TableCell className="text-right">{data.pageCount}</TableCell>
                          <TableCell className="text-right">
                            {data.totalEtv.toLocaleString('tr-TR')}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Top sayfalar */}
          {topPages && topPages.pages.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-base font-semibold mb-4">En İyi Sayfalar</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead className="text-right">Tahmini Trafik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPages.pages.map((page, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs max-w-md truncate">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-muted-foreground hover:text-foreground"
                          >
                            {page.url}
                          </a>
                        </TableCell>
                        <TableCell className="text-right">
                          {(page.etv ?? 0).toLocaleString('tr-TR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Ranked keywords */}
          {competitor.ranked_keywords && competitor.ranked_keywords.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-base font-semibold mb-4">Rank Aldığı Keywordler</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Pozisyon</TableHead>
                      <TableHead className="text-right">Arama Hacmi</TableHead>
                      <TableHead className="text-right">Tahmini Trafik</TableHead>
                      <TableHead className="text-right">CPC (₺)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitor.ranked_keywords.map((kw, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{kw.keyword}</TableCell>
                        <TableCell className="text-right">
                          {kw.position !== null ? (
                            <span
                              className={
                                kw.position <= 3
                                  ? 'text-emerald-400 font-semibold'
                                  : kw.position <= 10
                                    ? 'text-blue-400'
                                    : 'text-muted-foreground'
                              }
                            >
                              {kw.position}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {kw.search_volume.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {kw.etv.toLocaleString('tr-TR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {kw.cpc > 0 ? kw.cpc.toFixed(2) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Gap analizi — bizde olmayan kategoriler */}
          {categoryGaps.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-base font-semibold mb-2">Fırsat Alanları</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Bu rakipte var, sizin sitenizde yok.
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryGaps.map((cat) => (
                    <span
                      key={cat}
                      className="text-sm px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {!hasSeoData && hasSeenData && (
            <div className="p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground">
              Keyword ve backlink verileri için sağ üstteki &quot;SEO Verisi Çek&quot; butonunu kullanın.
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
