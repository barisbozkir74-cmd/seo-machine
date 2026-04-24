'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ViewToggle({ currentView }: { currentView: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const setView = (view: string) => {
    router.push(`${pathname}?view=${view}`)
  }

  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView('flat')}
        className={`rounded-none h-8 px-3 text-xs ${
          currentView !== 'cluster'
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Düz Liste
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView('cluster')}
        className={`rounded-none h-8 px-3 text-xs border-l border-border ${
          currentView === 'cluster'
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Küme Görünümü
      </Button>
    </div>
  )
}
