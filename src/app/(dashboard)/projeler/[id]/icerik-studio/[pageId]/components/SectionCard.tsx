'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { approveSection, rejectSection } from '@/app/(dashboard)/projeler/[id]/sayfa-paketi/actions'
import type { ContentSection } from '@/app/(dashboard)/projeler/[id]/sayfa-paketi/actions'
import { StreamingText } from './StreamingText'

const statusBorderMap: Record<ContentSection['status'], string> = {
  pending:    'border-l-4 border-slate-700',
  generating: 'border-l-4 border-blue-500',
  draft:      'border-l-4 border-slate-500',
  approved:   'border-l-4 border-emerald-400',
  rejected:   'border-l-4 border-red-500',
}

const statusBadgeMap: Record<ContentSection['status'], string> = {
  pending:    'bg-slate-800 text-slate-400',
  generating: 'bg-blue-500/20 text-blue-400',
  draft:      'bg-slate-800 text-slate-400',
  approved:   'bg-emerald-500/20 text-emerald-400',
  rejected:   'bg-red-500/20 text-red-400',
}

const statusLabelMap: Record<ContentSection['status'], string> = {
  pending:    'Bekliyor',
  generating: 'Üretiliyor',
  draft:      'Taslak',
  approved:   'Onaylandı',
  rejected:   'Reddedildi',
}

type SectionCardProps = {
  projectId: string
  pageId: string
  sectionIndex: number
  section: ContentSection
  streamingContent?: string
  onRegenerate: (index: number) => void
}

export function SectionCard({
  projectId,
  pageId,
  sectionIndex,
  section,
  streamingContent,
  onRegenerate,
}: SectionCardProps) {
  const [localContent, setLocalContent] = useState(section.content)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isStreaming = section.status === 'generating'
  const isApproved = section.status === 'approved'

  function handleApprove() {
    startTransition(async () => {
      const result = await approveSection(projectId, pageId, sectionIndex, localContent)
      if (result.success) router.refresh()
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectSection(projectId, pageId, sectionIndex)
      if (result.success) router.refresh()
    })
  }

  return (
    <article
      className={cn('rounded-lg bg-card p-4 space-y-3', statusBorderMap[section.status])}
      aria-label={`${section.heading} bölümü`}
      aria-busy={isStreaming}
    >
      {/* Başlık satırı */}
      <div className="flex items-center gap-2">
        <Badge className={cn(statusBadgeMap[section.status], 'text-xs border-0')}>
          {statusLabelMap[section.status]}
        </Badge>
        <span className="text-base font-semibold">{section.heading}</span>
      </div>

      <Separator />

      {/* İçerik alanı */}
      <div className="min-h-[120px]">
        {isStreaming ? (
          <StreamingText text={streamingContent ?? ''} isStreaming={true} />
        ) : section.status === 'pending' ? (
          <p className="text-sm text-muted-foreground">Bu bölüm henüz üretilmedi.</p>
        ) : isApproved ? (
          <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-3">
            {localContent}
          </div>
        ) : (
          <Textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            className="text-sm resize-y min-h-[120px]"
            placeholder="İçerik burada görünecek..."
            disabled={isPending}
          />
        )}
      </div>

      {/* Aksiyon satırı */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRegenerate(sectionIndex)}
          disabled={isPending || isStreaming}
          aria-label={`'${section.heading}' bölümünü yeniden üret`}
        >
          Yeniden Üret
        </Button>

        {!isApproved && !isStreaming && section.status !== 'pending' && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={isPending}
              aria-label={`'${section.heading}' bölümünü reddet`}
              className="min-h-[44px]"
            >
              Reddet
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isPending}
              aria-label={`'${section.heading}' bölümünü onayla`}
              className="min-h-[44px]"
            >
              Onayla
            </Button>
          </div>
        )}

        {isApproved && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRegenerate(sectionIndex)}
            disabled={isPending}
          >
            Yeniden Üret
          </Button>
        )}
      </div>
    </article>
  )
}
