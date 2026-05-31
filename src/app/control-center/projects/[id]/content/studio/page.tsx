import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'

const PAGE_TYPE_LABELS: Record<string, string> = {
  'ana-sayfa':   'Ana Sayfa',
  kategori:      'Kategori',
  hizmet:        'Hizmet',
  urun:          'Ürün',
  blog:          'Blog',
  landing:       'Landing',
  hakkimizda:    'Hakkımızda',
  iletisim:      'İletişim',
  sss:           'SSS',
  fiyatlandirma: 'Fiyatlandırma',
}

export default async function ContentStudioIndexPage({
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
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const { data: pages } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, status')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('title')

  const pageList = (pages ?? []) as Array<{
    id: string
    title: string
    slug: string | null
    page_type: string | null
    status: string | null
  }>

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">İçerik Stüdyosu</span>
      </div>

      <SplitPane
        storageKey="icerik-studyosu"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Stüdyo Yöneticisi"
            managerName="Stüdyo Yöneticisi"
            hint="İçerik kalitesi, SEO optimizasyon rehberi ve öneri üretimi"
            section="icerik-studyosu"
          />
        }
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {pageList.length === 0 ? (
            <LockedModuleBanner
              reason="İçerik Stüdyosu için önce sayfa oluşturulmalıdır."
              unlockCondition="Sayfalar bölümünden ilk sayfayı ekleyin."
              ctaLabel="Sayfalara Git"
              ctaHref={`/control-center/projects/${id}/architecture/pages`}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pageList.map((page) => (
                <li key={page.id}>
                  <Link
                    href={`/control-center/projects/${id}/content/studio/${page.id}`}
                    className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-card px-4 py-3 transition-colors hover:border-border hover:bg-secondary/30"
                  >
                    <span className="text-sm font-medium text-foreground truncate">{page.title}</span>
                    <span className="text-xs text-muted-foreground/60 truncate">
                      {page.page_type ? (PAGE_TYPE_LABELS[page.page_type] ?? page.page_type) : ''}
                      {page.slug ? ` · /${page.slug}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SplitPane>
    </div>
  )
}
