'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AiAcquireButton({
  projectId,
  userId,
}: {
  projectId: string
  userId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const router = useRouter()

  const handleAcquire = () => {
    setError(null)
    setLastResult(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/keywords/acquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, userId }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (typeof data?.totalAdded === 'number') {
            setLastResult(`+${data.totalAdded} yeni keyword (rakip: ${data.competitorCount}, genişletme: ${data.expansionCount})`)
          }
          // Tuzak 5: revalidatePath route'tan tetiklenmiyor — router.refresh() zorunlu
          router.refresh()
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'Keyword çekme başarısız.')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Beklenmeyen hata.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleAcquire}
        disabled={isPending}
        variant="outline"
        className={`h-9 ${isPending ? 'opacity-50' : ''}`}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Keywordler Çekiliyor...
          </span>
        ) : (
          'AI ile Keyword Çek'
        )}
      </Button>
      {lastResult && <p className="text-xs text-muted-foreground">{lastResult}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
