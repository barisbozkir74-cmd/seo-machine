'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, Link03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { PublishDialog } from './PublishDialog'

type Props = {
  projectId: string
  pageId: string
  wpPostUrl?: string | null
  wpStatus?: string | null
  isWpConfigured: boolean
}

export function HtmlReadyBanner({
  projectId,
  pageId,
  wpPostUrl,
  wpStatus,
  isWpConfigured,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [localWpPostUrl, setLocalWpPostUrl] = useState<string | null>(wpPostUrl ?? null)
  const [localWpStatus, setLocalWpStatus] = useState<string | null>(wpStatus ?? null)

  const handlePublishSuccess = (url: string, status: string) => {
    setLocalWpPostUrl(url)
    setLocalWpStatus(status)
  }

  // Yayında
  if (localWpPostUrl && localWpStatus === 'publish') {
    return (
      <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
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
    )
  }

  // Taslak
  if (localWpPostUrl && localWpStatus === 'draft') {
    return (
      <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center gap-3">
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
    )
  }

  // Henüz gönderilmemiş — buton + dialog
  return (
    <>
      <div className="sticky bottom-0 z-10 mx-6 mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
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
