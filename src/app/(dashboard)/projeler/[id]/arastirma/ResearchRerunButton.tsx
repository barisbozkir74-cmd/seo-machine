'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ResearchRerunButtonProps {
  projectId: string
  userId: string
}

export function ResearchRerunButton({ projectId, userId }: ResearchRerunButtonProps) {
  const [isResearching, setIsResearching] = useState(false)
  const router = useRouter()

  const handleRerun = async () => {
    if (isResearching) return
    setIsResearching(true)
    try {
      const res = await fetch('/api/research/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userId }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'SERPAPI_NOT_CONFIGURED') {
          toast.error('SerpAPI anahtarı yapılandırılmamış. Lütfen sistem ayarlarını kontrol edin.')
        } else {
          toast.error('Araştırma başarısız oldu. Lütfen tekrar deneyin.')
        }
        return
      }
      toast.success('Araştırma tamamlandı. Araştırma sayfasında sonuçları görebilirsiniz.')
      router.refresh()
    } catch {
      toast.error('Araştırma başarısız oldu. Lütfen tekrar deneyin.')
    } finally {
      setIsResearching(false)
    }
  }

  return (
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
  )
}
