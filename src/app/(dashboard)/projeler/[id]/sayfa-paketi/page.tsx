import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RULE_META } from '@/lib/rules/rule-meta'
import { ProjectNav } from '../ProjectNav'
import { PagePackageEditor, type PageData } from './PagePackageEditor'
import { PackageStatusBadge } from './PackageStatusBadge'
import { cn } from '@/lib/utils'

type PageRow = {
  id: string
  title: string
  slug: string | null
  page_type: string | null
  focus_keyword_id: string | null
}

type PackageRow = {
  id: string
  page_id: string
  status: string
  generated_by: string
}

export default async function SayfaPaketiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: selectedPageId } = await searchParams

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

  // Rules Engine — global + proje override'ları
  const { data: globalRulesData } = await supabase
    .from('rules')
    .select('rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('scope', 'global')
    .is('project_id', null)

  const { data: projectRulesData } = await supabase
    .from('rules')
    .select('rule_key, rule_value')
    .eq('user_id', user.id)
    .eq('project_id', id)
    .eq('scope', 'project')

  const projectOverrides = Object.fromEntries(
    (projectRulesData ?? []).map((r) => [r.rule_key, r.rule_value])
  )
  const globalValues = Object.fromEntries(
    (globalRulesData ?? []).map((r) => [r.rule_key, r.rule_value])
  )

  const resolvedRules: Record<string, boolean> = Object.fromEntries(
    Object.keys(RULE_META).map((ruleKey) => {
      const hasOverride = ruleKey in projectOverrides
      const value = hasOverride
        ? projectOverrides[ruleKey] === 'true'
        : (globalValues[ruleKey] ?? 'true') === 'true'
      return [ruleKey, value]
    })
  )

  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, focus_keyword_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('title', { ascending: true })

  const pages: PageRow[] = (pagesRaw ?? []) as PageRow[]

  // package durumlarını çek
  const pageIds = pages.map((p) => p.id)
  const packagesRaw: PackageRow[] = []
  if (pageIds.length > 0) {
    const { data } = await supabase
      .from('page_packages')
      .select('id, page_id, status, generated_by')
      .in('page_id', pageIds)
      .eq('user_id', user.id)
    if (data) packagesRaw.push(...(data as PackageRow[]))
  }
  const packageMap = new Map(packagesRaw.map((pkg) => [pkg.page_id, pkg]))

  // Seçili sayfa
  const selectedPage = selectedPageId
    ? pages.find((p) => p.id === selectedPageId) ?? null
    : null

  // Focus keyword text'lerini çek (tek sorguda)
  const focusKwIds = pages
    .map((p) => p.focus_keyword_id)
    .filter((fid): fid is string => !!fid)

  const kwMap: Record<string, string> = {}
  if (focusKwIds.length > 0) {
    const { data: kwRows } = await supabase
      .from('keywords')
      .select('id, keyword')
      .in('id', focusKwIds)

    for (const kw of kwRows ?? []) {
      kwMap[kw.id] = kw.keyword
    }
  }

  let selectedPageData: PageData | null = null
  if (selectedPage) {
    const focusKwText = selectedPage.focus_keyword_id
      ? (kwMap[selectedPage.focus_keyword_id] ?? null)
      : null

    // Seçili sayfanın package verisini çek (eğer varsa)
    let pkg: PageData['pkg'] = null
    if (packageMap.has(selectedPage.id)) {
      const { data: pkgData } = await supabase
        .from('page_packages')
        .select(
          'id, status, generated_by, seo_title, meta_description, h1, slug, search_intent, strategic_purpose, secondary_keywords, heading_hierarchy, content_blocks, cta_blocks, image_plan, alt_texts, schema_type, canonical_url, faq, schema_jsonld, qa_scores, wp_post_id, wp_post_url, wp_status, wp_published_at'
        )
        .eq('page_id', selectedPage.id)
        .single()
      pkg = pkgData as PageData['pkg']
    }

    selectedPageData = {
      ...selectedPage,
      focus_keyword_text: focusKwText,
      pkg,
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Üst başlık */}
      <div className="p-8 pb-4 shrink-0">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Sayfa Paketi</h1>
        <p className="text-sm text-muted-foreground mt-1">{project.domain}</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/sayfa-paketi`} />
        </div>

        {/* Sayfa listesi paneli */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold">Sayfalar</h2>
            {pages.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{pages.length} sayfa</p>
            )}
          </div>

          {pages.length === 0 ? (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                Sayfa Listesi bölümünden sayfaları önce ekleyin.
              </p>
            </div>
          ) : (
            <ul className="py-2">
              {pages.map((page) => {
                const isActive = page.id === selectedPageId
                const pkg = packageMap.get(page.id)

                return (
                  <li key={page.id}>
                    <Link
                      href={`/projeler/${id}/sayfa-paketi?page=${page.id}`}
                      className={cn(
                        'flex flex-col gap-1 px-4 py-3 text-sm transition-colors border-l-2',
                        isActive
                          ? 'bg-secondary border-l-foreground'
                          : 'border-l-transparent hover:bg-secondary/50 hover:border-l-border'
                      )}
                    >
                      <span
                        className={cn(
                          'leading-tight',
                          isActive ? 'text-foreground' : 'text-foreground/80'
                        )}
                      >
                        {page.title}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {page.page_type && (
                          <span className="text-xs text-muted-foreground">{page.page_type}</span>
                        )}
                        <PackageStatusBadge status={pkg?.status ?? null} />
                        {pkg?.status === 'locked' && (
                          <Link
                            href={`/projeler/${id}/icerik-studio/${page.id}`}
                            className="text-xs px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            İçerik Üret
                          </Link>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Sağ detay paneli */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          {selectedPageData ? (
            <PagePackageEditor projectId={id} page={selectedPageData} projectRules={resolvedRules} />
          ) : (
            <div className="flex items-center justify-center h-full min-h-48">
              <p className="text-sm text-muted-foreground">← Soldaki listeden bir sayfa seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
