import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LockedModuleBanner } from '@/components/control-center/LockedModuleBanner'
import { ModuleAIPanel } from '@/components/control-center/ModuleAIPanel'
import { InventoryTable, type InventoryPage } from '@/app/(dashboard)/projeler/[id]/icerik-envanteri/InventoryTable'

type PageWithPackage = {
  id: string
  title: string
  slug: string | null
  page_type: string | null
  status: string | null
  focus_keyword_id: string | null
  pkg_status: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Bekliyor',       color: 'text-muted-foreground' },
  in_progress:{ label: 'Yazılıyor',     color: 'text-blue-400' },
  ready:      { label: 'Hazır',         color: 'text-emerald-400' },
  locked:     { label: 'Brief Hazır',   color: 'text-violet-400' },
  published:  { label: 'Yayında',       color: 'text-green-400' },
  // Virtual status for pages with no package — show as actionable
  no_brief:   { label: 'Brief Bekliyor', color: 'text-amber-400' },
}

export default async function LifecyclePage({
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
    .select('id, name, site_type, import_status, blueprint_approved, technical_audit_approved')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!project) notFound()

  const blueprintApproved  = (project as unknown as { blueprint_approved: boolean | null }).blueprint_approved ?? false
  const technicalAudit     = (project as unknown as { technical_audit_approved: boolean | null }).technical_audit_approved ?? false
  const siteType           = (project as unknown as { site_type: string | null }).site_type
  const isExistingSite     = siteType === 'existing_site'

  if (!blueprintApproved) {
    return (
      <div className="p-6">
        <LockedModuleBanner
          reason="İçerik modülü için önce Site Blueprint onaylanmalıdır."
          unlockCondition="Site Blueprint adımını tamamlayıp onaylayın."
          ctaLabel="Site Blueprint'e Git"
          ctaHref={`/control-center/projects/${id}/architecture/blueprint`}
        />
      </div>
    )
  }

  // ── Existing site: Content Inventory ──────────────────────────────────────
  if (isExistingSite) {
    const importStatus = (project as unknown as { import_status: string | null }).import_status
    const importDone   = importStatus !== null && !['idle', 'running', 'enriching'].includes(importStatus)

    let pages: InventoryPage[] = []
    if (importDone) {
      const { data } = await supabase
        .from('project_imported_pages')
        .select(`
          wp_id, wp_type, title, slug, link,
          gsc_clicks, gsc_impressions, gsc_avg_position,
          flag_orphan, flag_weak_page, flag_outdated,
          flag_missing_metadata, flag_missing_keyword, flag_duplicate_intent,
          page_action
        `)
        .eq('project_id', id)
        .order('title', { ascending: true })
      pages = (data ?? []) as InventoryPage[]
    }

    const { data: linkedPagesRaw } = await supabase
      .from('pages')
      .select('id, source_wp_id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .not('source_wp_id', 'is', null)

    const linkedPageMap: Record<number, string> = {}
    for (const p of linkedPagesRaw ?? []) {
      if (p.source_wp_id !== null) linkedPageMap[p.source_wp_id as number] = p.id
    }

    const isReadOnly     = technicalAudit
    const totalPages     = pages.length
    const withAction     = pages.filter((p) => !!p.page_action).length
    const flaggedPages   = pages.filter((p) =>
      p.flag_orphan || p.flag_weak_page || p.flag_outdated ||
      p.flag_missing_metadata || p.flag_missing_keyword || p.flag_duplicate_intent
    ).length

    return (
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">İçerik Envanteri</span>
            {importDone && totalPages > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalPages} sayfa · {withAction} aksiyon · {flaggedPages} sorunlu
              </span>
            )}
          </div>
          {isReadOnly && (
            <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary text-muted-foreground">
              Salt Okunur — Denetim Onaylandı
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {!importDone ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground/80">Henüz içerik aktarılmadı</p>
              <p className="text-sm text-muted-foreground mt-2">
                WordPress sitenizi içe aktardıktan sonra sayfa envanterinizi burada yönetebilirsiniz.
              </p>
            </div>
          ) : pages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              İçe aktarılan sayfa bulunamadı.
            </div>
          ) : (
            <InventoryTable
              projectId={id}
              pages={pages}
              isReadOnly={isReadOnly}
              linkedPageMap={linkedPageMap}
            />
          )}
        </div>
      </div>
    )
  }

  // ── New site: Page list with content package status ───────────────────────
  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, status, focus_keyword_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })

  const pageIds = (pagesRaw ?? []).map((p: { id: string }) => p.id)

  const pkgMap: Record<string, string | null> = {}
  if (pageIds.length > 0) {
    const { data: pkgs } = await supabase
      .from('page_packages')
      .select('page_id, status')
      .in('page_id', pageIds)
    for (const pkg of pkgs ?? []) {
      pkgMap[(pkg as { page_id: string; status: string }).page_id] = (pkg as { page_id: string; status: string }).status
    }
  }

  const pages: PageWithPackage[] = (pagesRaw ?? []).map((p: {
    id: string; title: string; slug: string | null; page_type: string | null; status: string | null; focus_keyword_id: string | null
  }) => ({
    ...p,
    pkg_status: pkgMap[p.id] ?? null,
  }))

  const totalPages       = pages.length
  const briefReadyCount  = pages.filter((p) => p.pkg_status === 'locked' || p.pkg_status === 'published').length
  const writingCount     = pages.filter((p) => p.pkg_status === 'in_progress').length
  const noBriefCount     = pages.filter((p) => !p.pkg_status).length

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <span className="text-sm font-medium text-foreground">İçerik Lifecycle</span>
        {totalPages > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{totalPages} sayfa</span>
            {briefReadyCount > 0 && <span className="text-violet-400">{briefReadyCount} brief hazır</span>}
            {writingCount > 0 && <span className="text-blue-400">{writingCount} yazılıyor</span>}
            {noBriefCount > 0 && <span className="text-amber-400">{noBriefCount} brief bekliyor</span>}
          </div>
        )}
      </div>

      <ModuleAIPanel title="İçerik Yöneticisi" hint="İçerik üretim akışı, taslak-yayın geçişleri ve önceliklendirme" />
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Henüz sayfa eklenmemiş.
            </p>
            <Link
              href={`/control-center/projects/${id}/architecture/pages`}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Sayfa Listesine Git
            </Link>
          </div>
        ) : (
          <>
            {noBriefCount > 0 && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                <p className="text-xs font-medium text-amber-400">
                  {noBriefCount} sayfa yazıma hazır — brief oluşturulmayı bekliyor
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bu sayfalar için İçerik Studio'dan brief oluşturduğunuzda durum otomatik güncellenecektir.
                </p>
              </div>
            )}
            <div className="rounded-md border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto_auto] bg-muted/50 border-b border-border text-xs text-muted-foreground">
                <div className="px-4 py-2">Sayfa Adı</div>
                <div className="px-4 py-2">Tip</div>
                <div className="px-4 py-2 w-36">İçerik Durumu</div>
                <div className="px-4 py-2 w-20" />
              </div>
              {pages.map((page) => {
                // Pages with no package are "brief bekliyor" — actionable state
                const effectiveStatus = page.pkg_status ?? 'no_brief'
                const s = STATUS_LABEL[effectiveStatus] ?? { label: effectiveStatus, color: 'text-muted-foreground' }
                return (
                  <div
                    key={page.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="px-4 py-2 font-normal truncate">{page.title}</div>
                    <div className="px-4 py-2 text-muted-foreground text-xs truncate">
                      {page.page_type ?? '—'}
                    </div>
                    <div className={`px-4 py-2 w-36 text-xs ${s.color}`}>
                      {s.label}
                    </div>
                    <div className="px-4 py-2 w-20 text-right">
                      {page.pkg_status === 'locked' || page.pkg_status === 'published' ? (
                        <Link
                          href={`/control-center/projects/${id}/content/studio/${page.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                        >
                          Düzenle
                        </Link>
                      ) : page.pkg_status === 'in_progress' ? (
                        <Link
                          href={`/control-center/projects/${id}/content/studio/${page.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-4"
                        >
                          Devam Et
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
