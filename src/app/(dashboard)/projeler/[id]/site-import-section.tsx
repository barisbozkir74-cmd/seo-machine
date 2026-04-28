'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { startSiteImport } from './actions'

type ImportStatus = 'idle' | 'running' | 'enriching' | 'complete' | 'error'

interface SiteImportSectionProps {
  projectId: string
  hasWpCredentials: boolean
  initialImportStatus: string | null
  initialImportCurrent: number
  initialImportTotal: number
  importCompletedAt: string | null
}

function formatImportDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function parseStatus(raw: string | null): ImportStatus {
  if (raw === 'running') return 'running'
  if (raw === 'enriching') return 'enriching'
  if (raw === 'complete') return 'complete'
  if (raw === 'error') return 'error'
  return 'idle'
}

export function SiteImportSection({
  projectId,
  hasWpCredentials,
  initialImportStatus,
  initialImportCurrent,
  initialImportTotal,
  importCompletedAt,
}: SiteImportSectionProps) {
  const [status, setStatus] = useState<ImportStatus>(parseStatus(initialImportStatus))
  const [current, setCurrent] = useState(initialImportCurrent)
  const [total, setTotal] = useState(initialImportTotal)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  // D-07: 500ms polling — running veya enriching durumunda aktif
  useEffect(() => {
    if (status !== 'running' && status !== 'enriching') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/wp/import-status?projectId=${projectId}`)
        if (!res.ok) return
        const data = await res.json()
        setStatus(parseStatus(data.status))
        setCurrent(data.current ?? 0)
        setTotal(data.total ?? 0)
        if (data.status === 'complete' || data.status === 'error') {
          clearInterval(interval)
        }
      } catch {
        // Network hatası — sessizce devam et, bir sonraki polling denenecek
      }
    }, 500)

    return () => clearInterval(interval)
  }, [status, projectId])

  const handleStartImport = async () => {
    setError(null)
    setStarting(true)
    try {
      const result = await startSiteImport(projectId)
      if (!result.jobStarted) {
        setError(result.error ?? 'İçe aktarma başlatılamadı.')
        return
      }
      setStatus('running')
      setCurrent(0)
      setTotal(0)
    } catch {
      setError('İçe aktarma başarısız. WordPress bağlantısını kontrol edin ve tekrar deneyin.')
    } finally {
      setStarting(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    setStatus('idle')
    handleStartImport()
  }

  // Badge rengi
  const badgeClass =
    status === 'complete'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : 'bg-slate-800 text-slate-400 border-slate-700'

  const badgeLabel =
    status === 'complete'
      ? 'Tamamlandı'
      : status === 'running' || status === 'enriching'
        ? 'İçe Aktarılıyor'
        : status === 'error'
          ? 'Hata'
          : null

  const isActive = status === 'running' || status === 'enriching' || starting

  const progressPercent =
    status === 'enriching'
      ? 100
      : total > 0
        ? Math.round((current / total) * 100)
        : 0

  return (
    <div className="space-y-4">
      {/* Başlık + Durum Badge */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">WordPress Site İçe Aktarma</h2>
        {badgeLabel && (
          <Badge aria-live="polite" className={badgeClass}>
            {badgeLabel}
          </Badge>
        )}
      </div>

      {/* Açıklama */}
      <p className="text-sm text-muted-foreground">
        WordPress sitenizin mevcut içeriğini okuyarak SEO analizi için hazırlar.
      </p>

      {/* WP bağlı değil */}
      {!hasWpCredentials && (
        <p className="text-sm text-muted-foreground">
          WordPress bağlantısı yapılandırılmamış. Önce WordPress ayarlarını tamamlayın.
        </p>
      )}

      {/* Tamamlama banner */}
      {status === 'complete' && (
        <div
          aria-live="polite"
          role="status"
          className="flex items-center justify-between rounded-md bg-emerald-500/20 border border-emerald-500/30 px-4 py-3"
        >
          <span className="text-sm text-emerald-400">İçe aktarma tamamlandı</span>
          <Link
            href={`/projeler/${projectId}/site-analizi`}
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Site Analizine Git →
          </Link>
        </div>
      )}

      {/* Progress alanı — running veya enriching */}
      {(status === 'running' || status === 'enriching') && (
        <div className="space-y-2">
          <div
            className="w-full bg-secondary rounded-full h-2 overflow-hidden"
          >
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={current}
              aria-valuemax={total > 0 ? total : 100}
              aria-label="İçe aktarma ilerleme durumu"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {status === 'enriching'
              ? 'Sayfalar analiz ediliyor...'
              : total > 0
                ? `${current}/${total} sayfa içe aktarıldı`
                : 'İçe aktarılıyor...'}
          </p>
        </div>
      )}

      {/* Önceki import var ve şu an idle — son import tarihi + site analizi linki */}
      {status === 'idle' && importCompletedAt && hasWpCredentials && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Son içe aktarma: {formatImportDate(importCompletedAt)}
          </p>
          <Link
            href={`/projeler/${projectId}/site-analizi`}
            className="text-sm text-primary hover:underline"
          >
            Site Analizine Git →
          </Link>
        </div>
      )}

      {/* Hata mesajı */}
      {(error || status === 'error') && (
        <p
          role="alert"
          className="text-xs text-destructive"
        >
          {error ?? 'İçe aktarma başarısız. WordPress bağlantısını kontrol edin ve tekrar deneyin.'}
        </p>
      )}

      {/* CTA butonları */}
      {hasWpCredentials && status !== 'complete' && (
        <div className="flex justify-end gap-2">
          {status === 'error' && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={starting}
              className="min-h-[44px]"
            >
              Tekrar Dene
            </Button>
          )}
          {status !== 'error' && (
            <Button
              onClick={handleStartImport}
              disabled={isActive || !hasWpCredentials}
              variant={importCompletedAt && status === 'idle' ? 'outline' : 'default'}
              className="min-h-[44px]"
              title={!hasWpCredentials ? 'WordPress bağlantısı yapılandırılmamış' : undefined}
            >
              {isActive
                ? 'İçe Aktarılıyor...'
                : importCompletedAt && status === 'idle'
                  ? 'WordPress Sitemi Yenile'
                  : 'WordPress Sitemi İçeri Al'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
