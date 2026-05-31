'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { fetchAuditPage } from './actions'
import type { AuditPage } from './actions'
import type { AuditEntry } from '@/core/audit/trail'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function actorLabel(entry: AuditEntry) {
  if (entry.actor_type === 'system') return 'Sistem'
  return entry.actor_id ? `Kullanıcı` : '—'
}

export function AuditTrailList({
  projectId,
  initialPage,
  emptyNode,
}: {
  projectId: string
  initialPage: AuditPage
  emptyNode?: React.ReactNode
}) {
  const [items, setItems]     = useState<AuditEntry[]>(initialPage.entries)
  const [hasMore, setHasMore] = useState(initialPage.has_more)
  const [cursor, setCursor]   = useState(initialPage.next_cursor)
  const [isPending, startTransition] = useTransition()

  const loadMore = () => {
    startTransition(async () => {
      const page = await fetchAuditPage(projectId, cursor)
      setItems(prev => [...prev, ...page.entries])
      setHasMore(page.has_more)
      setCursor(page.next_cursor)
    })
  }

  return (
    <div>
      {items.length === 0 && !isPending && (
        emptyNode ?? <p className="text-sm text-muted-foreground py-8 text-center">Audit kaydı bulunamadı.</p>
      )}

      <ul className="space-y-2">
        {items.map(entry => (
          <li
            key={entry.id}
            className="rounded-lg border border-border bg-card px-4 py-3 flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.action_type}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {actorLabel(entry)} · {entry.resource_type}
                {entry.resource_id ? ` / ${entry.resource_id}` : ''}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{formatDate(entry.created_at)}</p>
            </div>
            <span className={cn(
              'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
              entry.success === false
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            )}>
              {entry.success === false ? 'Başarısız' : 'Başarılı'}
            </span>
          </li>
        ))}
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
