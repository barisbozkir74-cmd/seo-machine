import Link from 'next/link'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  built: boolean
}

function getNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Proje Bilgileri',   href: `/projeler/${projectId}`,                        built: true  },
    { label: 'Araştırma',         href: `/projeler/${projectId}/arastirma`,               built: true  },
    { label: 'Keyword Stratejisi',href: `/projeler/${projectId}/keyword-stratejisi`,       built: true  },
    { label: 'Site Blueprint',    href: `/projeler/${projectId}/site-blueprint`,           built: true  },
    { label: 'Sayfa Listesi',     href: `/projeler/${projectId}/sayfalar`,                 built: true  },
    { label: 'İç Link Haritası',  href: `/projeler/${projectId}/ic-link-haritasi`,         built: true  },
    { label: 'Sayfa Paketi',      href: `/projeler/${projectId}/sayfa-paketi`,             built: true  },
    { label: 'SEO Denetimi',      href: `/projeler/${projectId}/seo-denetimi`,             built: true  },
    { label: 'Rakipler',          href: `/projeler/${projectId}/rakipler`,                 built: true  },
    { label: 'Proje Kuralları',   href: `/projeler/${projectId}/kurallar`,                 built: true  },
    { label: 'İzleme',            href: `/projeler/${projectId}/izleme`,                   built: true  },
    { label: 'Site Analizi',      href: `/projeler/${projectId}/site-analizi`,              built: true  },
  ]
}

export function ProjectNav({
  projectId,
  activePath,
}: {
  projectId: string
  activePath: string
}) {
  const items = getNavItems(projectId)

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const isActive = activePath === item.href

        if (!item.built) {
          return (
            <li key={item.href}>
              <span
                className="flex items-center px-3 py-2 rounded-md text-sm text-muted-foreground/40 cursor-not-allowed select-none"
              >
                {item.label}
              </span>
            </li>
          )
        }

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
