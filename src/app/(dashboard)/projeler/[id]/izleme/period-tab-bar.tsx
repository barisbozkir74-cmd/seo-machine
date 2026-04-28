'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Period = 7 | 28 | 90

export function PeriodTabBar({
  projectId,
  active,
}: {
  projectId: string
  active: Period
}) {
  const router = useRouter()
  const periods: Period[] = [7, 28, 90]

  return (
    <div className="inline-flex items-center gap-1 bg-card border border-border rounded-lg p-1">
      {periods.map((p) => {
        const isActive = p === active
        return (
          <button
            key={p}
            type="button"
            onClick={() => router.push(`/projeler/${projectId}/izleme?period=${p}`)}
            className={cn(
              'px-4 py-2 rounded-md text-sm transition-colors min-h-[44px]',
              isActive
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p}G
          </button>
        )
      })}
    </div>
  )
}
