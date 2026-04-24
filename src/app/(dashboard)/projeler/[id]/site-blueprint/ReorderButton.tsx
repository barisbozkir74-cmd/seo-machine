'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { reorderPage } from './actions'

type Props = {
  pageId: string
  projectId: string
  direction: 'up' | 'down'
  disabled?: boolean
}

export function ReorderButton({ pageId, projectId, direction, disabled = false }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await reorderPage(pageId, direction, projectId)
      // hata olursa UI reload ile eski state'e dönecek; toast yok, MVP
    })
  }

  const label = direction === 'up' ? '↑' : '↓'
  const aria = direction === 'up' ? 'Yukarı taşı' : 'Aşağı taşı'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={disabled || isPending}
      aria-label={aria}
      className={`h-7 w-7 p-0 text-muted-foreground hover:text-foreground ${
        disabled ? 'opacity-30' : ''
      } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
    >
      {label}
    </Button>
  )
}
