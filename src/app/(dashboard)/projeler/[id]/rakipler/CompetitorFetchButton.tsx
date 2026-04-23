'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { fetchCompetitorData } from './actions'

type Props = {
  competitorId: string
  projectId: string
  lastFetched: string | null  // updated_at — son çekim tarihi
}

export function CompetitorFetchButton({ competitorId, projectId, lastFetched }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = async () => {
    setIsPending(true)
    setError(null)
    try {
      const result = await fetchCompetitorData(competitorId, projectId)
      if (!result.success) {
        setError(result.error)
      }
    } catch {
      setError('Veri çekme başarısız. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleFetch}
        disabled={isPending}
        className={isPending ? 'opacity-50 cursor-wait' : ''}
      >
        {isPending ? 'Çekiliyor...' : 'Veri Çek'}
      </Button>
      {lastFetched && !isPending && (
        <span className="text-xs text-muted-foreground">
          {new Date(lastFetched).toLocaleDateString('tr-TR')}
        </span>
      )}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  )
}
