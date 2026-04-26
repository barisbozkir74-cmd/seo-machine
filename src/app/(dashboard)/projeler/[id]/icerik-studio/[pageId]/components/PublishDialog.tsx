'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { publishToWordPress } from '@/app/(dashboard)/projeler/[id]/sayfa-paketi/actions'

type Props = {
  projectId: string
  pageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (wpPostUrl: string, wpStatus: string) => void
}

export function PublishDialog({ projectId, pageId, open, onOpenChange, onSuccess }: Props) {
  const [publishStatus, setPublishStatus] = useState<'publish' | 'draft'>('publish')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    if (isPending) return // gönderim süresince kapatılamaz
    onOpenChange(isOpen)
    if (!isOpen) {
      setError(null)
      setPublishStatus('publish')
    }
  }

  const handleSubmit = async () => {
    setIsPending(true)
    setError(null)

    try {
      const result = await publishToWordPress(projectId, pageId, publishStatus)

      if (!result.success) {
        setError(result.error)
        setIsPending(false)
        return
      }

      onOpenChange(false)
      onSuccess(result.wpPostUrl, result.wpStatus)
    } catch {
      setError('Gönderim sırasında hata oluştu. Tekrar deneyin.')
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>WordPress&apos;e Gönder</DialogTitle>
        </DialogHeader>

        {/* RadioGroup — erişilebilirlik için fieldset + legend */}
        <fieldset className="space-y-3 border-0 p-0 m-0">
          <legend className="sr-only">Yayın seçeneği</legend>

          {([
            {
              value: 'publish' as const,
              label: 'Hemen Yayınla',
              description: 'İçerik hemen yayınlanır.',
            },
            {
              value: 'draft' as const,
              label: 'Taslak Kaydet',
              description: 'WordPress taslak olarak kaydedilir, yayınlanmaz.',
            },
          ] as const).map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="publish-status"
                value={opt.value}
                checked={publishStatus === opt.value}
                onChange={() => setPublishStatus(opt.value)}
                disabled={isPending}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </fieldset>

        {/* Hata mesajı */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Vazgeç
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            aria-busy={isPending}
            aria-label={isPending ? 'Gönderiliyor' : undefined}
          >
            {isPending ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="animate-spin mr-2"
                />
                Gönderiliyor...
              </>
            ) : error ? (
              'Tekrar Dene'
            ) : (
              'Gönder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
