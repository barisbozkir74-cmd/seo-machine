'use client'

/**
 * DeepAnalysisPoller — Phase 24 DFS-06
 *
 * Pattern: ResearchAutoTrigger.tsx kopyası (Phase 18)
 * 5 saniye interval + router.refresh() → SSR page workflow_runs durumunu okur
 * Stop conditions: done / failed / timeout (12 dakika = 144 × 5s)
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type PollerStatus = 'pending' | 'running' | 'done' | 'failed' | 'timeout'

interface DeepAnalysisPollerProps {
  initialStatus: 'pending' | 'running'
  currentStatus?: PollerStatus // SSR re-render'da güncel durum
}

export function DeepAnalysisPoller({ initialStatus, currentStatus }: DeepAnalysisPollerProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<PollerStatus>(initialStatus)

  // currentStatus SSR'dan gelince güncelle
  useEffect(() => {
    if (currentStatus && currentStatus !== phase) {
      if (currentStatus === 'done' || currentStatus === 'failed') {
        setPhase(currentStatus)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus])

  useEffect(() => {
    // WR-04: rely solely on phase as stop condition — no triggered.current guard needed.
    // React's cleanup runs before each re-render, clearing the old interval when phase changes.
    if (phase === 'done' || phase === 'failed' || phase === 'timeout') return

    let loopCount = 0
    const MAX_LOOPS = 144 // 12 dakika timeout (UI-SPEC)

    const pollInterval = setInterval(() => {
      loopCount++

      if (loopCount >= MAX_LOOPS) {
        clearInterval(pollInterval)
        setPhase('timeout')
        return
      }

      // SSR page'i yenile → workflow_runs durumu SSR'dan okunur
      router.refresh()
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [router, phase])

  if (phase === 'done') {
    return (
      <p className="text-emerald-400 text-xs">
        ✓ Derinlemesine analiz tamamlandı
      </p>
    )
  }

  if (phase === 'failed') {
    return (
      <p className="text-destructive text-xs">
        Analiz başarısız oldu. Sayfayı yenileyin veya tekrar deneyin.
      </p>
    )
  }

  if (phase === 'timeout') {
    return (
      <p className="text-amber-400 text-xs">
        Analiz yanıt vermedi. Sayfayı yenileyin.
      </p>
    )
  }

  // pending veya running — polling devam ediyor
  return (
    <span className="flex items-center gap-2 text-cyan-400/60 text-xs">
      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Analiz Devam Ediyor...
    </span>
  )
}
