'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateProjectField } from '../actions'
import { CompetitorsTagInput } from './CompetitorsTagInput'
import { KeywordsTagInput } from './KeywordsTagInput'

type FieldConfig = {
  key: string
  label: string
  type: 'input' | 'textarea'
  critical: boolean
  span?: 'full'
  placeholder?: string
  custom?: 'competitors' | 'keywords'
}

// input alanlar 2'li grid, textarea'lar full genişlik
const FIELDS: FieldConfig[] = [
  { key: 'name',                label: 'Proje Adı',    type: 'input',    critical: false },
  { key: 'domain',              label: 'Domain',        type: 'input',    critical: true,  placeholder: 'musteri.com' },
  { key: 'sector',              label: 'Sektör',        type: 'input',    critical: true  },
  { key: 'site_type',           label: 'Site Tipi',     type: 'input',    critical: true  },
  { key: 'target_country',      label: 'Hedef Ülke',    type: 'input',    critical: true  },
  { key: 'target_language',     label: 'Hedef Dil',     type: 'input',    critical: true  },
  { key: 'business_model',      label: 'İş Modeli',     type: 'input',    critical: true  },
  { key: 'brand_tone',          label: 'Marka Tonu',    type: 'input',    critical: false },
  { key: 'target_customer',     label: 'Hedef Müşteri',     type: 'textarea', critical: false, span: 'full' },
  { key: 'target_keywords',     label: 'Anahtar Kelimeler', type: 'textarea', critical: false, span: 'full', custom: 'keywords' },
  { key: 'main_goal',           label: 'Ana Hedef',         type: 'textarea', critical: false, span: 'full' },
  { key: 'initial_competitors', label: 'Rakipler',          type: 'textarea', critical: false, span: 'full', custom: 'competitors' },
  { key: 'custom_rules',        label: 'Özel Kurallar',     type: 'textarea', critical: false, span: 'full' },
]

type ProjectData = Record<string, string | null>

type Props = {
  projectId: string
  initialData: ProjectData
}

function EditableField({
  field,
  value,
  isEditing,
  editValue,
  saving,
  error,
  onStartEdit,
  onEditChange,
  onSaveClick,
  onCancel,
  pendingConfirm,
  onConfirm,
  onCancelConfirm,
}: {
  field: FieldConfig
  value: string | null
  isEditing: boolean
  editValue: string
  saving: boolean
  error: string | null
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onSaveClick: () => void
  onCancel: () => void
  pendingConfirm: boolean
  onConfirm: () => void
  onCancelConfirm: () => void
}) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  return (
    <div className="group rounded-md px-3 py-2.5 hover:bg-secondary/50 transition-colors">
      <p className="text-xs text-muted-foreground mb-0.5">{field.label}</p>

      {isEditing ? (
        <div className="flex flex-col gap-2 mt-1">
          {field.type === 'textarea' ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              placeholder={field.placeholder}
              className="text-sm min-h-20 resize-none"
              onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              placeholder={field.placeholder}
              className="text-sm h-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !field.critical) onSaveClick()
                if (e.key === 'Escape') onCancel()
              }}
            />
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            {field.critical ? (
              <AlertDialog open={pendingConfirm} onOpenChange={(open) => { if (!open) onCancelConfirm() }}>
                <AlertDialogTrigger
                  render={
                    <Button size="sm" disabled={saving} className="h-7 text-xs" onClick={onSaveClick} />
                  }
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Kritik Alan Değişikliği</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{field.label}</strong> alanındaki bu değişiklik sitenizin içerik yapısını,
                    URL&apos;lerini, menüsünü ve bağlantılarını etkileyebilir. Emin misiniz?
                  </AlertDialogDescription>
                  <div className="flex justify-end gap-2 mt-4">
                    <AlertDialogCancel render={<Button variant="outline" size="sm" />} onClick={onCancelConfirm}>
                      İptal
                    </AlertDialogCancel>
                    <AlertDialogAction
                      render={<Button variant="destructive" size="sm" disabled={saving} />}
                      onClick={onConfirm}
                    >
                      Evet, Değiştir
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={onSaveClick}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={saving}>
              İptal
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onStartEdit} className="w-full text-left">
          {value ? (
            <p className="text-sm whitespace-pre-wrap">{value}</p>
          ) : (
            <p className="text-sm text-muted-foreground/40 italic">Eklemek için tıklayın</p>
          )}
        </button>
      )}
    </div>
  )
}

export function ProjectInfoSection({ projectId, initialData }: Props) {
  const [data, setData] = useState<ProjectData>(initialData)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [pendingField, setPendingField] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = (key: string) => {
    setEditingField(key)
    setEditValue(data[key] ?? '')
    setError(null)
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
    setError(null)
    setPendingField(null)
  }

  const save = async (field: string, value: string) => {
    setSaving(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await updateProjectField(projectId, field as any, value)
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setData((prev) => ({ ...prev, [field]: value || null }))
    setEditingField(null)
    setEditValue('')
    setPendingField(null)
  }

  const handleSaveClick = (field: FieldConfig) => {
    if (field.critical) {
      setPendingField(field.key)
    } else {
      save(field.key, editValue)
    }
  }

  // 2 sütun grid: input alanlar çiftler halinde, textarea'lar tam genişlik
  const rows: FieldConfig[][] = []
  let i = 0
  while (i < FIELDS.length) {
    const f = FIELDS[i]
    if (f.span === 'full' || f.type === 'textarea') {
      rows.push([f])
      i++
    } else {
      const next = FIELDS[i + 1]
      if (next && next.type === 'input' && next.span !== 'full') {
        rows.push([f, next])
        i += 2
      } else {
        rows.push([f])
        i++
      }
    }
  }

  return (
    <div className="space-y-1">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className={row.length === 2 ? 'grid grid-cols-2 gap-x-2' : 'grid grid-cols-1'}
        >
          {row.map((field) =>
            field.custom === 'competitors' ? (
              <div key={field.key} className="px-3 py-2.5">
                <CompetitorsTagInput projectId={projectId} initialValue={data[field.key] ?? null} />
              </div>
            ) : field.custom === 'keywords' ? (
              <div key={field.key} className="px-3 py-2.5">
                <KeywordsTagInput projectId={projectId} initialValue={data[field.key] ?? null} />
              </div>
            ) : (
              <EditableField
                key={field.key}
                field={field}
                value={data[field.key] ?? null}
                isEditing={editingField === field.key}
                editValue={editingField === field.key ? editValue : ''}
                saving={saving && editingField === field.key}
                error={editingField === field.key ? error : null}
                onStartEdit={() => startEdit(field.key)}
                onEditChange={setEditValue}
                onSaveClick={() => handleSaveClick(field)}
                onCancel={cancelEdit}
                pendingConfirm={pendingField === field.key}
                onConfirm={() => save(field.key, editValue)}
                onCancelConfirm={() => setPendingField(null)}
              />
            )
          )}
        </div>
      ))}
    </div>
  )
}
