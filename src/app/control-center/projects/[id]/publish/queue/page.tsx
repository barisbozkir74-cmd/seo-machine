import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listApprovalHistory } from '@/core/approval/queue'
import { listAuditEntries } from '@/core/audit/trail'
import { OnaylarTabs } from '@/app/(dashboard)/projeler/[id]/onaylar/OnaylarTabs'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'

const WP_STATUS_LABEL: Record<string, string> = {
  publish: 'Yayında',
  draft:   'Taslak',
  pending: 'İncelemede',
  private: 'Gizli',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

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

  // Fetch pages ready to publish (locked or published packages)
  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, page_type')
    .eq('project_id', id)
    .eq('user_id', user.id)

  const pageIds = (pagesRaw ?? []).map((p: { id: string }) => p.id)
  const pageMap = Object.fromEntries(
    (pagesRaw ?? []).map((p: { id: string; title: string; page_type: string | null }) => [
      p.id, { title: p.title, page_type: p.page_type },
    ])
  )

  type QueueItem = {
    page_id: string; page_title: string; page_type: string | null
    pkg_status: string; seo_title: string | null
    wp_status: string | null; wp_published_at: string | null; updated_at: string
  }

  let queueItems: QueueItem[] = []
  if (pageIds.length > 0) {
    const { data: pkgs } = await supabase
      .from('page_packages')
      .select('page_id, status, seo_title, wp_status, wp_published_at, updated_at')
      .in('page_id', pageIds)
      .in('status', ['locked', 'published'])
      .order('updated_at', { ascending: false })

    queueItems = (pkgs ?? []).map((pkg: {
      page_id: string; status: string; seo_title: string | null
      wp_status: string | null; wp_published_at: string | null; updated_at: string
    }) => ({
      page_id:         pkg.page_id,
      page_title:      (pageMap as Record<string, { title: string; page_type: string | null }>)[pkg.page_id]?.title ?? '—',
      page_type:       (pageMap as Record<string, { title: string; page_type: string | null }>)[pkg.page_id]?.page_type ?? null,
      pkg_status:      pkg.status,
      seo_title:       pkg.seo_title,
      wp_status:       pkg.wp_status,
      wp_published_at: pkg.wp_published_at,
      updated_at:      pkg.updated_at,
    }))
  }

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
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">Yayın Kuyruğu</span>
        {queueItems.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-violet-400">{queueItems.filter(q => q.pkg_status === 'locked').length} yayına hazır</span>
            {queueItems.filter(q => q.pkg_status === 'published').length > 0 && (
              <span className="text-green-400">{queueItems.filter(q => q.pkg_status === 'published').length} yayında</span>
            )}
          </div>
        )}
        {approvalResult.items.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {approvalResult.items.length} onay kaydı
          </span>
        )}
      </div>
      <ModuleAIPanel
        title="Yayın Kuyruğu"
        managerName="Yayın Koordinatörü"
        hint="Yayın sırasını yönetir, onay bekleyen içerikleri listeler ve yayın takvimine göre önceliklendirir."
        actions={[
          { label: 'Yayın Geçmişi', href: `/control-center/projects/${id}/publish/history` },
          { label: 'İçerik Stüdyosu', href: `/control-center/projects/${id}/content/studio` },
        ]}
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-8">

        {/* ── Publish Queue Table ─────────────────────────────────────────── */}
        {queueItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Yayına Hazır Sayfalar
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] bg-muted/50 border-b border-border text-xs text-muted-foreground">
                <div className="px-4 py-2">Sayfa</div>
                <div className="px-4 py-2 w-28">Tip</div>
                <div className="px-4 py-2 w-32">Durum</div>
                <div className="px-4 py-2 w-36">WordPress</div>
                <div className="px-4 py-2 w-20" />
              </div>
              {queueItems.map((item) => {
                const wpLabel = item.wp_status
                  ? (WP_STATUS_LABEL[item.wp_status] ?? item.wp_status)
                  : '—'
                return (
                  <div
                    key={item.page_id}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="px-4 py-3 min-w-0">
                      <p className="font-normal truncate">{item.page_title}</p>
                      {item.seo_title && item.seo_title !== item.page_title && (
                        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{item.seo_title}</p>
                      )}
                    </div>
                    <div className="px-4 py-3 w-28 text-xs text-muted-foreground truncate">
                      {item.page_type ?? '—'}
                    </div>
                    <div className={`px-4 py-3 w-32 text-xs font-medium ${item.pkg_status === 'published' ? 'text-green-400' : 'text-violet-400'}`}>
                      {item.pkg_status === 'published' ? 'Yayında' : 'Yayına Hazır'}
                    </div>
                    <div className="px-4 py-3 w-36 text-xs text-muted-foreground">
                      {item.wp_published_at
                        ? <span className="text-green-400">{formatDate(item.wp_published_at)}</span>
                        : wpLabel
                      }
                    </div>
                    <div className="px-4 py-3 w-20 text-right">
                      <Link
                        href={`/control-center/projects/${id}/content/studio/${item.page_id}`}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                      >
                        İncele
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground/60">
              WordPress entegrasyonu aktif olduğunda yayın işlemleri buradan yönetilebilir.
            </p>
          </div>
        )}

        {/* ── Approvals & Audit ───────────────────────────────────────────── */}
        <div>
          {queueItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Henüz yayına hazır içerik yok.</p>
              <p className="text-xs text-muted-foreground/70">
                İçerik Studio&apos;da brief tamamlandığında sayfalar burada görünür.
              </p>
              <Link
                href={`/control-center/projects/${id}/content/lifecycle`}
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground mt-2"
              >
                İçerik Lifecycle&apos;a Git
              </Link>
            </div>
          )}
          <div className={queueItems.length > 0 ? '' : 'hidden'}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Onaylar & Audit Trail
            </p>
          </div>
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
    </div>
  )
}
