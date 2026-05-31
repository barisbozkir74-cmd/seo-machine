import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'
import { AddPageDialog } from '@/app/(dashboard)/projeler/[id]/sayfalar/AddPageDialog'
import { PageDeleteButton } from '@/app/(dashboard)/projeler/[id]/sayfalar/PageDeleteButton'
import { BulkEditPagesDialog } from '@/app/(dashboard)/projeler/[id]/sayfalar/BulkEditPagesDialog'

const PAGE_TYPE_LABELS: Record<string, string> = {
  'ana-sayfa':      'Ana Sayfa',
  kategori:         'Kategori Sayfası',
  hizmet:           'Hizmet Sayfası',
  urun:             'Ürün Sayfası',
  blog:             'Blog Yazısı',
  landing:          'Landing Page',
  hakkimizda:       'Hakkımızda',
  iletisim:         'İletişim',
  sss:              'SSS Sayfası',
  fiyatlandirma:    'Fiyatlandırma',
}

type PageRow = {
  id: string
  title: string
  slug: string | null
  page_type: string | null
  priority: string | null
  status: string | null
  focus_keyword_id: string | null
  source_wp_id?: number | null
  keyword_text?: string | null
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-muted-foreground text-xs">—</span>
  const map: Record<string, { label: string; className: string }> = {
    'yüksek': { label: 'Yüksek', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    orta:     { label: 'Orta',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    'düşük':  { label: 'Düşük', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  }
  const config = map[priority] ?? { label: priority, className: 'bg-secondary text-secondary-foreground' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>
  const map: Record<string, { label: string; className: string }> = {
    draft:     { label: 'Taslak', className: 'bg-secondary text-secondary-foreground' },
    ready:     { label: 'Hazır',  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    published: { label: 'Yayında', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  }
  const config = map[status] ?? { label: status, className: 'bg-secondary text-secondary-foreground' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}

export default async function PagesPage({
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
    .select('id, name, domain, blueprint_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const blueprintApproved = (project as unknown as { blueprint_approved: boolean | null }).blueprint_approved ?? false

  if (!blueprintApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="Sayfa listesi için önce Site Blueprint onaylanmalıdır."
          unlockCondition="Site Blueprint adımını tamamlayıp onaylayın."
          ctaLabel="Site Blueprint'e Git"
          ctaHref={`/control-center/projects/${id}/architecture/blueprint`}
        />
      </div>
    )
  }

  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, priority, status, focus_keyword_id, sort_order, source_wp_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })

  const pages: PageRow[] = pagesRaw ?? []

  const keywordIds = pages.map((p) => p.focus_keyword_id).filter((k): k is string => !!k)
  const keywordMap: Record<string, string> = {}
  if (keywordIds.length > 0) {
    const { data: keywords } = await supabase
      .from('keywords')
      .select('id, keyword')
      .in('id', keywordIds)
    for (const kw of keywords ?? []) keywordMap[kw.id] = kw.keyword
  }

  const pagesWithKeywords: PageRow[] = pages.map((p) => ({
    ...p,
    keyword_text: p.focus_keyword_id ? (keywordMap[p.focus_keyword_id] ?? null) : null,
  }))

  const { data: allKeywordsRaw } = await supabase
    .from('keywords')
    .select('id, keyword')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('keyword', { ascending: true })
  const allKeywords = (allKeywordsRaw ?? []).map((k) => ({ id: k.id, keyword: k.keyword }))

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Sayfa Listesi</span>
          {pagesWithKeywords.length > 0 && (
            <span className="text-xs text-muted-foreground">{pagesWithKeywords.length} sayfa</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <BulkEditPagesDialog
            projectId={id}
            pages={pagesWithKeywords.map((p) => ({
              id:               p.id,
              title:            p.title,
              page_type:        p.page_type,
              priority:         p.priority,
              focus_keyword_id: p.focus_keyword_id,
            }))}
            keywords={allKeywords}
          />
          <AddPageDialog projectId={id} existingPages={pagesWithKeywords.map((p) => ({ id: p.id, title: p.title }))} />
        </div>
      </div>

      <SplitPane
        storageKey="sayfalar"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Sayfa Yöneticisi"
            managerName="Sayfa Yöneticisi"
            hint="Sayfa önceliklendirme, içerik planlama ve yapısal kararlar"
            section="sayfalar"
          />
        }
      >
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {pagesWithKeywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Henüz sayfa eklenmemiş. Site Blueprint&apos;ten aktarabilir veya yeni sayfa ekleyebilirsiniz.
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
                        <div className="flex items-center gap-2">
                          {page.title}
                          {page.source_wp_id != null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 shrink-0">
                              İyileştirme
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                        {page.slug ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {page.page_type ? (PAGE_TYPE_LABELS[page.page_type] ?? page.page_type) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {page.keyword_text ?? <span className="text-muted-foreground/40 text-xs">—</span>}
                      </TableCell>
                      <TableCell><PriorityBadge priority={page.priority} /></TableCell>
                      <TableCell><StatusBadge status={page.status} /></TableCell>
                      <TableCell className="text-right">
                        <PageDeleteButton projectId={id} pageId={page.id} pageTitle={page.title} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SplitPane>
    </div>
  )
}
