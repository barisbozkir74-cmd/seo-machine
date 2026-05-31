import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listDecisions } from '@/core/decision/list'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { DecisionSectionGroups } from './DecisionSectionGroups'

export default async function DecisionsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id }  = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, research_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const base = `/control-center/projects/${id}/intelligence`

  if (!(project as unknown as { research_approved: boolean }).research_approved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="Araştırma onaylanmadan kararlar görüntülenemez."
          unlockCondition="Araştırma adımını tamamlayıp onaylayın."
          ctaLabel="Araştırmaya Git"
          ctaHref={`${base}/research`}
        />
      </div>
    )
  }

  const showHistory = tab === 'gecmis'

  // Fetch all decisions — no lifecycle filter so we get active + inactive
  const decisionResult = await listDecisions(supabase, id, { limit: 100 })
  const allDecisions   = decisionResult.items

  // Split by is_active for the tab counts
  const activeDecisions   = allDecisions.filter((d) => d.is_active)
  const inactiveDecisions = allDecisions.filter((d) => !d.is_active)

  const displayDecisions = showHistory ? inactiveDecisions : activeDecisions

  return (
    <div className="flex flex-col min-h-0">
      {/* AI Panel */}
      <ModuleAIPanel
        title="Karar Havuzu"
        managerName="Karar Yöneticisi"
        hint="Tüm bölüm kararlarını izler. AI aksiyonları bu havuzu okur ve yeni kararları buraya yazar."
      />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/40 px-6 pt-4 pb-0">
        <a
          href={`/control-center/projects/${id}/intelligence/decisions`}
          className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
            !showHistory
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Aktif Kararlar
          {activeDecisions.length > 0 && (
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {activeDecisions.length}
            </span>
          )}
        </a>
        <a
          href={`/control-center/projects/${id}/intelligence/decisions?tab=gecmis`}
          className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors ${
            showHistory
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Karar Geçmişi
          {inactiveDecisions.length > 0 && (
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {inactiveDecisions.length}
            </span>
          )}
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {displayDecisions.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-secondary/20 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {showHistory
                ? 'Geçmişte pasif edilmiş karar yok.'
                : 'Henüz aktif karar bulunmuyor. Araştırma sayfasındaki Kararları Kaydet butonunu kullanın.'}
            </p>
          </div>
        ) : (
          <DecisionSectionGroups
            decisions={displayDecisions}
            projectId={id}
            showReactivate={showHistory}
          />
        )}
      </div>
    </div>
  )
}
