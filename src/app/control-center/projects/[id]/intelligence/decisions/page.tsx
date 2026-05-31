import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listDecisions } from '@/core/decision/list'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { SplitPane } from '@/components/control-center/SplitPane'
import { DecisionSectionGroups } from './DecisionSectionGroups'

export default async function DecisionsPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; section?: string }>
}) {
  const { id }              = await params
  const { tab, section }    = await searchParams
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

  // Unique section count (from active decisions)
  const uniqueSections      = [...new Set(activeDecisions.map((d) => d.section).filter(Boolean))]
  const uniqueSectionCount  = uniqueSections.length

  // Base decisions for current tab, then optionally filter by ?section=
  const tabDecisions     = showHistory ? inactiveDecisions : activeDecisions
  const displayDecisions = section
    ? tabDecisions.filter((d) => d.section === section)
    : tabDecisions

  // Panel context items
  const panelContextItems = [
    {
      label: 'Aktif Karar',
      value: `${activeDecisions.length} adet`,
      status: (activeDecisions.length > 0 ? 'ok' : 'warning') as 'ok' | 'warning',
    },
    {
      label: 'Karar Geçmişi',
      value: `${inactiveDecisions.length} geçmiş`,
      status: 'ok' as const,
    },
    {
      label: 'Bölüm',
      value: `${uniqueSectionCount} bölüm`,
      status: (uniqueSectionCount > 0 ? 'ok' : 'missing') as 'ok' | 'missing',
    },
  ]

  const panelNextStep =
    activeDecisions.length === 0
      ? 'Henüz karar alınmamış. AI modülleri karar ürettiğinde burada görünür.'
      : `${activeDecisions.length} aktif karar, ${uniqueSectionCount} bölümde kayıtlı.`

  const decisionsBase = `${base}/decisions`

  const panelActions = [
    { label: 'Aktif Kararlar',      href: decisionsBase,                           variant: 'primary' as const },
    { label: 'Karar Geçmişi',       href: `${decisionsBase}?tab=gecmis` },
    { label: 'Araştırma Kararları', href: `${decisionsBase}?section=arastirma` },
    { label: 'Keyword Kararları',   href: `${decisionsBase}?section=keyword-stratejisi` },
  ]

  return (
    <div className="flex flex-1 flex-col min-h-0">
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

      <SplitPane
        storageKey="kararlar"
        defaultRightWidth={288}
        minRightWidth={180}
        maxRightWidth={520}
        right={
          <ModuleAIPanel
            variant="sidebar"
            title="Karar Havuzu"
            managerName="Karar Yöneticisi"
            hint="Tüm bölüm kararlarını izler. AI aksiyonları bu havuzu okur ve yeni kararları buraya yazar."
            section="kararlar"
            contextItems={panelContextItems}
            nextStep={panelNextStep}
            actions={panelActions}
          />
        }
      >
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
      </SplitPane>
    </div>
  )
}
