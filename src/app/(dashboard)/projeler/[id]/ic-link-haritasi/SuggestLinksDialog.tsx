'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { addLink, type InternalLinkSuggestion, type LinkType } from './actions'

type RowState = {
  suggestion: InternalLinkSuggestion
  selected: boolean
  linkType: LinkType
}

type Props = {
  projectId: string
  suggestions: InternalLinkSuggestion[]
  open: boolean
  onClose: () => void
}

export function SuggestLinksDialog({ projectId, suggestions, open, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const masterCheckboxRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<RowState[]>(() =>
    suggestions.map((s) => ({ suggestion: s, selected: true, linkType: 'contextual' }))
  )

  const selectedCount = rows.filter((r) => r.selected).length
  const allSelected = selectedCount === rows.length
  const noneSelected = selectedCount === 0

  // Set master checkbox indeterminate state after each render
  if (masterCheckboxRef.current) {
    masterCheckboxRef.current.indeterminate = !noneSelected && !allSelected
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    )
  }

  function toggleAll() {
    const nextState = !allSelected
    setRows((prev) => prev.map((r) => ({ ...r, selected: nextState })))
  }

  function setRowLinkType(index: number, linkType: LinkType) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, linkType } : r)))
  }

  function handleAdd() {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) return
    setError(null)
    startTransition(async () => {
      for (const row of selected) {
        const result = await addLink(projectId, {
          source_page_id: row.suggestion.sourcePage.id,
          target_page_id: row.suggestion.targetPage.id,
          anchor_text: row.suggestion.anchorText,
          link_type: row.linkType,
        })
        if (!result.success) {
          setError('Link eklenemedi. Lütfen tekrar deneyin.')
          return
        }
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isPending) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>İç Link Önerileri</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Sistem, pillar–destek ilişkisine göre link önerileri oluşturdu. Onaylamak
            istediklerinizi seçin.
          </p>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border">
              <tr>
                <th className="w-8 px-4 py-2">
                  <input
                    ref={masterCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={isPending}
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal">
                  Kaynak Sayfa
                </th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal">
                  Hedef Sayfa
                </th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal">
                  Anchor Text
                </th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground font-normal w-32">
                  Link Tipi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.suggestion.sourcePage.id}:${row.suggestion.targetPage.id}`}
                  className={`border-b border-border last:border-0 transition-colors ${
                    row.selected ? 'bg-muted/30' : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(index)}
                      disabled={isPending}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm font-normal">
                    {row.suggestion.sourcePage.title}
                    {!row.suggestion.sourcePage.page_type && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Tip Atanmamış
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm font-normal">
                    {row.suggestion.targetPage.title}
                    {!row.suggestion.targetPage.page_type && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Tip Atanmamış
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">
                    {row.suggestion.anchorText}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-0 text-sm text-foreground"
                      value={row.linkType}
                      disabled={isPending}
                      onChange={(e) => setRowLinkType(index, e.target.value as LinkType)}
                    >
                      <option value="contextual">Bağlamsal</option>
                      <option value="navigation">Navigasyon</option>
                      <option value="footer">Footer</option>
                      <option value="breadcrumb">Breadcrumb</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm">
            {error ? (
              <p className="text-destructive">{error}</p>
            ) : (
              <p className="text-muted-foreground">{selectedCount} öneri seçildi</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { if (!isPending) onClose() }}
              disabled={isPending}
            >
              Vazgeç
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={noneSelected || isPending}
              className={isPending ? 'opacity-50 cursor-wait' : ''}
            >
              {isPending ? 'Ekleniyor…' : 'Seçilenleri Ekle'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
