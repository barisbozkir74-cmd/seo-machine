'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RecoveryTaskRow, RecoveryTaskStatus } from '@/lib/monitoring/recovery-tasks'
import { updateRecoveryTaskStatus } from './actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// "+5.3" / "-2.1" / "—" — positive number = position WORSENED (rank dropped further)
function formatPositionLoss(before: number | null, after: number | null): string {
  if (before === null || after === null) return '—'
  const delta = after - before
  if (delta > 0) return `+${delta.toFixed(1)}`
  return delta.toFixed(1)
}

// Same coloring rule as page-metrics-table.tsx delta column
function deltaColorClass(before: number | null, after: number | null): string {
  if (before === null || after === null) return 'text-muted-foreground'
  const delta = after - before
  if (delta > 0) return 'text-red-400'
  if (delta < 0) return 'text-emerald-400'
  return 'text-muted-foreground'
}

// UI-SPEC §Badge Color Contract — exact classNames per status
const STATUS_BADGE_CLASS: Record<RecoveryTaskStatus, string> = {
  open: 'bg-red-500/15 text-red-400 border border-red-500/30',
  in_progress: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  dismissed: 'bg-slate-700 text-slate-400',
  resolved: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
}

const STATUS_LABEL: Record<RecoveryTaskStatus, string> = {
  open: 'Açık',
  in_progress: 'Devam Ediyor',
  dismissed: 'Görmezden Gelindi',
  resolved: 'Çözüldü',
}

function StatusBadge({ status }: { status: RecoveryTaskStatus }) {
  return (
    <Badge
      className={cn(
        'text-xs rounded-full px-2 py-0.5',
        STATUS_BADGE_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RecoveryTaskTable({
  tasks,
  projectId,
}: {
  tasks: RecoveryTaskRow[]
  projectId: string
}) {
  const router = useRouter()
  const [showDismissed, setShowDismissed] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Visible rows: by default hide dismissed (D-13). Show toggle reveals them.
  const visibleTasks = showDismissed
    ? tasks
    : tasks.filter((t) => t.status !== 'dismissed')

  // Empty state if there are no active (open + in_progress) rows
  // Matches UI-SPEC §Empty State — only checked against active rows, not full list
  const activeCount = tasks.filter(
    (t) => t.status === 'open' || t.status === 'in_progress',
  ).length

  if (activeCount === 0 && !showDismissed) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-base font-semibold">
            Tespit edilen pozisyon düşüşü yok
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Sayfalar sağlıklı görünüyor.
          </p>
        </div>
        {tasks.some((t) => t.status === 'dismissed') && (
          <button
            type="button"
            onClick={() => setShowDismissed(true)}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Dismissed görevleri göster
          </button>
        )}
      </div>
    )
  }

  function targetRoute(task: RecoveryTaskRow): string {
    // D-11, D-12: page_package → /sayfalar (page list); imported_page → /site-analizi
    return task.source === 'page_package'
      ? `/projeler/${projectId}/sayfalar`
      : `/projeler/${projectId}/site-analizi`
  }

  function handleUpdate(task: RecoveryTaskRow) {
    setPendingId(task.id)
    startTransition(async () => {
      const result = await updateRecoveryTaskStatus(
        task.id,
        projectId,
        'in_progress',
      )
      setPendingId(null)
      if (!result.success) {
        // UI-SPEC §Copywriting "Error state" — generic recoverable error
        alert(result.error || 'Recovery görevleri yüklenemedi — sayfayı yenileyin.')
        return
      }
      router.push(targetRoute(task))
    })
  }

  function handleDismiss(task: RecoveryTaskRow) {
    setPendingId(task.id)
    startTransition(async () => {
      const result = await updateRecoveryTaskStatus(
        task.id,
        projectId,
        'dismissed',
      )
      setPendingId(null)
      if (!result.success) {
        alert(result.error || 'Recovery görevleri yüklenemedi — sayfayı yenileyin.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-normal uppercase text-muted-foreground">
              Sayfa
            </TableHead>
            <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right w-28">
              Pozisyon Kaybı
            </TableHead>
            <TableHead className="text-xs font-normal uppercase text-muted-foreground w-32">
              Durum
            </TableHead>
            <TableHead className="text-xs font-normal uppercase text-muted-foreground text-right w-40">
              Aksiyon
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleTasks.map((task) => {
            const canAct =
              task.status === 'open' || task.status === 'in_progress'
            const isPending = pendingId === task.id
            return (
              <TableRow key={task.id} className="hover:bg-muted/50 transition-colors">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground">{task.title}</span>
                    <span
                      className="text-xs text-muted-foreground truncate max-w-[360px]"
                      title={task.pageUrl}
                    >
                      {task.pageUrl}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right text-sm tabular-nums',
                    deltaColorClass(task.positionBefore, task.positionAfter),
                  )}
                >
                  {formatPositionLoss(task.positionBefore, task.positionAfter)}{' '}
                  pozisyon
                </TableCell>
                <TableCell>
                  <StatusBadge status={task.status} />
                </TableCell>
                <TableCell className="text-right">
                  {canAct ? (
                    <div className="inline-flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleUpdate(task)}
                      >
                        Güncelle
                      </Button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDismiss(task)}
                        className="text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        Görmezden Gel
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {tasks.some((t) => t.status === 'dismissed') && (
        <button
          type="button"
          onClick={() => setShowDismissed((v) => !v)}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {showDismissed
            ? 'Dismissed görevleri gizle'
            : 'Dismissed görevleri göster'}
        </button>
      )}
    </div>
  )
}
