'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { advanceStage } from './actions'

interface StageTransitionProps {
  projectId: string
  activeStage: { id: string; stage_name: string } | null
  isLastStage: boolean
}

export function StageTransition({
  projectId,
  activeStage,
  isLastStage,
}: StageTransitionProps) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!activeStage) return
    setIsPending(true)
    setError(null)
    try {
      const result = await advanceStage(projectId, activeStage.id)
      if (result.success) {
        setOpen(false)
        // revalidatePath server'da çalıştı — sayfa kendiliğinden güncellenir
      } else {
        setError(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  if (isLastStage || !activeStage) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-sm text-emerald-400">
          Tüm aşamalar tamamlandı. Proje yayın sonrası takibindedir.
        </p>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full h-11" />}>
        Sonraki Aşamaya Geç
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aşamayı Tamamla</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          &ldquo;{activeStage.stage_name}&rdquo; aşamasını tamamlamak istediğinizden emin misiniz?
        </p>
        <p className="text-sm text-muted-foreground">Bu işlem geri alınamaz.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Vazgeç
          </Button>
          <Button onClick={handleConfirm} disabled={isPending} className="h-11">
            {isPending ? 'İşleniyor...' : 'Evet, Tamamla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
