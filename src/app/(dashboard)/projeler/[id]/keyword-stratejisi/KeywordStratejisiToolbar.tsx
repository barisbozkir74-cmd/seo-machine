'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClusterButton } from './ClusterButton'
import { ClusteringApprovalOverlay } from './ClusteringApprovalOverlay'
import { StratejiOnaylaButton } from './StratejiOnaylaButton'
import { type DraftCluster } from './actions'

interface KeywordStratejisiToolbarProps {
  projectId: string
  hasExistingClusters: boolean
  hasApprovedCluster: boolean
  isStrategyApproved: boolean
}

export function KeywordStratejisiToolbar({
  projectId,
  hasExistingClusters,
  hasApprovedCluster,
  isStrategyApproved,
}: KeywordStratejisiToolbarProps) {
  const router = useRouter()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [draftClusters, setDraftClusters] = useState<DraftCluster[]>([])

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
