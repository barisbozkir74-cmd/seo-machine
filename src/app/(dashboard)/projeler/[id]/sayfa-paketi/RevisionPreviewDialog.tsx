'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import type { RevisionRow } from './actions'

export function RevisionPreviewDialog({
  revision,
  open,
  onClose,
  onLoadRevision,
}: {
  revision: RevisionRow | null
  open: boolean
  onClose: () => void
  onLoadRevision: (snapshot: Record<string, unknown>) => void
}) {
  const [isLoading, setIsLoading] = useState(false)

  if (!revision) return null

  const formattedDate = new Date(revision.created_at).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleLoadRevision = () => {
    setIsLoading(true)
    onLoadRevision(revision.snapshot)
    setIsLoading(false)
    onClose()
  }

  // Fields to display from snapshot — matches PagePackageData keys
  const textFields: Array<{ key: string; label: string }> = [
    { key: 'seo_title', label: 'SEO Başlığı' },
    { key: 'meta_description', label: 'Meta Açıklama' },
    { key: 'h1', label: 'H1' },
    { key: 'slug', label: 'Slug' },
    { key: 'canonical_url', label: 'Canonical URL' },
    { key: 'strategic_purpose', label: 'Stratejik Amaç' },
    { key: 'search_intent', label: 'Arama Niyeti' },
    { key: 'schema_type', label: 'Schema Türü' },
    { key: 'page_type', label: 'Sayfa Türü' },
  ]

  const jsonFields: Array<{ key: string; label: string }> = [
    { key: 'heading_hierarchy', label: 'Başlık Hiyerarşisi' },
    { key: 'content_blocks', label: 'İçerik Blokları' },
    { key: 'cta_blocks', label: 'CTA Blokları' },
    { key: 'image_plan', label: 'Görsel Planı' },
    { key: 'alt_texts', label: 'Alt Metinler' },
    { key: 'secondary_keywords', label: 'İkincil Keywordler' },
    { key: 'faq', label: 'SSS' },
    { key: 'schema_jsonld', label: 'Schema JSON-LD' },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revizyon {revision.version_num} — Önizleme</DialogTitle>
          <DialogDescription>
            Bu sürüm {formattedDate} tarihinde kaydedildi. Salt okunur görünüm.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-4 py-2">
          {textFields.map(({ key, label }) =>
            revision.snapshot[key] !== undefined ? (
              <div key={key} className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Textarea
                  value={String(revision.snapshot[key] ?? '')}
                  disabled
                  className="text-sm resize-y"
                />
              </div>
            ) : null
          )}
          {jsonFields.map(({ key, label }) =>
            revision.snapshot[key] !== undefined ? (
              <div key={key} className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Textarea
                  value={
                    typeof revision.snapshot[key] === 'string'
                      ? revision.snapshot[key] as string
                      : JSON.stringify(revision.snapshot[key], null, 2)
                  }
                  disabled
                  className="text-sm resize-y font-mono"
                />
              </div>
            ) : null
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" size="sm">Kapat</Button>} />
          <Button size="sm" onClick={handleLoadRevision} disabled={isLoading}>
            {isLoading ? 'Yükleniyor...' : 'Bunu Yükle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
