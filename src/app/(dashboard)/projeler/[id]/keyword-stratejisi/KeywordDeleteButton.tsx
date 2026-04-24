'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { deleteKeyword } from './actions'

export function KeywordDeleteButton({
  projectId,
  keywordId,
}: {
  projectId: string
  keywordId: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      title="Keyword'ü sil"
      disabled={isPending}
      // UI-SPEC: opacity-0 group-hover:opacity-100, destructive hover (D-12)
      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      onClick={() => {
        // D-12: onay dialogu YOK — anında sil
        startTransition(async () => {
          await deleteKeyword(keywordId, projectId)
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
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        '×'
      )}
    </Button>
  )
}
