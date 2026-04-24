'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { generatePagesFromClusters, type GenerateRowInput } from './actions'

// PAGE_TYPE_LABELS — yerel sabit; sayfalar/page.tsx'ten bağımsız
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

export type DialogRow = {
  clusterId: string
  clusterName: string
  proposedName: string       // strip intent suffix edilmiş cluster adı
  proposedType: string       // intent → page_type (D-02)
  focusKeyword: string | null
  focusKeywordId: string | null
  alreadyExists: boolean
}

type RowState = {
  pageName: string
  pageType: string
  include: boolean
}

export function GeneratePagesDialog({
  projectId,
  rows,
  open,
  onOpenChange,
  trigger,
}: {
  projectId: string
  rows: DialogRow[]
  open: boolean
  onOpenChange: (next: boolean) => void
  trigger?: ReactNode
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Her satır için form state — satır index'iyle eşleşir
  const initialState = useMemo<RowState[]>(
    () =>
      rows.map((r) => ({
        pageName: r.proposedName,
        pageType: r.proposedType,
        include: !r.alreadyExists, // alreadyExists → default skip
      })),
    [rows]
  )

  const [state, setState] = useState<RowState[]>(initialState)

  useEffect(() => {
    setState(initialState)
  }, [initialState])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setState(initialState)
      setError(null)
    }
    onOpenChange(next)
  }

  const updateRow = (idx: number, patch: Partial<RowState>) => {
    setState((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const includedCount = state.filter((r) => r.include).length

  const handleSubmit = () => {
    setError(null)
    const payload: GenerateRowInput[] = []
    for (let i = 0; i < rows.length; i++) {
      if (!state[i].include) continue
      if (!state[i].pageName.trim()) {
        setError(`"${rows[i].clusterName}" için sayfa adı boş olamaz.`)
        return
      }
      payload.push({
        clusterId: rows[i].clusterId,
        pageName: state[i].pageName.trim(),
        pageType: state[i].pageType,
        focusKeywordId: rows[i].focusKeywordId,
      })
    }

    startTransition(async () => {
      const result = await generatePagesFromClusters(projectId, payload)
      if (!result.success) {
        setError(result.error)
        return
      }
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kümelerden Sayfa Oluştur</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Kümelenmiş keyword bulunamadı. Önce keyword stratejisi sayfasından kümeleme yapın.
          </p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            {/* Başlık satırı */}
            <div className="grid grid-cols-[1fr_1fr_9rem_10rem_3rem] gap-0 bg-muted/50 border-b border-border text-xs text-muted-foreground font-normal">
              <div className="px-3 py-2">Küme Adı</div>
              <div className="px-3 py-2">Sayfa Adı</div>
              <div className="px-3 py-2">Tip</div>
              <div className="px-3 py-2">Odak Keyword</div>
              <div className="px-3 py-2 text-center">Dahil Et</div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {rows.map((r, idx) => {
                const rowState = state[idx]
                const disabled = r.alreadyExists || isPending
                const rowBg = r.alreadyExists ? 'bg-amber-500/10' : ''
                return (
                  <div
                    key={r.clusterId}
                    className={`grid grid-cols-[1fr_1fr_9rem_10rem_3rem] gap-0 border-b border-border last:border-0 items-center text-sm ${rowBg}`}
                  >
                    {/* Küme Adı — read-only */}
                    <div className="px-3 py-2 text-sm text-muted-foreground truncate">
                      {r.clusterName}
                    </div>

                    {/* Sayfa Adı — editable input + Zaten var badge */}
                    <div className="px-3 py-2 flex items-center gap-1">
                      <input
                        type="text"
                        value={rowState.pageName}
                        onChange={(e) => updateRow(idx, { pageName: e.target.value })}
                        disabled={disabled}
                        className={`w-full bg-transparent border-b border-border focus:outline-none focus:border-ring text-sm py-0.5 ${
                          disabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                      {r.alreadyExists && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">
                          Zaten var
                        </span>
                      )}
                    </div>

                    {/* Tip — native select */}
                    <div className="px-3 py-2">
                      <select
                        value={rowState.pageType}
                        onChange={(e) => updateRow(idx, { pageType: e.target.value })}
                        disabled={disabled}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Odak Keyword — read-only */}
                    <div className="px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                      {r.focusKeyword ?? '—'}
                    </div>

                    {/* Dahil Et — checkbox */}
                    <div className="px-3 py-2 flex justify-center">
                      <input
                        type="checkbox"
                        checked={rowState.include}
                        onChange={(e) => updateRow(idx, { include: e.target.checked })}
                        disabled={isPending}
                        className="h-4 w-4 accent-primary"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          <span className="text-sm text-muted-foreground self-center">
            {includedCount} sayfa oluşturulacak
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              İptal
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || includedCount === 0 || rows.length === 0}
              className={isPending ? 'opacity-50 cursor-wait' : ''}
            >
              {isPending ? 'Oluşturuluyor…' : 'Oluştur'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
