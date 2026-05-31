'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { fetchApprovalHistoryPage, performApprovalAction } from './actions'
import type { ApprovalHistoryPage } from './actions'
import type { ApprovalRequest } from '@/core/approval/queue'

const STATUSES = ['all', 'pending', 'approved', 'rejected', 'expired'] as const
type Status = typeof STATUSES[number]

const STATUS_LABELS: Record<Status, string> = {
  all:      'Tümü',
  pending:  'Bekleyen',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  expired:  'Süresi Doldu',
}

const STATUS_BADGE: Record<ApprovalRequest['status'], string> = {
  pending:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  expired:  'bg-muted/40 text-muted-foreground border-border',
}

const STATUS_LABEL: Record<ApprovalRequest['status'], string> = {
  pending:  'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  expired:  'Süresi Doldu',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function ApprovalHistoryList({
  projectId,
  userId,
  isProjectOwner,
  initialPage,
  emptyNode,
}: {
  projectId:      string
  userId:         string
  isProjectOwner: boolean
  initialPage:    ApprovalHistoryPage
  emptyNode?:     React.ReactNode
}) {
  const [items, setItems]       = useState<ApprovalRequest[]>(initialPage.approvals)
  const [hasMore, setHasMore]   = useState(initialPage.has_more)
  const [cursor, setCursor]     = useState(initialPage.next_cursor)
  const [status, setStatus]     = useState<Status>('all')
  const [isPending, startTransition] = useTransition()

  // Per-item action state
  const [rejectingId, setRejectingId]   = useState<string | null>(null)
  const [rejectNote, setRejectNote]     = useState('')
  const [actioningId, setActioningId]   = useState<string | null>(null)
  const [actionError, setActionError]   = useState<{ id: string; message: string } | null>(null)

  const changeStatus = (newStatus: Status) => {
    if (newStatus === status) return
    setStatus(newStatus)
    setItems([])
    setHasMore(false)
    setCursor(undefined)
    setRejectingId(null)
    setRejectNote('')
    setActionError(null)
    startTransition(async () => {
      const page = await fetchApprovalHistoryPage(projectId, undefined, newStatus)
      setItems(page.approvals)
      setHasMore(page.has_more)
      setCursor(page.next_cursor)
    })
  }

  const loadMore = () => {
    startTransition(async () => {
      const page = await fetchApprovalHistoryPage(projectId, cursor, status)
      setItems(prev => [...prev, ...page.approvals])
      setHasMore(page.has_more)
      setCursor(page.next_cursor)
    })
  }

  const handleAction = async (
    item: ApprovalRequest,
    action: 'approve' | 'reject' | 'cancel',
    note?: string
  ) => {
    setActioningId(item.id)
    setActionError(null)
    const result = await performApprovalAction(item.id, projectId, action, note)
    setActioningId(null)

    if (!result.ok) {
      setActionError({ id: item.id, message: result.error })
      return
    }

    const newStatus: ApprovalRequest['status'] =
      action === 'approve' ? 'approved' :
      action === 'reject'  ? 'rejected' :
      'rejected' // cancel stores as rejected with resolution_notes

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i))
    if (rejectingId === item.id) {
      setRejectingId(null)
      setRejectNote('')
    }
  }

  const isApprover = (item: ApprovalRequest) =>
    item.blocks_manager_ids?.includes(userId) || isProjectOwner

  const isRequester = (item: ApprovalRequest) => item.user_id === userId

  return (
    <div>
      {/* Status filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            disabled={isPending}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
              status === s
                ? 'bg-secondary text-foreground border-border'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* List */}
      {items.length === 0 && !isPending && (
        emptyNode ?? <p className="text-sm text-muted-foreground py-8 text-center">Kayıt bulunamadı.</p>
      )}

      <ul className="space-y-2">
        {items.map(item => {
          const isActioning   = actioningId === item.id
          const isRejecting   = rejectingId === item.id
          const itemError     = actionError?.id === item.id ? actionError.message : null
          const canAct        = item.status === 'pending'
          const showApprover  = canAct && isApprover(item)
          const showRequester = canAct && isRequester(item)

          return (
            <li
              key={item.id}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.artifact_type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.created_at)}</p>
                  {item.resolution_notes && (
                    <p className="text-xs text-muted-foreground/70 mt-1 truncate">{item.resolution_notes}</p>
                  )}
                </div>
                <span className={cn(
                  'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  STATUS_BADGE[item.status]
                )}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>

              {/* Error */}
              {itemError && (
                <p className="mt-2 text-xs text-red-400">{itemError}</p>
              )}

              {/* Approver actions */}
              {showApprover && !isRejecting && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAction(item, 'approve')}
                    disabled={isActioning}
                    className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {isActioning ? 'İşleniyor…' : 'Onayla'}
                  </button>
                  <button
                    onClick={() => { setRejectingId(item.id); setRejectNote('') }}
                    disabled={isActioning}
                    className="px-3 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                  >
                    Reddet
                  </button>
                </div>
              )}

              {/* Inline reject note */}
              {showApprover && isRejecting && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="Red notu (opsiyonel)"
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-border"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(item, 'reject', rejectNote)}
                      disabled={isActioning}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      {isActioning ? 'İşleniyor…' : 'Reddi Onayla'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectNote('') }}
                      disabled={isActioning}
                      className="px-3 py-1 rounded-md text-xs text-muted-foreground border border-transparent hover:border-border transition-colors disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

              {/* Requester cancel action */}
              {showRequester && !showApprover && (
                <div className="mt-3">
                  <button
                    onClick={() => handleAction(item, 'cancel')}
                    disabled={isActioning}
                    className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    {isActioning ? 'İşleniyor…' : 'İptal Et'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {isPending && items.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-4 py-2 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {isPending ? 'Yükleniyor…' : 'Daha fazla yükle'}
          </button>
        </div>
      )}
    </div>
  )
}
