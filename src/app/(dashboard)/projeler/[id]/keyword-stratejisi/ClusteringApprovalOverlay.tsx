'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApprovalClusterRow } from './ApprovalClusterRow'
import { ApprovalKeywordRow } from './ApprovalKeywordRow'
import { updateClusterStatus, removeKeywordFromCluster, type DraftCluster } from './actions'

// Overlay'in kendi iç state'i için genişletilmiş tip
interface ClusterState {
  id: string
  cluster_name: string
  intent: string | null
  status: string  // 'draft' | 'approved' | 'rejected'
  total_volume: number
  keywords: Array<{ id: string; keyword: string; volume: number | null }>
}

interface ClusteringApprovalOverlayProps {
  projectId: string
  initialClusters: DraftCluster[]
  onClose: () => void
}

export function ClusteringApprovalOverlay({
  projectId,
  initialClusters,
  onClose,
}: ClusteringApprovalOverlayProps) {
  const [clusters, setClusters] = useState<ClusterState[]>(
    initialClusters.map((c) => ({ ...c }))
  )
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    initialClusters[0]?.id ?? null
  )
  const [pendingClusterId, setPendingClusterId] = useState<string | null>(null)
  const [pendingKeywordId, setPendingKeywordId] = useState<string | null>(null)

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? null

  const approvedCount = clusters.filter((c) => c.status === 'approved').length
  const rejectedCount = clusters.filter((c) => c.status === 'rejected').length
  const draftCount = clusters.filter((c) => c.status === 'draft').length
  const totalKeywords = clusters.reduce((sum, c) => sum + c.keywords.length, 0)

  // Optimistic status güncelleme + server action
  const handleStatusChange = async (clusterId: string, newStatus: string) => {
    const prev = clusters
    // Optimistic güncelle
    setClusters((cs) => cs.map((c) => c.id === clusterId ? { ...c, status: newStatus } : c))
    setPendingClusterId(clusterId)

    const result = await updateClusterStatus(clusterId, newStatus, projectId)
    setPendingClusterId(null)

    if (!result.success) {
      // Rollback — hata durumunda önceki state'e dön
      setClusters(prev)
    }
  }

  // Tümünü Onayla / Reddet (D-09) — overlay açık kalır
  const handleBulkStatus = async (newStatus: 'approved' | 'rejected') => {
    const draftClusters = clusters.filter((c) => c.status === 'draft')
    for (const c of draftClusters) {
      await handleStatusChange(c.id, newStatus)
    }
  }

  // Cluster yeniden adlandır
  const handleRename = async (clusterId: string, newName: string) => {
    if (!newName.trim()) return
    // Not: updateClusterName server action Phase 20 scope dışı;
    // D-02 sadece UI'da inline edit ister. Şimdilik optimistic local güncelle.
    // (Persist için updateClusterName action'ı Wave 2+ sonrası eklenebilir)
    setClusters((cs) => cs.map((c) => c.id === clusterId ? { ...c, cluster_name: newName } : c))
  }

  // Keyword kaldır — optimistic UI (RESEARCH.md Pattern 3)
  const handleRemoveKeyword = async (clusterId: string, keywordId: string) => {
    const prevClusters = clusters
    setPendingKeywordId(keywordId)

    // Optimistic: keyword'ü listeden kaldır
    setClusters((cs) =>
      cs.map((c) =>
        c.id === clusterId
          ? { ...c, keywords: c.keywords.filter((k) => k.id !== keywordId) }
          : c
      )
    )

    const result = await removeKeywordFromCluster(keywordId, clusterId, projectId)
    setPendingKeywordId(null)

    if (!result.success) {
      // Rollback
      setClusters(prevClusters)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in-0 duration-150">

      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Kümeleme Önerilerini İncele</span>
          <span className="text-xs text-muted-foreground">
            {clusters.length} küme · {totalKeywords} keyword
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => handleBulkStatus('approved')}
          >
            Tümünü Onayla
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={() => handleBulkStatus('rejected')}
          >
            Tümünü Reddet
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Kapat"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* BODY — Sol + Sağ Panel */}
      <div className="flex flex-1 min-h-0">

        {/* SOL PANEL: Cluster listesi */}
        <div className="w-[360px] shrink-0 border-r border-border overflow-y-auto">
          {clusters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
              <p className="text-sm text-muted-foreground">
                Henüz küme önerilmedi. AI ile Kümelendirme butonuna bas.
              </p>
            </div>
          ) : (
            clusters.map((cluster) => (
              <ApprovalClusterRow
                key={cluster.id}
                cluster={{
                  id: cluster.id,
                  cluster_name: cluster.cluster_name,
                  intent: cluster.intent,
                  status: cluster.status,
                  keyword_count: cluster.keywords.length,
                  total_volume: cluster.total_volume,
                }}
                isSelected={selectedClusterId === cluster.id}
                isPending={pendingClusterId === cluster.id}
                onSelect={() => setSelectedClusterId(cluster.id)}
                onApprove={() => handleStatusChange(cluster.id, 'approved')}
                onReject={() => handleStatusChange(cluster.id, 'rejected')}
                onRename={(name) => handleRename(cluster.id, name)}
              />
            ))
          )}
        </div>

        {/* SAĞ PANEL: Seçili cluster'ın keyword'leri */}
        <div className="flex-1 overflow-y-auto">
          {!selectedCluster ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
              <p className="text-sm text-muted-foreground">
                Keyword&apos;leri görmek için soldan bir küme seçin.
              </p>
            </div>
          ) : (
            <>
              {/* Sağ panel başlık */}
              <div className="px-4 py-3 border-b border-border/50">
                <span className="text-sm font-semibold">{selectedCluster.cluster_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {selectedCluster.keywords.length} keyword
                </span>
              </div>

              {/* Keyword listesi */}
              {selectedCluster.keywords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-1 px-8 text-center">
                  <p className="text-sm text-muted-foreground">Bu kümede keyword yok.</p>
                  <p className="text-xs text-muted-foreground">
                    Tüm keyword&apos;ler kaldırıldı — kümeyi reddedin veya başka keyword&apos;ler ekleyin.
                  </p>
                </div>
              ) : (
                selectedCluster.keywords.map((kw) => (
                  <ApprovalKeywordRow
                    key={kw.id}
                    keyword={kw}
                    isPending={pendingKeywordId === kw.id}
                    onRemove={() => handleRemoveKeyword(selectedCluster.id, kw.id)}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0">
        <span className="text-xs text-muted-foreground">
          {approvedCount} onaylandı · {rejectedCount} reddedildi · {draftCount} beklemede
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-8 text-xs"
        >
          Kapat
        </Button>
      </div>

    </div>
  )
}
