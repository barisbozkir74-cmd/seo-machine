'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { IntentBadge } from './IntentBadge'
import { moveKeywordToCluster } from './actions'

type ClusterOption = {
  id: string
  cluster_name: string
  intent: string | null
  keyword_count: number
}

export function MoveKeywordDialog({
  keywordId,
  keywordText,
  currentClusterId,
  projectId,
  allClusters,
}: {
  keywordId: string
  keywordText: string
  currentClusterId: string | null
  projectId: string
  allClusters: ClusterOption[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherClusters = allClusters.filter((c) => c.id !== currentClusterId)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedClusterId(null)
      setError(null)
    }
    setOpen(nextOpen)
  }

  const handleMove = async () => {
    if (!selectedClusterId) return
    setIsPending(true)
    setError(null)
    try {
      const result = await moveKeywordToCluster(keywordId, selectedClusterId, projectId)
      if (!result.success) {
        setError(result.error)
      } else {
        setOpen(false)
      }
    } catch {
      setError('Küme ataması başarısız. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground">
            Taşı →
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            &ldquo;{keywordText}&rdquo; kümesini değiştir
          </DialogTitle>
        </DialogHeader>

        {otherClusters.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Başka küme yok. Önce &ldquo;Kümelere Böl&rdquo; ile yeni kümeler oluşturun.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-md p-2">
            {otherClusters.map((cluster) => (
              <button
                key={cluster.id}
                onClick={() => setSelectedClusterId(cluster.id)}
                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left hover:bg-secondary/50 transition-colors ${
                  selectedClusterId === cluster.id ? 'bg-secondary' : ''
                }`}
              >
                <span className="text-sm flex-1 font-normal">{cluster.cluster_name}</span>
                <IntentBadge intent={cluster.intent} />
                <span className="text-xs text-muted-foreground shrink-0">
                  {cluster.keyword_count}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            İptal
          </Button>
          <Button
            size="sm"
            onClick={handleMove}
            disabled={isPending || !selectedClusterId || otherClusters.length === 0}
            className={isPending ? 'opacity-50 cursor-wait' : ''}
          >
            {isPending ? 'Taşınıyor...' : 'Taşı'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
