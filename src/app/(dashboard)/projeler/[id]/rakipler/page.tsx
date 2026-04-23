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
import { CompetitorDiscoveryDialog } from './CompetitorDiscoveryDialog'
import { CompetitorFetchButton } from './CompetitorFetchButton'
import { OwnDomainAnalyzeButton } from './OwnDomainAnalyzeButton'
import { addCompetitor, fetchOwnDomainData } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryEntry = {
  pageCount: number
  sampleUrls: string[]
  totalEtv: number
}

type CategoryStructure = { [category: string]: CategoryEntry } | null

type Competitor = {
  id: string
  domain: string
  source: string
  top_pages: Array<{ url: string; etv: number }> | null
  category_structure: CategoryStructure
  updated_at: string
}

type GapMatrix = {
  categories: string[]
  matrix: {
    [domain: string]: {
      [category: string]: { exists: boolean; pageCount: number }
    }
  }
}

// ─── Gap raporu hesaplama (SSR — RESEARCH.md Pattern 5, D-10 genişletilmiş) ──

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
  // Kullanıcı domain kategorilerini de union'a ekle (D-10)
  if (userCategoryStructure) {
    Object.keys(userCategoryStructure).forEach((cat) => allCategories.add(cat))
  }

  // "Diğer" kategorisini gap tablosundan filtrele — anlamsız karşılaştırma yaratır
  const categories = Array.from(allCategories).filter((c) => c !== 'Diğer')

  const matrix: GapMatrix['matrix'] = {}

  // Kullanıcı domain'i ilk sütun olarak eklenir (D-10: "Sizin Siteniz" soldan ilk)
  matrix[userDomain] = {}
  for (const cat of categories) {
    const count = userCategoryStructure?.[cat] ?? 0
    matrix[userDomain][cat] = {
      exists: count > 0,
      pageCount: count,
    }
  }

  // Rakipler
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

  return { categories, matrix }
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

  // Proje ownership check
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Rakip listesi
  const { data: competitorsRaw } = await supabase
    .from('competitors')
    .select('id, domain, source, top_pages, category_structure, updated_at')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const competitors = (competitorsRaw ?? []) as Competitor[]

  // Kullanıcı kendi domain'i için kategori verisi — D-10, Q3 RESOLVED
  // DB'ye yazılmaz; SSR render için anlık çekilir
  const ownCategoryData = await fetchOwnDomainData(id, project.domain).catch(() => null)

  // Gap raporu — en az bir rakibin category_structure'ı dolu olmalı (RESEARCH.md Pitfall 5)
  const competitorsWithData = competitors.filter((c) => c.category_structure !== null)
  const gapReport =
    competitorsWithData.length > 0
      ? buildGapReport(competitorsWithData, project.domain, ownCategoryData)
      : null

  // Manuel rakip ekleme — addCompetitor.bind ile Server Action partial application
  const addCompetitorAction = addCompetitor.bind(null, id)

  return (
    <div className="flex flex-col h-screen">
      {/* Breadcrumb + başlık */}
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Rakipler</h1>
      </div>

      {/* 2 sütunlu içerik */}
      <div className="flex flex-1 min-h-0">
        {/* Sol sütun */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <Separator className="my-4" />
          {/* Rakipler — aktif (bg-secondary font-semibold) */}
          <Link
            href={`/projeler/${id}/rakipler`}
            className="text-sm text-foreground font-semibold flex items-center gap-1 px-3 py-2 rounded-md bg-secondary"
          >
            Rakipler
          </Link>
          {/* Kurallar — pasif */}
          <Link
            href={`/projeler/${id}/kurallar`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-2 rounded-md hover:bg-secondary"
          >
            Proje Kuralları
          </Link>
        </div>

        {/* Sağ sütun */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-8">

          {/* Aksiyon butonları */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Rakip Listesi</h2>
            <div className="flex items-center gap-2">
              <CompetitorDiscoveryDialog projectId={id} />
            </div>
          </div>

          {/* Manuel rakip ekleme formu */}
          <form
            action={async (formData: FormData) => {
              'use server'
              const domain = formData.get('domain') as string
              if (domain?.trim()) {
                await addCompetitorAction(domain.trim())
              }
            }}
            className="flex gap-2"
          >
            <Input
              name="domain"
              placeholder="domain.com"
              className="max-w-xs"
              required
            />
            <Button type="submit" variant="outline">
              Rakip Ekle
            </Button>
          </form>

          {/* Rakip listesi tablosu */}
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
                  <TableHead>Sayfa Sayısı</TableHead>
                  <TableHead className="text-right">Veri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-medium">{comp.domain}</TableCell>
                    <TableCell>
                      {comp.source === 'serp' ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs">
                          SERP
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-xs">
                          Manuel
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.top_pages ? comp.top_pages.length : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CompetitorFetchButton
                        competitorId={comp.id}
                        projectId={id}
                        lastFetched={comp.top_pages ? comp.updated_at : null}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Separator />

          {/* Gap Analizi — D-09, D-10 */}
          <div>
            <h2 className="text-base font-semibold mb-4">Gap Analizi</h2>

            {!ownCategoryData && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md border border-border bg-secondary/30">
                <p className="text-sm text-muted-foreground flex-1">
                  Kendi siteniz için veri çekilmedi. Gap tablosunda &quot;Sizin Siteniz&quot; sütunu boş görünecek.
                </p>
                <OwnDomainAnalyzeButton projectId={id} domain={project.domain} />
              </div>
            )}
            {competitorsWithData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Gap analizi için en az bir rakibin veri çekilmiş olması gerekiyor. Her rakip için &quot;Veri Çek&quot; butonuna basın.
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
                      {/* Kullanıcı domain'i — ilk sütun (D-10) */}
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
                        {/* Kullanıcı domain'i hücresi — ilk veri sütunu (D-10) */}
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
