'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setPrimaryKeyword } from './actions'

export function PrimaryKeywordStar({
  clusterId,
  keywordId,
  projectId,
  isPrimary,
}: {
  clusterId: string
  keywordId: string
  projectId: string
  isPrimary: boolean
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      title={isPrimary ? 'Primary keyword (en yüksek hacim)' : 'Primary yap'}
      disabled={isPending || isPrimary}
      className={`h-7 w-7 p-0 transition-opacity shrink-0 ${
        isPrimary
          ? 'text-primary'
          : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary'
      } ${isPending ? 'opacity-50' : ''}`}
      onClick={() => {
        if (isPrimary) return
        startTransition(async () => {
          await setPrimaryKeyword(clusterId, keywordId, projectId)
        })
      }}
    >
      {isPending ? (
        <svg
          className="animate-spin h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span className="text-base leading-none">{isPrimary ? '★' : '☆'}</span>
      )}
    </Button>
  )
}
