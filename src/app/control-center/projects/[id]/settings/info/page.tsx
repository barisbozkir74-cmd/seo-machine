import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectInfoEditForm } from './ProjectInfoEditForm'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'

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

  // Sistem Durumu: created_at formatting
  const createdAt = p.created_at
    ? new Date(p.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  // Stages are in a separate table — query separately
  const { data: stagesData } = await supabase
    .from('stages')
    .select('stage_name, status')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const stageItems: Array<{ name: string; status: string }> = (stagesData ?? []).map(s => ({
    name: s.stage_name,
    status: s.status,
  }))

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Sayfa başlığı ── */}
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Proje Bilgileri</span>
      </div>

      {/* ── İki sütunlu gövde: sol içerik | sağ AI panel ── */}
      <div className="flex flex-1 min-h-0">

        {/* Sol: form içeriği */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
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

            {/* Sistem Durumu — read-only */}
            <div className="pt-5 pb-1 px-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/35 border-b border-border/30 pb-1.5">
                Sistem Durumu
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-2">
              <div className="rounded-md px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-0.5">
                  Oluşturulma
                </p>
                <p className="text-sm text-foreground">
                  {createdAt ?? <span className="text-muted-foreground/40 italic">—</span>}
                </p>
              </div>
            </div>

            {stageItems.length > 0 && (
              <div className="px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
                  Aşama Durumları
                </p>
                <div className="space-y-1">
                  {stageItems.map((stage, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">{stage.name}</span>
                      <span className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        stage.status === 'completed'
                          ? 'bg-green-500/10 text-green-400'
                          : stage.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-secondary/60 text-muted-foreground/50',
                      ].join(' ')}>
                        {stage.status === 'completed' ? 'Tamamlandı'
                          : stage.status === 'in_progress' ? 'Devam Ediyor'
                          : 'Bekliyor'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sağ: AI Manager sidebar */}
        <aside className="w-72 flex-shrink-0 border-l border-border/40 flex flex-col">
          <ModuleAIPanel
            variant="sidebar"
            title="Proje Analizi"
            managerName="Proje Koordinatörü"
            hint="Proje bağlamını analiz eder, eksik alanları tespit eder ve öncelikli adımları önerir."
          />
        </aside>

      </div>
    </div>
  )
}
