import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ProjectNav } from '../ProjectNav'
import { AddLinkDialog } from './AddLinkDialog'
import { LinkDeleteButton } from './LinkDeleteButton'
import { SuggestLinksButton } from './SuggestLinksButton'

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = {
  id: string
  title: string
  slug: string
}

type InternalLink = {
  id: string
  source_page_id: string
  target_page_id: string
  anchor_text: string
  link_type: string
}

const LINK_TYPE_LABELS: Record<string, string> = {
  contextual: 'Bağlamsal',
  navigation: 'Navigasyon',
  footer: 'Footer',
  breadcrumb: 'Breadcrumb',
}

const LINK_TYPE_STYLES: Record<string, string> = {
  contextual: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  navigation: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  footer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  breadcrumb: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IcLinkHaritasiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  const { data: pagesRaw } = await supabase
    .from('pages')
    .select('id, title, slug')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('title', { ascending: true })

  const pages: Page[] = pagesRaw ?? []

  const { data: linksRaw } = await supabase
    .from('internal_links')
    .select('id, source_page_id, target_page_id, anchor_text, link_type')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const links: InternalLink[] = linksRaw ?? []

  // Sayfa id → başlık haritası
  const pageMap = new Map<string, Page>(pages.map((p) => [p.id, p]))

  // Orphan sayfalar: hiç link almamış veya vermemiş sayfalar (D-05)
  // Sadece links.length > 0 iken anlamlıdır
  const linkedPageIds = new Set([
    ...links.map((l) => l.source_page_id),
    ...links.map((l) => l.target_page_id),
  ])
  const orphanPages = links.length > 0
    ? pages.filter((p) => !linkedPageIds.has(p.id))
    : []

  // Özet istatistikler
  const totalLinks = links.length
  const uniqueSourceIds = new Set(links.map((l) => l.source_page_id))
  const uniqueTargetIds = new Set(links.map((l) => l.target_page_id))

  // Sayfa bazlı gelen/giden sayıları
  const incomingCount = new Map<string, number>()
  const outgoingCount = new Map<string, number>()

  for (const page of pages) {
    incomingCount.set(page.id, 0)
    outgoingCount.set(page.id, 0)
  }

  for (const link of links) {
    outgoingCount.set(link.source_page_id, (outgoingCount.get(link.source_page_id) ?? 0) + 1)
    incomingCount.set(link.target_page_id, (incomingCount.get(link.target_page_id) ?? 0) + 1)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">İç Link Haritası</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/ic-link-haritasi`} />
        </div>

        {/* Sağ içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-8">

          {/* Orphan uyarı banner — sadece links > 0 ve orphan > 0 iken göster (D-05) */}
          {orphanPages.length > 0 && links.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/20 px-4 py-4 text-sm text-amber-400">
              <span className="font-semibold">
                ⚠ {orphanPages.length} sayfa hiçbir linke bağlı değil:{' '}
              </span>
              {orphanPages.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  <span className="font-semibold">[{p.title}]</span>
                </span>
              ))}
              <span className="block mt-1 text-amber-400/70 text-xs">
                Bu sayfalara gelen veya giden link ekleyin.
              </span>
            </div>
          )}

          {/* Başlık + Link Öner + Link Ekle butonları */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Linkler</h2>
            {pages.length > 0 && (
              <div className="flex items-center gap-2">
                <SuggestLinksButton projectId={id} disabled={pages.length === 0} />
                <AddLinkDialog
                  projectId={id}
                  pages={pages.map((p) => ({ id: p.id, title: p.title }))}
                />
              </div>
            )}
          </div>

          {/* Özet satırı */}
          {links.length > 0 && (
            <div className="flex gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-2xl font-semibold">{totalLinks}</span>
                <span className="text-muted-foreground">Toplam Link</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-2xl font-semibold">{uniqueSourceIds.size}</span>
                <span className="text-muted-foreground">Kaynak Sayfa</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-2xl font-semibold">{uniqueTargetIds.size}</span>
                <span className="text-muted-foreground">Hedef Sayfa</span>
              </div>
            </div>
          )}

          {/* Boş durum: sayfa yok */}
          {pages.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Henüz sayfa eklenmemiş. Önce Sayfa Listesi bölümünden sayfaları oluşturun.
            </div>
          ) : links.length === 0 ? (
            /* Boş durum: link yok */
            <div className="text-sm text-muted-foreground py-8 text-center">
              Henüz iç link eklenmemiş. Sağ üstten ekleyebilirsiniz.
            </div>
          ) : (
            /* Ana link tablosu */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaynak Sayfa</TableHead>
                  <TableHead>Hedef Sayfa</TableHead>
                  <TableHead>Anchor Text</TableHead>
                  <TableHead>Link Tipi</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => {
                  const sourcePage = pageMap.get(link.source_page_id)
                  const targetPage = pageMap.get(link.target_page_id)
                  const typeStyle = LINK_TYPE_STYLES[link.link_type] ?? 'bg-secondary text-muted-foreground border-border'
                  const typeLabel = LINK_TYPE_LABELS[link.link_type] ?? link.link_type

                  return (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">
                        {sourcePage?.title ?? (
                          <span className="text-muted-foreground text-xs italic">Silinmiş sayfa</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {targetPage?.title ?? (
                          <span className="text-muted-foreground text-xs italic">Silinmiş sayfa</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {link.anchor_text || (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeStyle}`}
                        >
                          {typeLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <LinkDeleteButton linkId={link.id} projectId={id} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {/* Sayfa bazlı özet tablo */}
          {pages.length > 0 && links.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-base font-semibold mb-4">Sayfa Bazlı Özet</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sayfa</TableHead>
                      <TableHead className="text-right">Gelen Link</TableHead>
                      <TableHead className="text-right">Giden Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((page) => {
                      const incoming = incomingCount.get(page.id) ?? 0
                      const outgoing = outgoingCount.get(page.id) ?? 0
                      if (incoming === 0 && outgoing === 0) return null
                      return (
                        <TableRow key={page.id}>
                          <TableCell className="font-medium">{page.title}</TableCell>
                          <TableCell className="text-right">
                            {incoming > 0 ? (
                              <span className="text-emerald-400 font-medium">{incoming}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {outgoing > 0 ? (
                              <span className="text-blue-400 font-medium">{outgoing}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
