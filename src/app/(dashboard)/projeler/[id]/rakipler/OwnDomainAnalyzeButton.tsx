'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { fetchOwnDomainData } from './actions'

type Props = {
  projectId: string
  domain: string
}

export function OwnDomainAnalyzeButton({ projectId, domain }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsPending(true)
    setError(null)
    try {
      // CR-01 FIX: fetchOwnDomainData artık projects.own_category_structure'a persist ediyor
      // ve revalidatePath çağırıyor — reload sonrası SSR DB'den okur, sütun dolar
      await fetchOwnDomainData(projectId, domain)
      window.location.reload()
    } catch {
      setError('Analiz başarısız. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleAnalyze}
        disabled={isPending}
        className={isPending ? 'opacity-50 cursor-wait' : ''}
      >
        {isPending ? 'Analiz ediliyor...' : 'Kendi Sitemi Analiz Et'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
