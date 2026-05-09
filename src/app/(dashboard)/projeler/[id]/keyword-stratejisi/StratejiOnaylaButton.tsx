'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approveStrategy } from './actions'

interface StratejiOnaylaButtonProps {
  projectId: string
  isApproved: boolean       // projects.keyword_strategy_approved
  hasApprovedCluster: boolean  // en az 1 approved cluster var mı? (aktifleştirme koşulu)
}

export function StratejiOnaylaButton({
  projectId,
  isApproved,
  hasApprovedCluster,
}: StratejiOnaylaButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await approveStrategy(projectId, !isApproved)
      // revalidatePath action içinde çağrılır; SSR güncellenince buton yeni state'i gösterir
    })
  }

  // Durum 1: Pasif — onaylı cluster yok (D-06)
  if (!hasApprovedCluster && !isApproved) {
    return (
      <Button
        variant="ghost"
        disabled
        className="h-9 text-xs opacity-40 cursor-not-allowed"
      >
        Stratejiyi Onayla
      </Button>
    )
  }

  // Durum 3: Onaylandı — tıklanınca geri alınabilir (D-06)
  if (isApproved) {
    return (
      <Button
        variant="ghost"
        className={`h-9 text-xs text-emerald-400 hover:text-emerald-300 ${isPending ? 'opacity-50' : ''}`}
        onClick={handleClick}
        disabled={isPending}
      >
        ✓ Strateji Onaylandı
      </Button>
    )
  }

  // Durum 2: Aktif — ≥1 approved cluster var (D-06)
  return (
    <Button
      variant="outline"
      className={`h-9 text-xs ${isPending ? 'opacity-50' : ''}`}
      onClick={handleClick}
      disabled={isPending}
    >
      Stratejiyi Onayla
    </Button>
  )
}
