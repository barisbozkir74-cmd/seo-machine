'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkDeleteEntities } from '@/app/(dashboard)/projeler/[id]/isletme/actions'
import type { BusinessEntity } from '@/app/(dashboard)/projeler/[id]/isletme/actions'

interface BulkDeleteBarProps {
  projectId: string
  entities:  BusinessEntity[]
}

export function BulkDeleteBar({ projectId, entities }: BulkDeleteBarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)

  if (entities.length === 0) return null

  function handleDelete() {
    startTransition(async () => {
      await bulkDeleteEntities(projectId, entities.map(e => e.id))
      setConfirm(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/10 px-4 py-2.5">
      <span className="text-[11px] text-muted-foreground/50">
        {entities.length} kayıt seçili
      </span>

      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-amber-400/70">
            {entities.length} kayıt silinecek. Emin misiniz?
          </span>
          <button
            onClick={() => setConfirm(false)}
            disabled={isPending}
            className="rounded px-2.5 py-1 text-[11px] border border-border/30 text-muted-foreground/60 hover:bg-secondary/40 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded px-2.5 py-1 text-[11px] border border-red-500/30 bg-red-500/10 text-red-400/80 hover:bg-red-500/15 transition-colors disabled:opacity-40"
          >
            {isPending ? 'Siliniyor…' : 'Evet, Sil'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="rounded px-2.5 py-1 text-[11px] border border-red-500/20 text-red-400/60 hover:bg-red-500/8 hover:border-red-500/30 transition-colors"
        >
          Tümünü Sil
        </button>
      )}
    </div>
  )
}
