import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectInfoEditForm } from './ProjectInfoEditForm'
import { ApproveProjectInfoButton } from './ApproveProjectInfoButton'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'

export default async function ProjectInfoPage({
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
    .select('id, name, domain, sector, site_type, target_country, target_language, business_model, brand_tone, target_customer, main_goal, target_keywords, initial_competitors, notes, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const p = project as unknown as Record<string, string | null>

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Sayfa başlığı ── */}
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Proje Bilgileri</span>
      </div>

      {/* ── İki sütunlu gövde: sürüklenebilir ayraçlı ── */}
      <SplitPane
        storageKey="proje-bilgileri"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Proje Analizi"
            managerName="Proje Koordinatörü"
            hint="Proje bağlamını analiz eder, eksik alanları tespit eder ve öncelikli adımları önerir."
          />
        }
      >
        {/* Sol: form içeriği */}
        <div className="overflow-y-auto h-full p-6">
          <div className="max-w-xl">
            <ProjectInfoEditForm
              projectId={id}
              initialData={{
                name:                 p.name,
                domain:               p.domain,
                sector:               p.sector,
                site_type:            p.site_type,
                target_country:       p.target_country,
                target_language:      p.target_language,
                business_model:       p.business_model,
                brand_tone:           p.brand_tone,
                target_customer:      p.target_customer,
                main_goal:            p.main_goal,
                target_keywords:      p.target_keywords,
                initial_competitors:  p.initial_competitors,
                notes:                p.notes,
              }}
            />

            {/* ── Onayla & İlerle ── */}
            <ApproveProjectInfoButton projectId={id} />
          </div>
        </div>
      </SplitPane>
    </div>
  )
}
