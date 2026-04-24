'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { suggestInternalLinks, type InternalLinkSuggestion } from './actions'
import { SuggestLinksDialog } from './SuggestLinksDialog'

type Props = {
  projectId: string
  disabled?: boolean
}

export function SuggestLinksButton({ projectId, disabled }: Props) {
  const [isPending, startTransition] = useTransition()
  const [suggestions, setSuggestions] = useState<InternalLinkSuggestion[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [noResults, setNoResults] = useState(false)

  function handleClick() {
    setNoResults(false)
    startTransition(async () => {
      const result = await suggestInternalLinks(projectId)
      if (!result.success) return

      if (result.suggestions.length === 0) {
        setNoResults(true)
        return
      }

      setSuggestions(result.suggestions)
      setDialogOpen(true)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span title={disabled ? 'Önce sayfa oluşturun' : undefined}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={disabled || isPending}
          className={isPending ? 'opacity-50 cursor-wait' : ''}
        >
          {isPending ? 'Yükleniyor…' : 'Link Öner'}
        </Button>
      </span>
      {noResults && !isPending && (
        <span className="text-sm text-muted-foreground">Önerilecek yeni link bulunamadı.</span>
      )}
      {suggestions && (
        <SuggestLinksDialog
          projectId={projectId}
          suggestions={suggestions}
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setSuggestions(null)
          }}
        />
      )}
    </div>
  )
}
