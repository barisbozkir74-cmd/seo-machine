'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, Link03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { PublishDialog } from './PublishDialog'
import { GscIndexBadge } from '../../sayfa-paketi/GscIndexBadge'
import { checkIndexStatus } from '../../sayfa-paketi/actions'

type Props = {
  projectId: string
  pageId: string
  wpPostUrl?: string | null
  wpStatus?: string | null
  isWpConfigured: boolean
  // GSC (D-07): index badge ve kontrol butonu
  pagePackageId?: string | null
  gscIndexStatus?: string | null
  gscIndexCheckedAt?: string | null
  isGscConnected?: boolean
}

export function HtmlReadyBanner({
  projectId,
  pageId,
  wpPostUrl,
  wpStatus,
  isWpConfigured,
  pagePackageId,
  gscIndexStatus,
  gscIndexCheckedAt,
  isGscConnected,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [localWpPostUrl, setLocalWpPostUrl] = useState<string | null>(wpPostUrl ?? null)
  const [localWpStatus, setLocalWpStatus] = useState<string | null>(wpStatus ?? null)

  // GSC index state
  const [indexStatus, setIndexStatus] = useState<string | null>(gscIndexStatus ?? null)
  const [indexCheckedAt, setIndexCheckedAt] = useState<string | null>(gscIndexCheckedAt ?? null)
  const [checkingIndex, setCheckingIndex] = useState(false)
  const [indexError, setIndexError] = useState<string | null>(null)

  const handlePublishSuccess = (url: string, status: string) => {
    setLocalWpPostUrl(url)
    setLocalWpStatus(status)
  }

  const handleCheckIndex = async () => {
    if (!pagePackageId || !localWpPostUrl) return
    setCheckingIndex(true)
    setIndexError(null)
    try {
      const result = await checkIndexStatus(pagePackageId, projectId, localWpPostUrl)
      if (result.success && result.status) {
        setIndexStatus(result.status)
        setIndexCheckedAt(new Date().toISOString())
      } else {
        setIndexError(result.error ?? 'Index durumu alınamadı. Tekrar deneyin.')
      }
    } catch {
      setIndexError('Index durumu alınamadı. Tekrar deneyin.')
    } finally {
      setCheckingIndex(false)
    }
  }

  // GSC index bölümü — tüm banner varyantlarında ortak
  const gscSection = (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <GscIndexBadge status={indexStatus} />
      {isGscConnected && localWpPostUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckIndex}
          disabled={checkingIndex || !pagePackageId}
          title={!isGscConnected ? 'Önce GSC bağlantısını yapılandırın' : undefined}
          aria-label="GSC'de index durumunu kontrol et"
        >
          {checkingIndex ? 'Kontrol Ediliyor...' : 'Index Durumunu Kontrol Et'}
        </Button>
      )}
      {indexCheckedAt && (
        <span className="text-xs text-muted-foreground">
          Son kontrol: {new Date(indexCheckedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {indexError && (
        <span className="text-xs text-destructive" role="alert">{indexError}</span>
      )}
    </div>
  )

  // Yayında
  if (localWpPostUrl && localWpStatus === 'publish') {
    return (
      <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Tick02Icon} className="text-emerald-400 shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-400">WordPress&apos;te Yayında</p>
            <p className="text-sm text-muted-foreground">
              <a
                href={localWpPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground flex items-center gap-1"
                aria-label="WordPress'teki sayfayı yeni sekmede görüntüle"
              >
                Sayfayı Görüntüle
                <HugeiconsIcon icon={Link03Icon} size={14} className="shrink-0" />
              </a>
            </p>
          </div>
        </div>
        {/* GSC Index kontrolü — D-07 */}
        {gscSection}
      </div>
    )
  }

  // Taslak
  if (localWpPostUrl && localWpStatus === 'draft') {
    return (
      <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Tick02Icon} className="text-slate-400 shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-300">WordPress Taslak Olarak Kaydedildi</p>
            <p className="text-sm text-muted-foreground">
              <a
                href={localWpPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
                aria-label="WordPress'teki sayfayı yeni sekmede görüntüle"
              >
                Sayfayı Görüntüle
              </a>
            </p>
          </div>
        </div>
        {/* GSC Index kontrolü — D-07 */}
        {gscSection}
      </div>
    )
  }

  // Henüz gönderilmemiş — buton + dialog
  return (
    <>
      <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Tick02Icon} className="text-emerald-400 shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-400">HTML Çıktısı Hazır</p>
            <p className="text-sm text-muted-foreground">
              Tüm bölümler onaylandı. İçerik WordPress&apos;e yayınlanmaya hazır.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={!isWpConfigured}
            title={!isWpConfigured ? 'Önce WordPress bağlantısını yapılandırın' : undefined}
            className="shrink-0"
          >
            WordPress&apos;e Gönder
          </Button>
        </div>
        {/* GSC Index kontrolü — D-07 */}
        {gscSection}
      </div>

      <PublishDialog
        projectId={projectId}
        pageId={pageId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handlePublishSuccess}
      />
    </>
  )
}
