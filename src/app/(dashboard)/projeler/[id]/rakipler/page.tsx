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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProjectNav } from '../ProjectNav'
import { CompetitorDiscoveryDialog } from './CompetitorDiscoveryDialog'
import { CompetitorFetchButton } from './CompetitorFetchButton'
import { OwnDomainAnalyzeButton } from './OwnDomainAnalyzeButton'
import { CompetitorDeleteButton } from './CompetitorDeleteButton'
import { FetchAllButton } from './FetchAllButton'
import { addCompetitor } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryEntry = {
  pageCount: number
  sampleUrls: string[]
  totalEtv: number
}

type CategoryStructure = { [category: string]: CategoryEntry } | null

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
  category_structure: CategoryStructure
  content_areas: Record<string, unknown> | null
  updated_at: string
}

type GapMatrix = {
  categories: string[]
  opportunityCategories: Set<string>
  matrix: {
    [domain: string]: {
      [category: string]: { exists: boolean; pageCount: number }
    }
  }
}

// ─── Gap raporu (SSR) ────────────────────────────────────────────────────────

function buildGapReport(
  competitors: Competitor[],
  userDomain: string,
  userCategoryStructure: Record<string, number> | null
): GapMatrix {
  const allCategories = new Set<string>()

  for (const comp of competitors) {
    if (comp.category_structure) {
      Object.keys(comp.category_structure).forEach((cat) => allCategories.add(cat))
    }
  }
  if (userCategoryStructure) {
    Object.keys(userCategoryStructure).forEach((cat) => allCategories.add(cat))
  }

  const categories = Array.from(allCategories).filter((c) => c !== 'Diğer')

  const matrix: GapMatrix['matrix'] = {}

  matrix[userDomain] = {}
  for (const cat of categories) {
    const count = userCategoryStructure?.[cat] ?? 0
    matrix[userDomain][cat] = { exists: count > 0, pageCount: count }
  }

  for (const comp of competitors) {
    matrix[comp.domain] = {}
    for (const cat of categories) {
      const catData = comp.category_structure?.[cat]
      matrix[comp.domain][cat] = {
        exists: !!catData,
        pageCount: catData?.pageCount ?? 0,
      }
    }
  }

  // Fırsat Skoru: kullanıcı yok ama 2+ rakip var → fırsat
  const opportunityCategories = new Set<string>()
  for (const cat of categories) {
    const userHas = matrix[userDomain]?.[cat]?.exists ?? false
    if (!userHas) {
      const competitorCount = competitors.filter(
        (comp) => matrix[comp.domain]?.[cat]?.exists ?? false
      ).length
      if (competitorCount >= 2) opportunityCategories.add(cat)
    }
  }

  return { categories, opportunityCategories, matrix }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RakiplerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // CR-01 FIX: own_category_structure DB'den okunuyor — SSR'da DataForSEO çağrısı yok
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, own_category_structure')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  const ownCategoryData = (project.own_category_structure as Record<string, number> | null) ?? null

  // COMP-03: content_areas da çekiliyor
  const { data: competitorsRaw } = await supabase
    .from('competitors')
    .select('id, domain, source, top_pages, category_structure, content_areas, updated_at')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const competitors = (competitorsRaw ?? []) as Competitor[]

  const competitorsWithData = competitors.filter((c) => c.category_structure !== null)
  const gapReport =
    competitorsWithData.length > 0
      ? buildGapReport(competitorsWithData, project.domain, ownCategoryData)
      : null

  const addCompetitorAction = addCompetitor.bind(null, id)

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Rakipler</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/rakipler`} />
        </div>

        {/* Sağ sütun */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-8">

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Rakip Listesi</h2>
            <div className="flex items-center gap-2">
              {competitors.length > 0 && (
                <FetchAllButton
                  projectId={id}
                  competitors={competitors.map((c) => ({ id: c.id, domain: c.domain }))}
                />
              )}
              <CompetitorDiscoveryDialog projectId={id} />
            </div>
          </div>

          {/* Manuel ekleme formu */}
          <form
            action={async (formData: FormData) => {
              'use server'
              const domain = formData.get('domain') as string
              if (domain?.trim()) await addCompetitorAction(domain.trim())
            }}
            className="flex gap-2"
          >
            <Input name="domain" placeholder="domain.com" className="max-w-xs" required />
            <Button type="submit" variant="outline">Rakip Ekle</Button>
          </form>

          {/* Rakip tablosu */}
          {competitors.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Henüz rakip eklenmemiş. Yukarıdan domain ekleyin veya SERP ile keşfedin.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead className="text-right">Tahmini Trafik</TableHead>
                  <TableHead className="text-right">Sayfa</TableHead>
                  <TableHead>İçerik Alanları</TableHead>
                  <TableHead>Rekabet</TableHead>
                  <TableHead className="text-right">Veri</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((comp) => {
                  const topPages = normalizeTopPages(comp.top_pages)
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

                  return (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">
                        {topPages?.pages.length ? (
                          <Link
                            href={`/projeler/${id}/rakipler/${comp.id}`}
                            className="hover:underline text-foreground"
                          >
                            {comp.domain}
                          </Link>
                        ) : (
                          comp.domain
                        )}
                      </TableCell>
                      <TableCell>
                        {comp.source === 'serp' ? (
                          <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">SERP</Badge>
                        ) : (
                          <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-xs">Manuel</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalEtv !== null ? (
                          <span className="text-sm font-medium">{totalEtv.toLocaleString('tr-TR')}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {topPages ? (
                          <span className="text-sm">{topPages.total_count}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {comp.content_areas && Object.keys(comp.content_areas).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(comp.content_areas).slice(0, 3).map((area) => (
                              <span
                                key={area}
                                className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border"
                              >
                                {area}
                              </span>
                            ))}
                            {Object.keys(comp.content_areas).length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{Object.keys(comp.content_areas).length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {competitionLevel ? (
                          <Badge className={`${competitionLevel.cls} border text-xs`}>
                            {competitionLevel.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <CompetitorFetchButton
                          competitorId={comp.id}
                          projectId={id}
                          lastFetched={topPages?.pages.length ? comp.updated_at : null}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <CompetitorDeleteButton competitorId={comp.id} projectId={id} domain={comp.domain} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          <Separator />

          {/* Gap Analizi */}
          <div>
            <h2 className="text-base font-semibold mb-4">Gap Analizi</h2>

            {!ownCategoryData && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md border border-border bg-secondary/30">
                <p className="text-sm text-muted-foreground flex-1">
                  Kendi siteniz için veri çekilmedi. &quot;Kendi Sitemi Analiz Et&quot; butonuna basın.
                </p>
                <OwnDomainAnalyzeButton projectId={id} domain={project.domain} />
              </div>
            )}

            {competitorsWithData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Gap analizi için en az bir rakibin veri çekilmiş olması gerekiyor.
              </p>
            ) : gapReport && gapReport.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Kategori yapısı belirlenemedi. Rakiplerin URL yapısı tanınan pattern&apos;lere uymuyor olabilir.
              </p>
            ) : gapReport ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-36">Kategori</TableHead>
                      <TableHead className="text-center min-w-24">Fırsat</TableHead>
                      <TableHead className="text-center min-w-36 font-semibold">
                        Sizin Siteniz
                        <span className="block text-xs font-normal text-muted-foreground truncate max-w-32">
                          {project.domain}
                        </span>
                      </TableHead>
                      {competitorsWithData.map((comp) => (
                        <TableHead key={comp.id} className="text-center min-w-28">
                          {comp.domain}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapReport.categories.map((cat) => (
                      <TableRow key={cat}>
                        <TableCell className="font-medium">{cat}</TableCell>
                        {/* Fırsat Skoru */}
                        <TableCell className="text-center">
                          {gapReport.opportunityCategories.has(cat) ? (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              title="2+ rakip bu kategoride içerik var, sizin sitenizde yok"
                            >
                              Fırsat
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        {/* Kullanıcı sütunu */}
                        {(() => {
                          const cell = gapReport.matrix[project.domain]?.[cat]
                          return (
                            <TableCell className="text-center">
                              {cell?.exists ? (
                                <span className="text-emerald-400 font-medium">
                                  {cell.pageCount > 0 ? cell.pageCount : '✓'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">✗</span>
                              )}
                            </TableCell>
                          )
                        })()}
                        {competitorsWithData.map((comp) => {
                          const cell = gapReport.matrix[comp.domain]?.[cat]
                          return (
                            <TableCell key={comp.id} className="text-center">
                              {cell?.exists ? (
                                <span className="text-emerald-400 font-medium">
                                  {cell.pageCount > 0 ? cell.pageCount : '✓'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">✗</span>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}
