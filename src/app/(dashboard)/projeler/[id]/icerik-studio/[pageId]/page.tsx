import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RULE_META } from '@/lib/rules/rule-meta'
import { ProjectNav } from '../../ProjectNav'
import { ContentStudioShell } from './components/ContentStudioShell'

// PackageData tipi — ContentStudioShell'e geçilecek
type PackageData = {
  id: string
  status: string
  seo_title: string | null
  meta_description: string | null
  h1: string | null
  focus_keyword_id: string | null
  search_intent: string | null
  page_type: string | null
  strategic_purpose: string | null
  heading_hierarchy: unknown
  content_sections: unknown
  html_content: string | null
}

export default async function IcerikStudioPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>
}) {
  const { id, pageId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Proje sahipliği
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, domain, sector, brand_tone, target_language')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  // Sayfa
  const { data: page } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, focus_keyword_id')
    .eq('id', pageId)
    .eq('project_id', id)
    .eq('user_id', user.id)
    .single()
  if (!page) notFound()

  // Page package — content_sections + html_content dahil
  const { data: pkg } = await supabase
    .from('page_packages')
    .select(
      'id, status, seo_title, meta_description, h1, focus_keyword_id, search_intent, page_type, strategic_purpose, heading_hierarchy, content_sections, html_content'
    )
    .eq('page_id', pageId)
    .eq('project_id', id)
    .eq('user_id', user.id)
    .single()

  // Paket yoksa sayfa paketi sayfasına yönlendir
  if (!pkg) {
    return (
      <div className="flex flex-col h-screen">
        <div className="p-8">
          <Link
            href={`/projeler/${id}/sayfa-paketi?page=${pageId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
          >
            ← Sayfa Paketi
          </Link>
          <p className="text-sm text-muted-foreground">Bu sayfa için henüz paket oluşturulmamış.</p>
        </div>
      </div>
    )
  }

  // Rules — sayfa-paketi/page.tsx ile aynı pattern (global + project override)
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

  // Kilitli olmayan paket için uyarı (notFound() değil — kullanıcı paket durumunu görür)
  if (pkg.status !== 'locked') {
    return (
      <div className="flex flex-col h-screen">
        <div className="p-8 pb-4 shrink-0">
          <Link
            href={`/projeler/${id}/sayfa-paketi?page=${pageId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
          >
            ← Sayfa Paketi
          </Link>
          <h1 className="text-xl font-semibold">{page.title} — İçerik Stüdyosu</h1>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
            <ProjectNav projectId={id} activePath={`/projeler/${id}/sayfa-paketi`} />
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto p-8">
            <div className="p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground">
              Bu sayfa paketi henüz kilitlenmemiş. İçerik üretmek için önce paketi kilitleyin.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* ContentStudioShell — Plan 12-05'te implement edilecek client component */}
      <ContentStudioShell
        projectId={id}
        pageId={pageId}
        pageTitle={page.title}
        pkg={pkg as PackageData}
        resolvedRules={resolvedRules}
      />
    </div>
  )
}
