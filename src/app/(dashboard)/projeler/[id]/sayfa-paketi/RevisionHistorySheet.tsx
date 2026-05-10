'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { getRevisions, type RevisionRow } from './actions'
import { RevisionPreviewDialog } from './RevisionPreviewDialog'

type SheetState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error'

export function RevisionHistorySheet({
  projectId,
  pageId,
  open,
  onOpenChange,
  onLoadRevision,
}: {
  projectId: string
  pageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadRevision: (snapshot: Record<string, unknown>) => void
}) {
  const [state, setState] = useState<SheetState>('idle')
  const [revisions, setRevisions] = useState<RevisionRow[]>([])
  const [selectedRevision, setSelectedRevision] = useState<RevisionRow | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  async function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) return
    setState('loading')
    const result = await getRevisions(projectId, pageId)
    if (!result.success) {
      setState('error')
      return
    }
    if (result.revisions.length === 0) {
      setState('empty')
      setRevisions([])
      return
    }
    setRevisions(result.revisions)
    setState('loaded')
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-[420px]">
          <SheetHeader>
            <SheetTitle>Revizyon Geçmişi</SheetTitle>
            <SheetDescription>
              Kaydedilen sürümler — bir revizyonu yükleyerek geri alabilirsin.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 px-6">
            {state === 'loading' && (
              <div
                className="w-5 h-5 rounded-full border-2 border-muted border-t-foreground animate-spin mx-auto mt-8"
                aria-label="Revizyon geçmişi yükleniyor"
              />
            )}
            {state === 'empty' && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Henüz kayıtlı revizyon yok. İlk kaydetme işleminde otomatik oluşturulur.
              </p>
            )}
            {state === 'error' && (
              <p className="text-sm text-red-400">
                Revizyon listesi yüklenemedi. Lütfen sayfayı yenile.
              </p>
            )}
            {state === 'loaded' && (
              <div>
                {revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center justify-between py-3 border-b border-border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        v{rev.version_num}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(rev.created_at).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRevision(rev)
                        setPreviewOpen(true)
                      }}
                    >
                      Önizle
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <RevisionPreviewDialog
        revision={selectedRevision}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onLoadRevision={(snapshot) => {
          onLoadRevision(snapshot)
          setPreviewOpen(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
