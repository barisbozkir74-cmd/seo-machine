import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectNav } from '../ProjectNav'
import { AddPageModal } from './AddPageModal'
import { MenuEditor } from './MenuEditor'
import { deletePage } from './actions'
import type { MenuType, MenuItem } from './actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Tipler ───────────────────────────────────────────────────────────────────

type Page = {
  id: string
  title: string
  slug: string
  page_type: string
  priority: string
  parent_id: string | null
  sort_order: number
}

type Menu = {
  id: string
  menu_type: MenuType
  items: MenuItem[]
}

type PageWithDepth = Page & { depth: number }

// ─── Yardımcı: Ağaç düzleştirici ─────────────────────────────────────────────

function flattenTree(pages: Page[]): PageWithDepth[] {
  const childrenMap: Record<string, Page[]> = {}

  for (const page of pages) {
    const key = page.parent_id ?? '__root__'
    if (!childrenMap[key]) childrenMap[key] = []
    childrenMap[key].push(page)
  }

  function sortPages(list: Page[]): Page[] {
    return [...list].sort((a, b) => a.sort_order - b.sort_order)
  }

  function walk(parentKey: string, depth: number): PageWithDepth[] {
    const children = sortPages(childrenMap[parentKey] ?? [])
    const result: PageWithDepth[] = []
    for (const child of children) {
      result.push({ ...child, depth })
      result.push(...walk(child.id, depth + 1))
    }
    return result
  }

  return walk('__root__', 0)
}

// ─── Menü başlıkları ──────────────────────────────────────────────────────────

const MENU_CONFIGS: { type: MenuType; title: string }[] = [
  { type: 'top', title: 'Üst Menü' },
  { type: 'main', title: 'Ana Menü' },
  { type: 'footer', title: 'Footer' },
]

// ─── Öncelik badge rengi ──────────────────────────────────────────────────────

function priorityClass(priority: string): string {
  if (priority === 'yüksek') return 'text-red-500'
  if (priority === 'orta') return 'text-yellow-500'
  if (priority === 'düşük') return 'text-muted-foreground'
  return 'text-muted-foreground'
}

// ─── Sil action wrapper ───────────────────────────────────────────────────────
// Server action'ı client'a geçiremeyiz; satır inline form ile çağırır.

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SiteBlueprintPage({
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

  // Sayfaları çek
  const { data: pagesData } = await supabase
    .from('pages')
    .select('id, title, slug, page_type, priority, parent_id, sort_order')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  const pages: Page[] = (pagesData ?? []) as Page[]
  const flatPages = flattenTree(pages)

  // Menüleri çek
  const { data: menusData } = await supabase
    .from('menus')
    .select('id, menu_type, items')
    .eq('project_id', id)
    .eq('user_id', user.id)

  const menus: Menu[] = (menusData ?? []) as Menu[]
  const menuMap: Partial<Record<MenuType, MenuItem[]>> = {}
  for (const menu of menus) {
    menuMap[menu.menu_type] = (menu.items as MenuItem[]) ?? []
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Başlık */}
      <div className="p-8 pb-4">
        <Link
          href={`/projeler/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
        >
          ← {project.name}
        </Link>
        <h1 className="text-xl font-semibold">Site Blueprint</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sol navigasyon */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-4">
          <ProjectNav projectId={id} activePath={`/projeler/${id}/site-blueprint`} />
        </div>

        {/* Sağ içerik */}
        <div className="flex-1 min-w-0 overflow-y-auto p-8 space-y-12">

          {/* ─── Bölüm 1: Site Ağacı ─────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Site Ağacı</h2>
              <AddPageModal projectId={id} existingPages={pages.map((p) => ({ id: p.id, title: p.title }))} />
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              {/* Tablo başlığı */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-0 bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium">
                <div className="px-4 py-2">Sayfa Adı</div>
                <div className="px-4 py-2">Slug</div>
                <div className="px-4 py-2 w-32">Tip</div>
                <div className="px-4 py-2 w-20">Öncelik</div>
                <div className="px-4 py-2 w-16"></div>
              </div>

              {flatPages.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Henüz sayfa yok. "Sayfa Ekle" ile başlayın.
                </div>
              ) : (
                flatPages.map((page) => (
                  <div
                    key={page.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-0 border-b border-border last:border-0 items-center text-sm hover:bg-muted/30 transition-colors"
                  >
                    {/* Sayfa adı — girintili */}
                    <div
                      className="px-4 py-2 font-medium truncate"
                      style={{ paddingLeft: `${16 + page.depth * 20}px` }}
                    >
                      {page.depth > 0 && (
                        <span className="text-muted-foreground mr-1.5">↳</span>
                      )}
                      {page.title}
                    </div>

                    {/* Slug */}
                    <div className="px-4 py-2 text-muted-foreground truncate font-mono text-xs">
                      {page.slug}
                    </div>

                    {/* Tip */}
                    <div className="px-4 py-2 w-32 text-muted-foreground truncate">
                      {page.page_type}
                    </div>

                    {/* Öncelik */}
                    <div className={cn('px-4 py-2 w-20 text-xs font-medium', priorityClass(page.priority))}>
                      {page.priority}
                    </div>

                    {/* Sil butonu — form ile server action */}
                    <div className="px-4 py-2 w-16 text-right">
                      <form
                        action={async () => {
                          'use server'
                          await deletePage(id, page.id)
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          type="submit"
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        >
                          Sil
                        </Button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ─── Bölüm 2: Menüler ────────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Menüler</h2>

            <div className="space-y-8">
              {MENU_CONFIGS.map(({ type, title }) => (
                <MenuEditor
                  key={type}
                  projectId={id}
                  menuType={type}
                  menuTitle={title}
                  initialItems={menuMap[type] ?? []}
                />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
