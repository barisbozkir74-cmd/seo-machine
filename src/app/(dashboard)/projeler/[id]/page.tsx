import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Separator } from '@/components/ui/separator'
import { ProjectInfoSection } from './ProjectInfoSection'
import { ProjectNav } from './ProjectNav'
import { hasWordPressCredentials } from '@/lib/supabase/vault'
import { WordPressConnectionSection } from './wordpress-section'
import { GscConnectionSection } from './gsc-section'
import { SiteImportSection } from './site-import-section'

export default async function ProjeDetayPage({
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
    .select(
      'id, name, domain, sector, target_country, target_language, business_model, site_type, brand_tone, target_customer, main_goal, initial_competitors, notes, custom_rules, target_keywords, created_at, gsc_property_url, import_status, import_current, import_total, import_completed_at'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  // Araştırma tamamlanmış mı? research_reports tablosunda en az 1 row varsa tamamlanmış
  const { data: researchCheck } = await supabase
    .from('research_reports')
    .select('section')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .limit(1)
  const hasResearch = (researchCheck?.length ?? 0) > 0

  // WordPress bağlantı durumu — Vault'tan SSR kontrolü
  const isWpConfigured = await hasWordPressCredentials(id)

  // GSC bağlantı durumu — gsc_tokens null check (Pitfall 5: gsc_tokens SELECT'e dahil edilmez)
  const { data: gscCheck } = await supabase
    .from('projects')
    .select('gsc_tokens')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  const isGscConnected = gscCheck?.gsc_tokens !== null && gscCheck?.gsc_tokens !== undefined

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href="/projeler"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← Projeler
        </Link>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{project.domain}</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}`} />
        </div>

        {/* Sağ içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8">
          <h2 className="text-base font-semibold mb-6">Proje Bilgileri</h2>
          <ProjectInfoSection
            projectId={project.id}
            userId={user.id}
            hasResearch={hasResearch}
            initialData={{
              name: project.name,
              domain: project.domain,
              sector: project.sector,
              target_country: project.target_country,
              target_language: project.target_language,
              business_model: project.business_model,
              site_type: project.site_type,
              brand_tone: project.brand_tone,
              target_customer: project.target_customer,
              main_goal: project.main_goal,
              initial_competitors: project.initial_competitors,
              notes: project.notes,
              custom_rules: project.custom_rules,
              target_keywords: project.target_keywords,
            }}
          />

          <Separator className="my-8" />

          <WordPressConnectionSection
            projectId={project.id}
            isConfigured={isWpConfigured}
          />


          <Separator className="my-8" />

          <GscConnectionSection
            projectId={project.id}
            userId={user.id}
            isConnected={isGscConnected}
            gscPropertyUrl={project.gsc_property_url ?? null}
          />

          <Separator className="my-8" />

          <SiteImportSection
            projectId={project.id}
            hasWpCredentials={isWpConfigured}
            initialImportStatus={project.import_status ?? null}
            initialImportCurrent={project.import_current ?? 0}
            initialImportTotal={project.import_total ?? 0}
            importCompletedAt={project.import_completed_at ?? null}
          />
        </div>
      </div>
    </div>
  )
}
