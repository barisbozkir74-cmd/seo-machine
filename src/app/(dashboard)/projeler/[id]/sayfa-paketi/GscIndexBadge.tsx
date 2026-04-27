'use client'

import { cn } from '@/lib/utils'

const GSC_INDEX_STATUS_CONFIG = {
  indexed: {
    label: 'İndekslendi',
    className: 'bg-emerald-900/40 text-emerald-400',
  },
  not_indexed: {
    label: 'İndekslenmedi',
    className: 'bg-red-900/40 text-red-400',
  },
  crawled_not_indexed: {
    label: 'Tarandı/İndekslenmedi',
    className: 'bg-amber-900/40 text-amber-400',
  },
} as const

type GscIndexStatus = keyof typeof GSC_INDEX_STATUS_CONFIG

type Props = {
  status: string | null
}

export function GscIndexBadge({ status }: Props) {
  if (!status) return null
  const cfg = GSC_INDEX_STATUS_CONFIG[status as GscIndexStatus]
  if (!cfg) return null
  return (
    <span
      className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px]', cfg.className)}
      aria-live="polite"
    >
      {cfg.label}
    </span>
  )
}
