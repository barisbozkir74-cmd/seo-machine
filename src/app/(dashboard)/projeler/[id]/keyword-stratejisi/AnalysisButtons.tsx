'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { lightAnalysisAction, standardAnalysisAction, triggerDeepAnalysisAction } from './actions'
import type { LightAnalysisResult, StandardAnalysisResult } from './actions'

type AnalysisLevel = 'light' | 'standard' | 'deep'

type ResultMessage = {
  type: 'success' | 'partial' | 'error' | 'cache'
  text: string
}

interface AnalysisButtonsProps {
  projectId: string
  keywordCount: number        // 0 ise tüm butonlar disabled-no-keywords
  clusterCount: number        // 0 ise standard butonu disabled-no-clusters
  isAnalysisRunning: boolean  // workflow_runs'ta pending/running var mı (SSR'dan)
  onDeepAnalysisStart?: () => void  // Deep analiz route'u tetiklemek için
}

export function AnalysisButtons({
  projectId,
  keywordCount,
  clusterCount,
  isAnalysisRunning,
  onDeepAnalysisStart,
}: AnalysisButtonsProps) {
  const router = useRouter()
  const [isPendingLight, startLightTransition] = useTransition()
  const [isPendingStandard, startStandardTransition] = useTransition()
  const [isPendingDeep, startDeepTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingLevel, setPendingLevel] = useState<AnalysisLevel | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [resultMsg, setResultMsg] = useState<ResultMessage | null>(null)

  const noKeywords = keywordCount === 0
  const anyConcurrent = isAnalysisRunning || isPendingLight || isPendingStandard || isPendingDeep

  // Maliyet tahmini hesapla (~1 unit/keyword)
  const costEstimate = keywordCount > 0 ? keywordCount : 1

  function openDialog(level: AnalysisLevel) {
    if (anyConcurrent || noKeywords) return
    if (level === 'standard' && clusterCount === 0) return
    setPendingLevel(level)
    setDialogOpen(true)
    setResultMsg(null)
  }

  function handleConfirm() {
    if (!pendingLevel) return
    setIsConfirming(true)
    setDialogOpen(false)

    if (pendingLevel === 'light') {
      startLightTransition(async () => {
        const result: LightAnalysisResult = await lightAnalysisAction(projectId)
        setIsConfirming(false)
        if (!result.success) {
          setResultMsg({ type: 'error', text: result.error })
        } else if (result.fromCache) {
          setResultMsg({ type: 'cache', text: "Cache'den döndü — veri güncel" })
          setTimeout(() => setResultMsg(null), 3000)
          router.refresh()
        } else {
          setResultMsg({ type: 'success', text: `✓ ${result.count} keyword güncellendi` })
          setTimeout(() => setResultMsg(null), 4000)
          router.refresh()
        }
      })
    } else if (pendingLevel === 'standard') {
      startStandardTransition(async () => {
        const result: StandardAnalysisResult = await standardAnalysisAction(projectId)
        setIsConfirming(false)
        if (!result.success) {
          setResultMsg({ type: 'error', text: result.error })
        } else if (result.fromCache) {
          setResultMsg({ type: 'cache', text: "Cache'den döndü — veri güncel" })
          setTimeout(() => setResultMsg(null), 3000)
          router.refresh()
        } else {
          setResultMsg({ type: 'success', text: `✓ ${result.count} keyword güncellendi` })
          setTimeout(() => setResultMsg(null), 4000)
          router.refresh()
        }
      })
    } else if (pendingLevel === 'deep') {
      setIsConfirming(false)
      startDeepTransition(async () => {
        const result = await triggerDeepAnalysisAction(projectId)
        if (!result.success) {
          setResultMsg({ type: 'error', text: result.error })
        } else {
          router.refresh() // DeepAnalysisPoller SSR'dan mount edilir
        }
      })
    }
    setPendingLevel(null)
  }

  const baseBtnClass = "h-9 text-xs border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
  const disabledBtnClass = "h-9 text-xs opacity-40 cursor-not-allowed border-cyan-500/30 bg-cyan-500/10 text-cyan-400"

  const lightDisabled = noKeywords || anyConcurrent
  const standardDisabled = noKeywords || anyConcurrent || clusterCount === 0
  const deepDisabled = noKeywords || anyConcurrent

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* Temel Verileri Al */}
        <Button
          variant="outline"
          size="sm"
          className={lightDisabled ? disabledBtnClass : baseBtnClass}
          disabled={lightDisabled || isPendingLight}
          title={noKeywords ? 'Önce keyword ekleyin' : anyConcurrent ? 'Analiz devam ediyor' : 'Temel Verileri Al'}
          onClick={() => openDialog('light')}
        >
          {isPendingLight ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Veriler Çekiliyor...
            </span>
          ) : 'Temel Verileri Al'}
        </Button>

        {/* Standart Analiz */}
        <Button
          variant="outline"
          size="sm"
          className={standardDisabled ? disabledBtnClass : baseBtnClass}
          disabled={standardDisabled || isPendingStandard}
          title={noKeywords ? 'Önce keyword ekleyin' : clusterCount === 0 ? 'Önce kümeleme yapın' : anyConcurrent ? 'Analiz devam ediyor' : 'Standart Analiz'}
          onClick={() => openDialog('standard')}
        >
          {isPendingStandard ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analiz Yapılıyor...
            </span>
          ) : 'Standart Analiz'}
        </Button>

        {/* Derinlemesine Analiz */}
        <Button
          variant="outline"
          size="sm"
          className={deepDisabled ? disabledBtnClass : baseBtnClass}
          disabled={deepDisabled || isPendingDeep}
          title={noKeywords ? 'Önce keyword ekleyin' : anyConcurrent ? 'Analiz devam ediyor' : 'Derinlemesine Analiz'}
          onClick={() => openDialog('deep')}
        >
          {isPendingDeep ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Başlatılıyor...
            </span>
          ) : 'Derinlemesine Analiz'}
        </Button>
      </div>

      {/* Concurrent guard banner (UI-SPEC amber pattern) */}
      {isAnalysisRunning && (
        <div className="px-4 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          Analiz devam ediyor. Tamamlanmasını bekleyin.
        </div>
      )}

      {/* Inline result mesajı */}
      {resultMsg && (
        <p className={
          resultMsg.type === 'success' ? 'text-emerald-400 text-xs' :
          resultMsg.type === 'cache' ? 'text-muted-foreground text-xs' :
          resultMsg.type === 'partial' ? 'text-amber-400 text-xs' :
          'text-destructive text-xs'
        }>
          {resultMsg.text}
        </p>
      )}

      {/* Cost Approval Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>
            {pendingLevel === 'light' ? 'Temel Veri Analizi' :
             pendingLevel === 'standard' ? 'Standart Analiz' :
             'Derinlemesine Analiz'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {pendingLevel === 'light' ? 'Temel veri analizi onay iletişim kutusu' :
             pendingLevel === 'standard' ? 'Standart analiz onay iletişim kutusu' :
             'Derinlemesine analiz onay iletişim kutusu'}
          </DialogDescription>
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Tahmini maliyet:{' '}
              <span className="text-cyan-400 font-medium">~{costEstimate} birim</span>
            </p>
            <p className="text-muted-foreground text-xs">
              Gerçek maliyet analiz tamamlandıktan sonra kesinleşir.
            </p>
            {pendingLevel === 'standard' && (
              <p className="text-muted-foreground text-xs">
                Tamamlanma süresi yaklaşık 5–8 saniye.
              </p>
            )}
            {pendingLevel === 'deep' && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded px-3 py-2">
                Bu işlem arka planda çalışır ve tamamlanması birkaç dakika sürebilir.
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDialogOpen(false); setPendingLevel(null) }}
              >
                İptal
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                disabled={isConfirming}
                onClick={handleConfirm}
              >
                {isConfirming ? 'Başlatılıyor...' :
                 pendingLevel === 'light' ? 'Temel Analizi Başlat' :
                 pendingLevel === 'standard' ? 'Standart Analizi Başlat' :
                 'Derinlemesine Analizi Başlat'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
