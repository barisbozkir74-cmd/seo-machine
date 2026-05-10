'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ClusterButton } from './ClusterButton'
import { ClusteringApprovalOverlay } from './ClusteringApprovalOverlay'
import { StratejiOnaylaButton } from './StratejiOnaylaButton'
import { type DraftCluster } from './actions'
import { GeneratePagesDialog, type DialogRow } from '../site-blueprint/GeneratePagesDialog'

interface KeywordStratejisiToolbarProps {
  projectId: string
  hasExistingClusters: boolean
  hasApprovedCluster: boolean
  isStrategyApproved: boolean
  approvedDialogRows: DialogRow[]   // D-02: SSR computed, approved clusters only
}

export function KeywordStratejisiToolbar({
  projectId,
  hasExistingClusters,
  hasApprovedCluster,
  isStrategyApproved,
  approvedDialogRows,
}: KeywordStratejisiToolbarProps) {
  const router = useRouter()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [draftClusters, setDraftClusters] = useState<DraftCluster[]>([])
  const [sistemiKurOpen, setSistemiKurOpen] = useState(false)

  const handleClusteringDone = (newClusters: DraftCluster[]) => {
    setDraftClusters(newClusters)
    setOverlayOpen(true)
  }

  const handleOverlayClose = () => {
    setOverlayOpen(false)
    // Overlay kapandığında SSR'ı yenile — status değişiklikleri ClusterPanel'e yansısın
    router.refresh()
  }

  return (
    <>
      <ClusterButton
        projectId={projectId}
        hasExistingClusters={hasExistingClusters}
        onSuccess={handleClusteringDone}
      />
      <StratejiOnaylaButton
        projectId={projectId}
        isApproved={isStrategyApproved}
        hasApprovedCluster={hasApprovedCluster}
      />
      {isStrategyApproved ? (
        <Button
          variant="default"
          className="h-9 text-xs"
          onClick={() => setSistemiKurOpen(true)}
        >
          Sistemi Kur
        </Button>
      ) : (
        <Button
          variant="ghost"
          disabled
          className="h-9 text-xs opacity-40 cursor-not-allowed"
          title="Önce stratejiyi onaylayın"
        >
          Sistemi Kur
        </Button>
      )}
      <GeneratePagesDialog
        projectId={projectId}
        rows={approvedDialogRows}
        open={sistemiKurOpen}
        onOpenChange={setSistemiKurOpen}
      />
      {overlayOpen && (
        <ClusteringApprovalOverlay
          projectId={projectId}
          initialClusters={draftClusters}
          onClose={handleOverlayClose}
        />
      )}
    </>
  )
}
