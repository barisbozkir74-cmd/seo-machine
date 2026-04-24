'use client'

import { cn } from '@/lib/utils'

const PACKAGE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Taslak',    className: 'bg-secondary text-muted-foreground' },
  approved: { label: 'Onaylandı', className: 'bg-blue-900/40 text-blue-400' },
  locked:   { label: 'Kilitli',   className: 'bg-amber-900/40 text-amber-400' },
}

export function PackageStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span
        className={cn(
          'inline-flex px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground opacity-60'
        )}
      >
        Paket Yok
      </span>
    )
  }

  const cfg = PACKAGE_STATUS_LABELS[status] ?? {
    label: status,
    className: 'bg-secondary text-muted-foreground',
  }

  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]', cfg.className)}>
      {cfg.label}
    </span>
  )
}
