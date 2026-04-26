'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ContentStudioHeaderProps = {
  projectId: string
  pageTitle: string
  totalSections: number
  approvedCount: number
  isGenerating: boolean
  generatingCount: number
  onGenerateAll: () => void
}

export function ContentStudioHeader({
  projectId,
  pageTitle,
  totalSections,
  approvedCount,
  isGenerating,
  generatingCount,
  onGenerateAll,
}: ContentStudioHeaderProps) {
  const allApproved = approvedCount === totalSections && totalSections > 0
  const badgeClass = allApproved
    ? 'bg-emerald-500/20 text-emerald-400'
    : 'bg-slate-800 text-slate-400'
  const progressLabel = allApproved
    ? 'Tüm bölümler onaylandı'
    : `${approvedCount}/${totalSections} bölüm onaylandı`

  return (
    <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href={`/projeler/${projectId}/sayfa-paketi`}>
          <Button variant="ghost" size="sm">← Geri</Button>
        </Link>
        <h1 className="text-lg font-semibold">{pageTitle} — İçerik Stüdyosu</h1>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={cn(badgeClass, 'border-0')} aria-live="polite">
          {progressLabel}
        </Badge>
        <Button
          disabled={isGenerating}
          onClick={onGenerateAll}
          size="sm"
          variant={allApproved ? 'secondary' : 'default'}
        >
          {isGenerating
            ? `Üretiliyor... (${generatingCount}/${totalSections})`
            : allApproved
            ? 'Yeniden Tümünü Üret'
            : 'Tümünü Üret'}
        </Button>
      </div>
    </div>
  )
}
