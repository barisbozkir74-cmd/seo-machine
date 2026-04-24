'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { updatePageAttributes, type PageAttributeUpdate } from './actions'

const PAGE_TYPE_LABELS: Record<string, string> = {
  'ana-sayfa': 'Ana Sayfa',
  kategori: 'Kategori Sayfası',
  hizmet: 'Hizmet Sayfası',
  urun: 'Ürün Sayfası',
  blog: 'Blog Yazısı',
  landing: 'Landing Page',
  hakkimizda: 'Hakkımızda',
  iletisim: 'İletişim',
  sss: 'SSS Sayfası',
  fiyatlandirma: 'Fiyatlandırma',
}

type PageRow = {
  id: string
  title: string
  page_type: string | null
  priority: string | null
  focus_keyword_id: string | null
}

type KeywordOption = {
  id: string
  keyword: string
}

type Props = {
  projectId: string
  pages: PageRow[]
  keywords: KeywordOption[]
}

export function BulkEditPagesDialog({ projectId, pages, keywords }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // dirty state: Map<pageId, Partial<PageAttributeUpdate>>
  const [dirty, setDirty] = useState<Map<string, Partial<PageAttributeUpdate>>>(new Map())

  function handleChange(
    pageId: string,
    field: keyof Omit<PageAttributeUpdate, 'id'>,
    value: string | null
  ) {
    setDirty((prev) => {
      const next = new Map(prev)
      const existing = next.get(pageId) ?? {}
      next.set(pageId, { ...existing, [field]: value === '' ? null : value })
      return next
    })
  }

  function handleSave() {
    if (dirty.size === 0) return
    setError(null)
    const updates: PageAttributeUpdate[] = Array.from(dirty.entries()).map(([id, changes]) => ({
      id,
      ...changes,
    }))
    startTransition(async () => {
      const result = await updatePageAttributes(projectId, updates)
      if (!result.success) {
        setError('Kaydetme başarısız. Lütfen tekrar deneyin.')
        return
      }
      setDirty(new Map())
      setOpen(false)
      router.refresh()
    })
  }

  function handleClose() {
    if (!isPending) {
      setDirty(new Map())
      setError(null)
      setOpen(false)
    }
  }

  const dirtyCount = dirty.size

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); else setOpen(true) }}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={pages.length === 0}
            title={pages.length === 0 ? 'Düzenlenecek sayfa yok' : undefined}
          >
            Toplu Düzenle
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Toplu Sayfa Düzenleme</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Sayfa özelliklerini toplu olarak düzenleyin.
          </p>
        </DialogHeader>

        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Düzenlenecek sayfa bulunamadı.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal">
                    Sayfa Adı
                  </th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal w-40">
                    Tip
                  </th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal w-48">
                    Focus Keyword
                  </th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal w-32">
                    Öncelik
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const changes = dirty.get(page.id) ?? {}
                  const currentType = 'page_type' in changes ? changes.page_type : page.page_type
                  const currentKw =
                    'focus_keyword_id' in changes
                      ? changes.focus_keyword_id
                      : page.focus_keyword_id
                  const currentPriority =
                    'priority' in changes ? changes.priority : page.priority

                  return (
                    <tr
                      key={page.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2 text-sm font-normal">{page.title}</td>
                      <td className="px-4 py-2">
                        <select
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-0 text-sm text-foreground"
                          value={currentType ?? ''}
                          disabled={isPending}
                          onChange={(e) => handleChange(page.id, 'page_type', e.target.value)}
                        >
                          <option value="">—</option>
                          {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-0 text-sm text-foreground"
                          value={currentKw ?? ''}
                          disabled={isPending}
                          onChange={(e) =>
                            handleChange(page.id, 'focus_keyword_id', e.target.value)
                          }
                        >
                          <option value="">— (Atanmamış)</option>
                          {keywords.map((kw) => (
                            <option key={kw.id} value={kw.id}>
                              {kw.keyword}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          className="w-full h-8 rounded-md border border-input bg-background px-2 py-0 text-sm text-foreground"
                          value={currentPriority ?? ''}
                          disabled={isPending}
                          onChange={(e) => handleChange(page.id, 'priority', e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="yüksek">Yüksek</option>
                          <option value="orta">Orta</option>
                          <option value="düşük">Düşük</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm">
            {error ? (
              <p className="text-destructive">{error}</p>
            ) : (
              <p className="text-muted-foreground">
                {dirtyCount === 0 ? 'Değişiklik yok' : `${dirtyCount} satır değiştirildi`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
              Düzenlemeyi Kapat
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={dirtyCount === 0 || isPending}
              className={isPending ? 'opacity-50 cursor-wait' : ''}
            >
              {isPending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
