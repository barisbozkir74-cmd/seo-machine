'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { upsertSection, type SectionKey } from './actions'

export type ColumnConfig = {
  key: string
  label: string
  placeholder?: string
}

type Props = {
  projectId: string
  section: SectionKey
  title: string
  columns: ColumnConfig[]
  initialRows: Record<string, string>[]
}

export function ResearchSection({
  projectId,
  section,
  title,
  columns,
  initialRows,
}: Props) {
  const [rows, setRows] = useState<Record<string, string>[]>(initialRows)
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  function addRow() {
    const emptyRow: Record<string, string> = {}
    columns.forEach((col) => {
      emptyRow[col.key] = ''
    })
    setRows((prev) => [...prev, emptyRow])
  }

  function updateCell(rowIndex: number, key: string, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row))
    )
  }

  function removeRow(rowIndex: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex))
  }

  function handleSave() {
    setSaveStatus('idle')
    startTransition(async () => {
      const result = await upsertSection(projectId, section, rows)
      setSaveStatus(result.success ? 'saved' : 'error')
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center text-sm text-muted-foreground py-6"
                >
                  Henüz satır yok. Aşağıdan ekleyin.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="py-1 px-2">
                      <Input
                        value={row[col.key] ?? ''}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        placeholder={col.placeholder ?? col.label}
                        className="h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="py-1 px-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(rowIndex)}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                      Sil
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={addRow}>
          + Satır Ekle
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
        {saveStatus === 'saved' && (
          <span className="text-xs text-emerald-500">Kaydedildi</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-destructive">Hata oluştu</span>
        )}
      </div>
    </div>
  )
}
