import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectNav } from '../ProjectNav'
import { AddPageDialog } from './AddPageDialog'
import { PageDeleteButton } from './PageDeleteButton'
import { BulkEditPagesDialog } from './BulkEditPagesDialog'
import { WpContentTab } from './WpContentTab'
import type { ImportedPage } from '@/lib/wp/normalize'

const PAGE_TYPE_LABELS: Record<string, string> = {
  'ana-sayfa': 'Ana Sayfa',
  kategori: 'Kategori Sayfası',
  hizmet: 'Hizmet Sayfası',
  urun: 'Ürün Sayfası',
  blog: 'Blog Yazısı',
  landing: 'Landing Page',
  hakkimizda: 'Hakkımızda',
  iletisim: 'İletişim',
  sss: 'SSS Sayfası',
  fiyatlandirma: 'Fiyatlandırma',
}

type PageRow = {
  id: string
  title: string
  slug: string | null
  page_type: string | null
  priority: string | null
  status: string | null
  focus_keyword_id: string | null
  keyword_text?: string | null
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-muted-foreground text-xs">—</span>

  const map: Record<string, { label: string; className: string }> = {
    'yüksek': {
      label: 'Yüksek',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    orta: {
      label: 'Orta',
      className:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    'düşük': {
      label: 'Düşük',
      className:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
  }

  const config = map[priority] ?? {
    label: priority,
    className: 'bg-secondary text-secondary-foreground',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>

  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: 'Taslak',
      className: 'bg-secondary text-secondary-foreground',
    },
    ready: {
      label: 'Hazır',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    published: {
      label: 'Yayında',
      className:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
  }

  const config = map[status] ?? {
    label: status,
    className: 'bg-secondary text-secondary-foreground',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

export default async function SayfalarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'olusturulan' } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  // Sayfaları çek
  const { data: pagesRaw } = await supabase
    .from('pages')
    .select(
      'id, title, slug, page_type, priority, status, focus_keyword_id, sort_order'
    )
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })

  const pages: PageRow[] = pagesRaw ?? []

  // Focus keyword metinlerini çek
  const keywordIds = pages
    .map((p) => p.focus_keyword_id)
    .filter((k): k is string => !!k)

  const keywordMap: Record<string, string> = {}

  if (keywordIds.length > 0) {
    const { data: keywords } = await supabase
      .from('keywords')
      .select('id, keyword')
      .in('id', keywordIds)

    for (const kw of keywords ?? []) {
      keywordMap[kw.id] = kw.keyword
    }
  }

  const pagesWithKeywords: PageRow[] = pages.map((p) => ({
    ...p,
    keyword_text: p.focus_keyword_id ? (keywordMap[p.focus_keyword_id] ?? null) : null,
  }))

  // BulkEditPagesDialog için tüm proje keyword'leri
  const { data: allKeywordsRaw } = await supabase
    .from('keywords')
    .select('id, keyword')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('keyword', { ascending: true })
  const allKeywords = (allKeywordsRaw ?? []).map((k) => ({ id: k.id, keyword: k.keyword }))

  // AddPageDialog için sadece id + title
  const existingPages = pagesWithKeywords.map((p) => ({
    id: p.id,
    title: p.title,
  }))

  // WordPress içe aktarılan sayfalar
  const { data: importedRaw } = await supabase
    .from('project_imported_pages')
    .select(`
      wp_id, wp_type, title, slug, link, parent_wp_id, wp_modified_at,
      content_summary, primary_intent,
      gsc_clicks, gsc_impressions, gsc_avg_position,
      flag_orphan, flag_weak_page, flag_outdated,
      flag_missing_metadata, flag_missing_keyword, flag_duplicate_intent
    `)
    .eq('project_id', id)
    .eq('flag_orphan', false)
    .order('wp_id', { ascending: true })

  const importedPages = (importedRaw ?? []) as ImportedPage[]

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Sayfa Listesi</h1>
            <p className="text-sm text-muted-foreground mt-1">{project.domain}</p>
          </div>
          {tab === 'olusturulan' && (
            <div className="flex items-center gap-2">
              <BulkEditPagesDialog
                projectId={id}
                pages={pagesWithKeywords.map((p) => ({
                  id: p.id,
                  title: p.title,
                  page_type: p.page_type,
                  priority: p.priority,
                  focus_keyword_id: p.focus_keyword_id,
                }))}
                keywords={allKeywords}
              />
              <AddPageDialog projectId={id} existingPages={existingPages} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-border">
          <Link
            href={`/projeler/${id}/sayfalar?tab=olusturulan`}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === 'olusturulan'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Oluşturulan
            <span className="ml-1.5 text-xs opacity-60">{pagesWithKeywords.length}</span>
          </Link>
          <Link
            href={`/projeler/${id}/sayfalar?tab=wordpress`}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === 'wordpress'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            WordPress
            <span className="ml-1.5 text-xs opacity-60">{importedPages.length}</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/sayfalar`} />
        </div>

        {/* Ana içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          {tab === 'wordpress' ? (
            importedPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
                <p className="text-sm text-muted-foreground max-w-sm">
                  Henüz WordPress içeriği içe aktarılmamış.
                </p>
                <Link href={`/projeler/${id}`} className="text-sm text-primary hover:underline">
                  WordPress Sitemi İçeri Al →
                </Link>
              </div>
            ) : (
              <WpContentTab pages={importedPages as ImportedPage[]} />
            )
          ) : pagesWithKeywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
              <p className="text-sm text-muted-foreground max-w-sm">
                Henüz sayfa eklenmemiş. Site Blueprint&apos;ten sayfaları içe
                aktarabilir veya yukarıdan yeni sayfa ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="text-xs">Sayfa Adı</TableHead>
                    <TableHead className="text-xs">Slug</TableHead>
                    <TableHead className="text-xs w-36">Sayfa Tipi</TableHead>
                    <TableHead className="text-xs w-40">Focus Keyword</TableHead>
                    <TableHead className="text-xs w-24">Öncelik</TableHead>
                    <TableHead className="text-xs w-24">Durum</TableHead>
                    <TableHead className="text-xs w-20 text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagesWithKeywords.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="text-sm font-medium">
                        {page.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                        {page.slug ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {page.page_type
                          ? (PAGE_TYPE_LABELS[page.page_type] ?? page.page_type)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {page.keyword_text ?? (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={page.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={page.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <PageDeleteButton
                          projectId={id}
                          pageId={page.id}
                          pageTitle={page.title}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
