'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { deleteCluster } from './actions'

export function ClusterDeleteButton({
  projectId,
  clusterId,
  clusterName,
}: {
  projectId: string
  clusterId: string
  clusterName: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      title={`"${clusterName}" kümesini sil`}
      disabled={isPending}
      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      onClick={() => {
        startTransition(async () => {
          await deleteCluster(projectId, clusterId)
        })
      }}
    >
      {isPending ? (
        <svg
          className="animate-spin h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        '×'
      )}
    </Button>
  )
}
