'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface ResearchRerunButtonProps {
  projectId: string
  userId: string
}

export function ResearchRerunButton({ projectId, userId }: ResearchRerunButtonProps) {
  const [isResearching, setIsResearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRerun = async () => {
    if (isResearching) return
    setIsResearching(true)
    setError(null)
    try {
      const res = await fetch('/api/research/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userId }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'SERPAPI_NOT_CONFIGURED') {
          setError('SerpAPI anahtarı yapılandırılmamış. Lütfen sistem ayarlarını kontrol edin.')
        } else {
          setError('Araştırma başarısız oldu. Lütfen tekrar deneyin.')
        }
        return
      }
      router.refresh()
    } catch {
      setError('Araştırma başarısız oldu. Lütfen tekrar deneyin.')
    } finally {
      setIsResearching(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRerun}
        disabled={isResearching}
      >
        {isResearching ? (
          <span className="flex items-center gap-2">
            <Loader2 className="animate-spin h-4 w-4" />
            Araştırılıyor...
          </span>
        ) : (
          'Yeniden Araştır'
        )}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
