'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GeneratePagesDialog, type DialogRow } from './GeneratePagesDialog'

type Props = {
  projectId: string
  rows: DialogRow[]
  hasEnrichedClusters: boolean
}

export function GenerateFromClustersButton({ projectId, rows, hasEnrichedClusters }: Props) {
  const [open, setOpen] = useState(false)

  if (!hasEnrichedClusters) {
    return (
      <span title="Önce keyword kümeleme yapın" className="inline-flex">
        <Button variant="outline" size="sm" disabled>
          Kümelerden Oluştur
        </Button>
      </span>
    )
  }

  return (
    <GeneratePagesDialog
      projectId={projectId}
      rows={rows}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Kümelerden Oluştur
        </Button>
      }
    />
  )
}
