'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { fetchCompetitorData } from './actions'

type Props = {
  competitors: Array<{ id: string; domain: string }>
  projectId: string
}

export function FetchAllButton({ competitors, projectId }: Props) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const handleFetchAll = async () => {
    setIsRunning(true)
    setErrors([])
    const errs: string[] = []

    for (let i = 0; i < competitors.length; i++) {
      const comp = competitors[i]
      setProgress({ done: i, total: competitors.length, current: comp.domain })
      const result = await fetchCompetitorData(comp.id, projectId)
      if (!result.success) {
        errs.push(`${comp.domain}: ${result.error}`)
      }
    }

    setProgress({ done: competitors.length, total: competitors.length, current: '' })
    setErrors(errs)
    setIsRunning(false)
    // Sayfa verilerini yenile
    window.location.reload()
  }

  if (progress && isRunning) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{progress.current}</span>
          {' '}çekiliyor... ({progress.done}/{progress.total})
        </div>
        <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={handleFetchAll} disabled={isRunning}>
        Tümünü Çek
      </Button>
      {errors.length > 0 && (
        <div className="text-xs text-destructive max-w-xs text-right">
          {errors.length} domain hata verdi
        </div>
      )}
    </div>
  )
}
