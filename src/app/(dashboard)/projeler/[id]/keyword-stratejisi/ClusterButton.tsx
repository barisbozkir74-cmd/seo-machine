'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { clusterAndScoreKeywords, type DraftCluster } from './actions'

export function ClusterButton({
  projectId,
  hasExistingClusters,
  onSuccess,
}: {
  projectId: string
  hasExistingClusters: boolean
  onSuccess?: (draftClusters: DraftCluster[]) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleCluster = () => {
    setError(null)
    startTransition(async () => {
      const result = await clusterAndScoreKeywords(projectId)
      if (!result.success) {
        setError(result.error)
      } else if (onSuccess && result.clusters) {
        onSuccess(result.clusters)  // D-08: overlay'i aç
      }
      // revalidatePath artık action içinde yok; overlay kapanışında approveStrategy tetikler
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleCluster}
        disabled={isPending}
        className={`h-9 ${isPending ? 'opacity-50' : ''}`}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AI Kümeleniyor...
          </span>
        ) : hasExistingClusters ? (
          'Yeniden Kümeleme'
        ) : (
          'AI ile Kümelendirme'
        )}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
