import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listAuditEntries } from '@/core/audit/trail'
import { OnaylarTabs } from '@/app/(dashboard)/projeler/[id]/onaylar/OnaylarTabs'
import { listApprovalHistory } from '@/core/approval/queue'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import type { AuditEntry } from '@/core/audit/trail'
import type { ApprovalRequest } from '@/core/approval/queue'

// ─── Demo seed data for Rüzgar Kesici Shop ───────────────────────────────────
// Shown only when the project has no real records yet (fresh demo project).
// Reflects a realistic early-stage SEO project lifecycle for a wind-barrier
// e-commerce client: module init → keyword content generation → decision lock
// approval (approved by project owner).

const DEMO_PROJECT_ID = '363e88ad-451a-4dd3-9a19-65ceeb850e1d'
const DEMO_ACTOR_ID   = 'system'

const DEMO_AUDIT_ENTRIES: AuditEntry[] = [
  {
    id:            'demo-audit-1',
    project_id:    DEMO_PROJECT_ID,
    user_id:       DEMO_ACTOR_ID,
    actor_type:    'system',
    actor_id:      DEMO_ACTOR_ID,
    action_type:   'module_initialized',
    resource_type: 'project',
    resource_id:   DEMO_PROJECT_ID,
    reason:        'Rüzgar Kesici Shop projesi Decision OS modülü ile başlatıldı',
    success:       true,
    severity:      'info',
    metadata:      { module: 'decision_os', version: '1.0' },
    created_at:    '2025-05-28T09:12:00.000Z',
  },
  {
    id:            'demo-audit-2',
    project_id:    DEMO_PROJECT_ID,
    user_id:       DEMO_ACTOR_ID,
    actor_type:    'ai',
    actor_id:      'claude-3-7-sonnet',
    action_type:   'content_generated',
    resource_type: 'page',
    resource_id:   'ruzgar-kesici-nedir',
    reason:        '"Rüzgar Kesici Nedir?" kategori sayfası içeriği üretildi (1.240 kelime)',
    success:       true,
    severity:      'info',
    metadata:      { word_count: 1240, target_keyword: 'rüzgar kesici nedir', locale: 'tr-TR' },
    created_at:    '2025-05-29T14:35:00.000Z',
  },
  {
    id:            'demo-audit-3',
    project_id:    DEMO_PROJECT_ID,
    user_id:       DEMO_ACTOR_ID,
    actor_type:    'human',
    actor_id:      DEMO_ACTOR_ID,
    action_type:   'approval_granted',
    resource_type: 'decision',
    resource_id:   'karar-montaj-hizmeti-usp',
    reason:        '"Montaj hizmeti USP" kararı proje sahibi tarafından onaylandı',
    success:       true,
    severity:      'info',
    metadata:      { approval_request_id: 'demo-approval-1', decision_type: 'brand_positioning' },
    created_at:    '2025-05-30T10:05:00.000Z',
  },
]

const DEMO_APPROVAL_REQUESTS: ApprovalRequest[] = [
  {
    id:                'demo-approval-1',
    project_id:        DEMO_PROJECT_ID,
    user_id:           DEMO_ACTOR_ID,
    artifact_type:     'decision_lock',
    artifact_id:       'karar-montaj-hizmeti-usp',
    artifact_snapshot: {
      lifecycle_status: 'active',
      lock_reason:      'Tüm içerik üretiminin bu USP etrafında şekillenmesi gerekiyor',
      locked_by:        DEMO_ACTOR_ID,
    },
    blocks_manager_ids: [],
    status:            'approved',
    expires_at:        '2025-06-02T10:00:00.000Z',
    resolution_notes:  'USP doğru — montaj hizmeti rakiplerden belirgin şekilde ayrışıyor. Kilit onaylandı.',
    created_at:        '2025-05-29T18:00:00.000Z',
  },
]
// ─────────────────────────────────────────────────────────────────────────────

export default async function PublishHistoryPage({
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
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const isProjectOwner = (project as unknown as { user_id: string }).user_id === user.id

  const [approvalResult, auditResult] = await Promise.all([
    listApprovalHistory(supabase, id, { status: 'all', limit: 20 }),
    listAuditEntries(supabase, id, { limit: 20 }),
  ])

  // For the demo project, seed synthetic data when the tables are still empty
  const isDemoProject = id === DEMO_PROJECT_ID
  const approvals = approvalResult.items.length === 0 && isDemoProject
    ? DEMO_APPROVAL_REQUESTS
    : approvalResult.items
  const auditEntries = auditResult.items.length === 0 && isDemoProject
    ? DEMO_AUDIT_ENTRIES
    : auditResult.items

  const totalRecords = approvals.length + auditEntries.length

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Yayın Geçmişi</span>
        {totalRecords > 0 && (
          <span className="ml-3 text-xs text-muted-foreground">
            {auditEntries.length} audit · {approvals.length} onay
          </span>
        )}
      </div>
      <ModuleAIPanel title="Yayın Geçmişi Yöneticisi" hint="Yayın geçmişi analizi ve audit kaydı" />
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <OnaylarTabs
          projectId={id}
          userId={user.id}
          isProjectOwner={isProjectOwner}
          initialApprovalPage={{
            approvals:   approvals,
            has_more:    approvalResult.has_more,
            next_cursor: approvalResult.next_cursor,
          }}
          initialAuditPage={{
            entries:     auditEntries,
            has_more:    auditResult.has_more,
            next_cursor: auditResult.next_cursor,
          }}
        />
      </div>
    </div>
  )
}
