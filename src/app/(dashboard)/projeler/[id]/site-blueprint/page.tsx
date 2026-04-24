import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectNav } from '../ProjectNav'
import { AddPageModal } from './AddPageModal'
import { MenuEditor } from './MenuEditor'
import { deletePage } from './actions'
import { intentToPageType } from './page-utils'
import type { MenuType, MenuItem } from './actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GenerateFromClustersButton } from './GenerateFromClustersButton'
import { ReorderButton } from './ReorderButton'
import { KeywordMappingTab, type MappedPage, type UnmappedKeyword } from './KeywordMappingTab'
import type { DialogRow } from './GeneratePagesDialog'

// ─── Tipler ───────────────────────────────────────────────────────────────────

type Page = {
  id: string
  title: string
  slug: string
  page_type: string
  priority: string
  parent_id: string | null
  sort_order: number
  cluster_id: string | null
  focus_keyword_id: string | null
}

type Menu = {
  id: string
  menu_type: MenuType
  items: MenuItem[]
}

type PageWithDepth = Page & { depth: number }

type ClusterRow = {
  id: string
  cluster_name: string
  intent: string | null
  primary_keyword_id: string | null
  keywords: Array<{ id: string; keyword: string }>
}

// ─── Yardımcı: Ağaç düzleştirici ─────────────────────────────────────────────

function flattenTree(pages: Page[]): PageWithDepth[] {
  const childrenMap: Record<string, Page[]> = {}

  for (const page of pages) {
    const key = page.parent_id ?? '__root__'
    if (!childrenMap[key]) childrenMap[key] = []
    childrenMap[key].push(page)
  }

  function sortPages(list: Page[]): Page[] {
    return [...list].sort((a, b) => a.sort_order - b.sort_order)
  }

  function walk(parentKey: string, depth: number): PageWithDepth[] {
    const children = sortPages(childrenMap[parentKey] ?? [])
    const result: PageWithDepth[] = []
    for (const child of children) {
      result.push({ ...child, depth })
      result.push(...walk(child.id, depth + 1))
    }
    return result
  }

  return walk('__root__', 0)
}

// ─── Menü başlıkları ──────────────────────────────────────────────────────────

const MENU_CONFIGS: { type: MenuType; title: string }[] = [
  { type: 'top', title: 'Üst Menü' },
  { type: 'main', title: 'Ana Menü' },
  { type: 'footer', title: 'Footer' },
]

// ─── Öncelik badge rengi ──────────────────────────────────────────────────────

function priorityClass(priority: string): string {
  if (priority === 'yüksek') return 'text-red-500'
  if (priority === 'orta') return 'text-yellow-500'
  if (priority === 'düşük') return 'text-muted-foreground'
  return 'text-muted-foreground'
}

// ─── Intent suffix'i şerit at (D-01) ────────────────────────────────────────

