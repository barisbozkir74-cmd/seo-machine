'use client'

import { Badge } from '@/components/ui/badge'

export function StatusBadge({ status }: { status: string | null }) {
  if (status === 'approved') {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 text-xs border-0 px-2 py-0.5">
        Onaylandı
      </Badge>
    )
  }
  if (status === 'rejected') {
    return (
      <Badge className="bg-red-500/20 text-red-400 text-xs border-0 px-2 py-0.5">
        Reddedildi
      </Badge>
    )
  }
  // 'draft' veya null
  return (
    <Badge className="bg-secondary text-muted-foreground text-xs border-0 px-2 py-0.5">
      Beklemede
    </Badge>
  )
}
