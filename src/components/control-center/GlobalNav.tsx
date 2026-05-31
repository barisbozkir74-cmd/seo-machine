'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useProjectGates, type ProjectGates } from './ProjectGatesContext'
import { ModuleNavItem } from './ModuleNavItem'

// ─── Types ────────────────────────────────────────────────────────────────────
type NavItemDef = {
  id:          string
  label:       string
  href:        string
  dimmed?:     boolean
  locked?:     boolean
  lockReason?: string
  ctaLabel?:   string
  ctaHref?:    string
}

type NavGroup = {
  id:    string
  label: string
  items: NavItemDef[]
}

// ─── Active check ─────────────────────────────────────────────────────────────
function isItemActive(href: string, pathname: string, projectId: string | null): boolean {
  if (!href || href === '/control-center/projects' && !pathname.match(/^\/control-center\/projects\/?$/)) {
    // "Projeler" is active only on the exact list page, not on project sub-pages
    return pathname === '/control-center/projects'
  }
  if (href === '/control-center/projects') return pathname === href
  if (projectId && href === `/control-center/projects/${projectId}`) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

// ─── Group label ─────────────────────────────────────────────────────────────
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 select-none">
      {children}
    </p>
  )
}

// ─── Menu builder ─────────────────────────────────────────────────────────────
function buildMenuGroups(projectId: string | null, gates: ProjectGates | null): NavGroup[] {
  const noProject = !projectId
  // When no project, dimmed items navigate to the projects list
  const base      = projectId ? `/control-center/projects/${projectId}` : '/control-center/projects'

  const p = (path: string): string => (noProject ? '/control-center/projects' : `${base}${path}`)

  return [
    {
      id: 'genel', label: 'Genel',
      items: [
        { id: 'overview', label: 'Genel Bakış', href: '/control-center/overview' },
        { id: 'projects', label: 'Projeler',    href: '/control-center/projects' },
      ],
    },
    {
      id: 'proje', label: 'Proje',
      items: [
        { id: 'info',         label: 'Proje Bilgileri',     href: p('/settings/info'),        dimmed: noProject },
        { id: 'business',     label: 'Ürünler / Hizmetler', href: p('/settings/business'),    dimmed: noProject },
        { id: 'integrations', label: 'Entegrasyonlar',      href: p('/settings/integrations'), dimmed: noProject },
        { id: 'hub',          label: 'Proje Merkezi',       href: noProject ? '/control-center/projects' : `${base}/hub`, dimmed: noProject },
      ],
    },
    {
      id: 'kesif', label: 'Keşif',
      items: [
        { id: 'research',    label: 'Araştırma',    href: p('/intelligence/research'),    dimmed: noProject },
        { id: 'competitors', label: 'Rakipler',     href: p('/intelligence/competitors'), dimmed: noProject },
        { id: 'decisions',   label: 'Kararlar',     href: p('/intelligence/decisions'),   dimmed: noProject },
      ],
    },
    {
      id: 'strateji', label: 'Strateji',
      items: [
        { id: 'keywords',   label: 'Keyword Stratejisi', href: p('/intelligence/keywords'),   dimmed: noProject },
        { id: 'structure',  label: 'Site Mimarisi',      href: p('/architecture/structure'),  dimmed: noProject },
        { id: 'blueprint',  label: 'Site Blueprint',     href: p('/architecture/blueprint'),  dimmed: noProject },
        { id: 'link-graph', label: 'İç Link Haritası',   href: p('/architecture/link-graph'), dimmed: noProject },
      ],
    },
    {
      id: 'uretim', label: 'Üretim',
      items: [
        { id: 'pages',           label: 'Sayfalar',          href: p('/architecture/pages'),  dimmed: noProject },
        { id: 'lifecycle',       label: 'Content Lifecycle',  href: p('/content/lifecycle'),   dimmed: noProject },
        { id: 'studio',          label: 'İçerik Stüdyosu',   href: p('/content/studio'),      dimmed: noProject },
        { id: 'publish-queue',   label: 'Publish Queue',      href: p('/publish/queue'),       dimmed: noProject },
        { id: 'publish-history', label: 'Publish History',    href: p('/publish/history'),     dimmed: noProject },
      ],
    },
    {
      id: 'yonetim', label: 'Yönetim',
      items: [
        { id: 'monitoring', label: 'İzleme',         href: p('/monitoring/overview'), dimmed: noProject },
        { id: 'audit',      label: 'Technical Audit', href: p('/monitoring/audit'),    dimmed: noProject },
        { id: 'rules',      label: 'Kurallar',        href: p('/settings/rules'),      dimmed: noProject },
      ],
    },
  ]
}

// ─── Root nav ─────────────────────────────────────────────────────────────────
export function GlobalNav() {
  const pathname  = usePathname()
  const gatesCtx  = useProjectGates()
  const urlProjectId = pathname.match(/\/control-center\/projects\/([^/]+)/)?.[1] ?? null
  const projectId = gatesCtx?.projectId ?? urlProjectId
  const gates     = gatesCtx?.gates     ?? null

  const groups = buildMenuGroups(projectId, gates)

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable main nav */}
      <nav
        aria-label="Ana navigasyon"
        className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-4"
      >
        {groups.map((group) => (
          <div key={group.id}>
            <GroupLabel>{group.label}</GroupLabel>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <ModuleNavItem
                  key={item.id}
                  label={item.label}
                  href={item.href}
                  active={!item.dimmed && !item.locked && isItemActive(item.href, pathname, projectId)}
                  dimmed={item.dimmed ?? false}
                  locked={item.locked ?? false}
                  lockReason={item.lockReason}
                  ctaLabel={item.ctaLabel}
                  ctaHref={item.ctaHref}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pinned footer — global settings */}
      <div className="flex-shrink-0 border-t border-border/30 px-2 pt-3 pb-1">
        <Link
          href="/settings/rules"
          aria-current={pathname === '/settings/rules' ? 'page' : undefined}
          className={cn(
            'flex items-center rounded-md px-3 py-2 text-xs transition-colors truncate',
            pathname === '/settings/rules'
              ? 'bg-secondary text-foreground font-medium'
              : 'text-muted-foreground/60 hover:bg-secondary/50 hover:text-muted-foreground',
          )}
        >
          Global Kurallar
        </Link>
      </div>
    </div>
  )
}
