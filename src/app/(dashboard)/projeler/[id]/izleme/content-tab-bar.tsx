'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export type ContentTab = 'clusters' | 'pages' | 'recovery'

export function ContentTabBar({
  projectId,
  active,
  period,
}: {
  projectId: string
  active: ContentTab
  period: 7 | 28 | 90
}) {
  const router = useRouter()

  // Order matches UI-SPEC §Layout Structure: clusters → pages → recovery
  const tabs: { id: ContentTab; label: string }[] = [
    { id: 'clusters', label: 'Cluster Performansı' },
    { id: 'pages', label: 'Sayfa Performansı' },
    { id: 'recovery', label: 'Recovery' },
  ]

  return (
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-lg p-1">
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              // period is threaded so switching tab preserves the active period (UI-SPEC §URL State Machine)
              router.push(
                `/projeler/${projectId}/izleme?period=${period}&tab=${t.id}`,
              )
            }
            className={cn(
              'px-4 py-2 rounded-md text-sm transition-colors min-h-[44px]',
              isActive
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