function stripIntentSuffix(name: string): string {
  const stripped = name
    .replace(/\s*\((commercial|informational|navigational|transactional|unknown)\)\s*$/i, '')
    .trim()
  // Title-case
  return stripped
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SiteBlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const isMappingTab = tab === 'mapping'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Sayfaları çek — cluster_id + focus_keyword_id eklendi
  const { data: pagesData } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, priority, parent_id, sort_order, cluster_id, focus_keyword_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  const pages: Page[] = (pagesData ?? []) as Page[]
  const flatPages = flattenTree(pages)

  // Menüleri çek
  const { data: menusData } = await supabase
    .from('menus')
    .select('id, menu_type, items')
    .eq('project_id', id)
    .eq('user_id', user.id)

  const menus: Menu[] = (menusData ?? []) as Menu[]
  const menuMap: Partial<Record<MenuType, MenuItem[]>> = {}
  for (const menu of menus) {
    menuMap[menu.menu_type] = (menu.items as MenuItem[]) ?? []
  }

  // ─── Kümeler + primary keyword + cluster keywords ─────────────────────────
  const { data: clustersRaw } = await supabase
    .from('keyword_clusters')
    .select(`
      id,
      cluster_name,
      intent,
      primary_keyword_id,
      keywords!inner ( id, keyword )
    `)
    .eq('project_id', id)
    .eq('user_id', user.id)

  const clusters: ClusterRow[] = (clustersRaw ?? []) as ClusterRow[]

  // hasEnrichedClusters: primary_keyword_id'si atanmış cluster var mı
  const hasEnrichedClusters = clusters.some((c) => c.primary_keyword_id !== null)

  // primary keyword id → keyword text
  const primaryKeywordTextById = new Map<string, string>()
  for (const c of clusters) {
    if (c.primary_keyword_id) {
      const pk = c.keywords.find((k) => k.id === c.primary_keyword_id)
      if (pk) primaryKeywordTextById.set(c.primary_keyword_id, pk.keyword)
    }
  }

  // cluster_id'si mevcut sayfalara bağlı olanları tespit et (alreadyExists için)
  const clusterIdsWithPages = new Set(
    pages
      .filter((p) => p.cluster_id !== null)
      .map((p) => p.cluster_id as string)
  )

  // Dialog satırları: her cluster → DialogRow
  const dialogRows: DialogRow[] = clusters
    .filter((c) => c.primary_keyword_id !== null)
    .map((c) => ({
      clusterId: c.id,
      clusterName: c.cluster_name,
      proposedName: stripIntentSuffix(c.cluster_name),
      proposedType: intentToPageType(c.intent),
      focusKeyword: c.primary_keyword_id
        ? primaryKeywordTextById.get(c.primary_keyword_id) ?? null
        : null,
      focusKeywordId: c.primary_keyword_id,
      alreadyExists: clusterIdsWithPages.has(c.id),
    }))

  // ─── Conflict detection SSR (BLUE-02) ────────────────────────────────────
  const conflictPageIds = new Set<string>()

  // Hangi cluster hangi page'e bağlı?
  const clusterIdToPageId = new Map<string, string>()
  for (const p of pages) {
    if (p.cluster_id) clusterIdToPageId.set(p.cluster_id, p.id)
  }

  // Her cluster'ın keyword text'lerini topla — keyword text → [clusterId...]
  const keywordTextToClusters = new Map<string, Set<string>>()
  for (const c of clusters) {
    if (!clusterIdToPageId.has(c.id)) continue // sadece sayfası olan cluster'lar
    for (const kw of c.keywords) {
      const key = kw.keyword.toLowerCase().trim()
      if (!keywordTextToClusters.has(key)) keywordTextToClusters.set(key, new Set())
      keywordTextToClusters.get(key)!.add(c.id)
    }
  }

  for (const [, clusterSet] of keywordTextToClusters) {
    if (clusterSet.size > 1) {
      for (const cid of clusterSet) {
        const pid = clusterIdToPageId.get(cid)
        if (pid) conflictPageIds.add(pid)
      }
    }
  }

  // ─── Keyword mapping tab data ─────────────────────────────────────────────
  const clusterById = new Map<string, ClusterRow>(clusters.map((c) => [c.id, c]))

  const focusKeywordIds = pages
    .map((p) => p.focus_keyword_id)
    .filter((v): v is string => v !== null)

  const { data: focusKeywordRows } =
    focusKeywordIds.length > 0
      ? await supabase
          .from('keywords')
          .select('id, keyword')
          .in('id', focusKeywordIds)
          .eq('user_id', user.id)
      : { data: [] as Array<{ id: string; keyword: string }> }

  const focusKeywordTextById = new Map<string, string>()
  for (const row of focusKeywordRows ?? []) {
    focusKeywordTextById.set(row.id, row.keyword)
  }

  const mappedPages: MappedPage[] = pages
    .filter((p) => p.cluster_id !== null)
    .map((p) => {
      const cluster = p.cluster_id ? clusterById.get(p.cluster_id) : null
      return {
        id: p.id,
        title: p.title,
        focusKeyword: p.focus_keyword_id
          ? focusKeywordTextById.get(p.focus_keyword_id) ?? null
          : null,
        clusterKeywords: cluster ? cluster.keywords.map((k) => k.keyword) : [],
        intent: cluster?.intent ?? null,
        hasConflict: conflictPageIds.has(p.id),
      }
    })

  // Unmapped keywords: cluster_id IS NULL
  const { data: unmappedRaw } = await supabase
    .from('keywords')
    .select('id, keyword')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .is('cluster_id', null)

  const unmappedKeywords: UnmappedKeyword[] = (unmappedRaw ?? []).map((k) => ({
    id: k.id,
    keyword: k.keyword,
  }))

  return (
    <div className="flex flex-col h-screen">
      {/* Başlık */}
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Site Blueprint</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/site-blueprint`} />
        </div>

        {/* Sağ içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-12">

          {/* Tab bar + header actions — birleşik satır */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
              <Link
                href={`/projeler/${id}/site-blueprint?tab=tree`}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  !isMappingTab
                    ? 'bg-secondary text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground font-normal'
                }`}
              >
                Ağaç Görünümü
              </Link>
              <Link
                href={`/projeler/${id}/site-blueprint?tab=mapping`}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  isMappingTab
                    ? 'bg-secondary text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground font-normal'
                }`}
              >
                Keyword Eşleme
              </Link>
            </div>

            {!isMappingTab && (
              <div className="flex items-center gap-2">
                <GenerateFromClustersButton
                  projectId={id}
                  rows={dialogRows}
                  hasEnrichedClusters={hasEnrichedClusters}
                />
                <AddPageModal
                  projectId={id}
                  existingPages={pages.map((p) => ({ id: p.id, title: p.title }))}
                />
              </div>
            )}
          </div>

          {isMappingTab ? (
            <KeywordMappingTab mappedPages={mappedPages} unmappedKeywords={unmappedKeywords} />
          ) : (
            <>
              {/* ─── Bölüm 1: Site Ağacı ─────────────────────────────────── */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Site Ağacı</h2>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  {/* Tablo başlığı — 6 kolon (reorder kolonu eklendi) */}
                  <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-0 bg-muted/50 border-b border-border text-xs text-muted-foreground font-normal">
                    <div className="px-4 py-2">Sayfa Adı</div>
                    <div className="px-4 py-2">Slug</div>
                    <div className="px-4 py-2 w-32">Tip</div>
                    <div className="px-4 py-2 w-20">Öncelik</div>
                    <div className="px-4 py-2 w-16 text-center">Sıra</div>
                    <div className="px-4 py-2 w-16"></div>
                  </div>

                  {flatPages.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Henüz sayfa yok. &ldquo;Sayfa Ekle&rdquo; ile başlayın.
                    </div>
                  ) : (
                    flatPages.map((page) => {
                      // Aynı parent içindeki index'i bul — ilk/son tespiti için
                      const siblingList = flatPages.filter(
                        (p) => p.parent_id === page.parent_id
                      )
                      const siblingIndex = siblingList.findIndex((p) => p.id === page.id)
                      const isFirstSibling = siblingIndex === 0
                      const isLastSibling = siblingIndex === siblingList.length - 1
                      const hasConflict = conflictPageIds.has(page.id)

                      return (
                        <div
                          key={page.id}
                          className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-0 border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors group"
                        >
                          {/* Sayfa adı — girintili + conflict badge */}
                          <div
                            className="px-4 py-2 font-normal truncate flex items-center"
                            style={{ paddingLeft: `${16 + page.depth * 20}px` }}
                          >
                            {page.depth > 0 && (
                              <span className="text-muted-foreground mr-1.5">↳</span>
                            )}
                            <span className="truncate">{page.title}</span>
                            {hasConflict && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">
                                ⚠ Çakışma
                              </span>
                            )}
                          </div>

                          {/* Slug */}
                          <div className="px-4 py-2 text-muted-foreground truncate font-mono text-xs">
                            {page.slug}
                          </div>

                          {/* Tip */}
                          <div className="px-4 py-2 w-32 text-muted-foreground truncate">
                            {page.page_type}
                          </div>

                          {/* Öncelik */}
                          <div className={cn('px-4 py-2 w-20 text-xs font-normal', priorityClass(page.priority))}>
                            {page.priority}
                          </div>

                          {/* Reorder ↑↓ */}
                          <div className="px-2 py-2 w-16 flex items-center justify-center gap-0.5">
                            <ReorderButton
                              pageId={page.id}
                              projectId={id}
                              direction="up"
                              disabled={isFirstSibling}
                            />
                            <ReorderButton
                              pageId={page.id}
                              projectId={id}
                              direction="down"
                              disabled={isLastSibling}
                            />
                          </div>

                          {/* Sil butonu — inline form ile server action */}
                          <div className="px-4 py-2 w-16 text-right">
                            <form
                              action={async () => {
                                'use server'
                                await deletePage(id, page.id)
                              }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                type="submit"
                                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                              >
                                Sil
                              </Button>
                            </form>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              {/* ─── Bölüm 2: Menüler ────────────────────────────────────── */}
              <section className="space-y-4">
                <h2 className="text-base font-semibold">Menüler</h2>

                <div className="space-y-8">
                  {MENU_CONFIGS.map(({ type, title }) => (
                    <MenuEditor
                      key={type}
                      projectId={id}
                      menuType={type}
                      menuTitle={title}
                      initialItems={menuMap[type] ?? []}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
