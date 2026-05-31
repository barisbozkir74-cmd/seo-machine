import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listApprovalHistory } from '@/core/approval/queue'
import { listAuditEntries } from '@/core/audit/trail'
import { OnaylarTabs } from '@/app/(dashboard)/projeler/[id]/onaylar/OnaylarTabs'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'

export default async function PublishQueuePage({
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

  const noApprovals = approvalResult.items.length === 0
  const noAudit     = auditResult.items.length === 0

  const approvalEmptyNode = noApprovals ? (
    <div className="rounded-lg border border-border bg-card p-6 mt-2">
      <p className="text-sm font-medium text-foreground mb-1">Henüz onay isteği yok</p>
      <p className="text-sm text-muted-foreground mb-4">
        Onay akışı, bir karar kilitlendiğinde veya geçersiz kılındığında devreye girer.
        Örneğin keyword stratejisindeki bir kümeyi kilitlediğinizde ya da bir kararın
        üzerine yazıldığında burada onay isteği oluşur ve ilgili kişiye bildirim gider.
      </p>
      <div className="rounded-md border border-border bg-background/50 p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Onay akışını başlatmak için
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-none">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-foreground">1</span>
            <span>
              <Link
                href={`/control-center/projects/${id}/intelligence/keywords`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                Keyword Stratejisi
              </Link>
              {'  sayfasına gidin ve bir kümeyi kilitleyin'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-foreground">2</span>
            <span>
              <Link
                href={`/control-center/projects/${id}/intelligence/decisions`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                Kararlar
              </Link>
              {'  sayfasında mevcut bir kararın üzerine yazın (override)'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-foreground">3</span>
            <span>Sistem otomatik olarak bu sayfada bir onay isteği oluşturur</span>
          </li>
        </ol>
      </div>
      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-xs text-amber-400/90">
          <span className="font-semibold">Rüzgar Kesici Shop için örnek senaryo:</span>
          {' '}Ajans, "rüzgar kesici balkon" kümesini kilitler — mal sahibi bu sayfaya gelerek
          kümenin yayına alınmasını onaylar ya da reddeder. Tüm aksiyonlar audit trail&apos;e kaydedilir.
        </p>
      </div>
    </div>
  ) : undefined

  const auditEmptyNode = noAudit ? (
    <div className="rounded-lg border border-border bg-card p-6 mt-2">
      <p className="text-sm font-medium text-foreground mb-1">Audit kaydı henüz yok</p>
      <p className="text-sm text-muted-foreground">
        Kullanıcı ve sistem aksiyonları (onay, red, geçersiz kılma, yayın) otomatik olarak
        burada kayıt altına alınır. İlk işlem gerçekleştiğinde değişmez bir iz oluşturulur.
      </p>
    </div>
  ) : undefined

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-shrink-0 items-center border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Onaylar</span>
        {approvalResult.items.length > 0 && (
          <span className="ml-3 text-xs text-muted-foreground">
            {approvalResult.items.length} kayıt
          </span>
        )}
      </div>
      <ModuleAIPanel title="Yayın Yöneticisi" hint="Onay akışı, yayın kuyruğu ve süreç yönetimi" />
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <OnaylarTabs
          projectId={id}
          userId={user.id}
          isProjectOwner={isProjectOwner}
          initialApprovalPage={{
            approvals:   approvalResult.items,
            has_more:    approvalResult.has_more,
            next_cursor: approvalResult.next_cursor,
          }}
          initialAuditPage={{
            entries:     auditResult.items,
            has_more:    auditResult.has_more,
            next_cursor: auditResult.next_cursor,
          }}
          approvalEmptyNode={approvalEmptyNode}
          auditEmptyNode={auditEmptyNode}
        />
      </div>
    </div>
  )
}
