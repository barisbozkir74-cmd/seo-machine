'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { updateProjectField } from '@/app/(dashboard)/projeler/actions'
import { KeywordsTagInput } from '@/app/(dashboard)/projeler/[id]/KeywordsTagInput'
import { CompetitorsTagInput } from '@/app/(dashboard)/projeler/[id]/CompetitorsTagInput'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = 'input' | 'textarea' | 'select' | 'custom:keywords' | 'custom:competitors'

type SelectOption = { value: string; label: string }

type FieldConfig = {
  key: string
  label: string
  type: FieldType
  options?: SelectOption[]
}

export type Props = {
  projectId: string
  initialData: Record<string, string | null>
}

// ---------------------------------------------------------------------------
// Section + Field definitions
// ---------------------------------------------------------------------------

type SectionHeader = {
  kind: 'section'
  label: string
}

type FieldOrSection = FieldConfig | SectionHeader

const FIELD_SECTIONS: FieldOrSection[] = [
  { kind: 'section', label: 'Temel Bilgiler' },
  { key: 'name',                label: 'Proje Adı',           type: 'input' },
  { key: 'domain',              label: 'Domain',               type: 'input' },
  { key: 'sector',              label: 'Sektör',               type: 'input' },
  {
    key: 'site_type',
    label: 'Site Türü',
    type: 'select',
    options: [
      { value: 'new_site',      label: 'Yeni Site'    },
      { value: 'existing_site', label: 'Mevcut Site'  },
    ],
  },

  { kind: 'section', label: 'Hedef & Pazar' },
  { key: 'target_country',      label: 'Hedef Ülke',           type: 'input' },
  { key: 'target_language',     label: 'Hedef Dil',            type: 'input' },
  { key: 'business_model',      label: 'İş Modeli',            type: 'input' },
  { key: 'target_customer',     label: 'Hedef Müşteri',        type: 'textarea' },
  { key: 'main_goal',           label: 'Ana Hedef',            type: 'textarea' },
  { key: 'target_keywords',     label: 'Anahtar Kelimeler',    type: 'custom:keywords' },
  { key: 'initial_competitors', label: 'Rakipler',             type: 'custom:competitors' },

  { kind: 'section', label: 'Marka & İletişim' },
  { key: 'brand_tone',          label: 'Marka Tonu',           type: 'input' },
  { key: 'notes',               label: 'Notlar',               type: 'textarea' },
]

// Extract only FieldConfig items for row-building (skip section headers)
function buildRows(items: FieldOrSection[]): Array<FieldConfig[] | SectionHeader> {
  const result: Array<FieldConfig[] | SectionHeader> = []
  let pendingInputs: FieldConfig[] = []

  const flushPending = () => {
    while (pendingInputs.length > 0) {
      if (pendingInputs.length >= 2) {
        result.push([pendingInputs[0], pendingInputs[1]])
        pendingInputs = pendingInputs.slice(2)
      } else {
        result.push([pendingInputs[0]])
        pendingInputs = []
      }
    }
  }

  for (const item of items) {
    if ('kind' in item) {
      flushPending()
      result.push(item)
    } else if (item.type === 'input') {
      pendingInputs.push(item)
    } else {
      flushPending()
      result.push([item])
    }
  }
  flushPending()
  return result
}

const ROWS = buildRows(FIELD_SECTIONS)

// ---------------------------------------------------------------------------
// Single editable field
// ---------------------------------------------------------------------------

function EditableField({
  field,
  value,
  isEditing,
  editValue,
  saving,
  error,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
}: {
  field: FieldConfig
  value: string | null
  isEditing: boolean
  editValue: string
  saving: boolean
  error: string | null
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  // ------------------------------------------------------------------
  // Select: segmented buttons, clicking directly saves — no edit mode
  // ------------------------------------------------------------------
  if (field.type === 'select' && field.options) {
    const activeOption = field.options.find((o) => o.value === value)
    return (
      <div className="group rounded-md px-3 py-2.5 hover:bg-secondary/40 transition-colors">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">
          {field.label}
        </p>
        <div className="flex gap-1">
          {field.options.map((opt) => {
            const isActive = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving}
                onClick={() => onStartEdit() /* signals parent to call save directly */}
                // We surface this as a self-contained handler via data attribute
                data-option-value={opt.value}
                className={[
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {!activeOption && (
          <p className="mt-1 text-xs text-muted-foreground/40 italic">Seçmek için tıklayın</p>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Textarea
  // ------------------------------------------------------------------
  if (field.type === 'textarea') {
    return (
      <div className="group rounded-md px-3 py-2.5 hover:bg-secondary/40 transition-colors">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-0.5">
          {field.label}
        </p>
        {isEditing ? (
          <div className="flex flex-col gap-2 mt-1">
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              className="text-sm min-h-20 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCancel()
              }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={onSave}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={saving}>
                İptal
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onStartEdit} className="w-full text-left mt-0.5">
            {value ? (
              <p className="text-sm whitespace-pre-wrap text-foreground">{value}</p>
            ) : (
              <p className="text-sm text-muted-foreground/40 italic">Eklemek için tıklayın</p>
            )}
          </button>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Input (default)
  // ------------------------------------------------------------------
  return (
    <div className="group rounded-md px-3 py-2.5 hover:bg-secondary/40 transition-colors">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-0.5">
        {field.label}
      </p>
      {isEditing ? (
        <div className="flex flex-col gap-2 mt-1">
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="text-sm h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave()
              if (e.key === 'Escape') onCancel()
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={onSave}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel} disabled={saving}>
              İptal
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onStartEdit} className="w-full text-left mt-0.5">
          {value ? (
            <p className="text-sm text-foreground">{value}</p>
          ) : (
            <p className="text-sm text-muted-foreground/40 italic">Eklemek için tıklayın</p>
          )}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectField — segmented buttons that save on click (no edit mode)
// ---------------------------------------------------------------------------

function SelectField({
  field,
  value,
  saving,
  error,
  onDirectSave,
}: {
  field: FieldConfig
  value: string | null
  saving: boolean
  error: string | null
  onDirectSave: (optionValue: string) => void
}) {
  return (
    <div className="group rounded-md px-3 py-2.5 hover:bg-secondary/40 transition-colors">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">
        {field.label}
      </p>
      <div className="flex gap-1">
        {(field.options ?? []).map((opt) => {
          const isActive = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={saving}
              onClick={() => onDirectSave(opt.value)}
              className={[
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground',
              ].join(' ')}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {!value && (
        <p className="mt-1 text-xs text-muted-foreground/40 italic">Seçmek için tıklayın</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function ProjectInfoEditForm({ projectId, initialData }: Props) {
  const [data, setData] = useState<Record<string, string | null>>(initialData)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync updates from other components (e.g. KeywordsTagInput events)
  useEffect(() => {
    const handler = (e: CustomEvent<{ field: string; value: string }>) => {
      const { field, value } = e.detail
      setData((prev) => ({ ...prev, [field]: value || null }))
    }
    window.addEventListener('projectFieldUpdated', handler as EventListener)
    return () => window.removeEventListener('projectFieldUpdated', handler as EventListener)
  }, [])

  const startEdit = (key: string) => {
    setEditingField(key)
    setEditValue(data[key] ?? '')
    setError(null)
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
    setError(null)
  }

  const save = async (field: string, value: string) => {
    setSaving(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await updateProjectField(projectId, field as any, value)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Kayıt başarısız oldu.')
      return
    }
    setData((prev) => ({ ...prev, [field]: value || null }))
    setEditingField(null)
    setEditValue('')
    window.dispatchEvent(new CustomEvent('decisionsUpdated'))
  }

  const handleDirectSave = (field: string, optionValue: string) => {
    save(field, optionValue)
  }

  return (
    <div className="space-y-1">
      {ROWS.map((row, ri) => {
        // Section header
        if (!Array.isArray(row)) {
          return (
            <div key={`section-${ri}`} className="pt-5 pb-1 px-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/35 border-b border-border/30 pb-1.5">
                {row.label}
              </p>
            </div>
          )
        }

        const isTwoCol = row.length === 2

        return (
          <div
            key={ri}
            className={isTwoCol ? 'grid grid-cols-2 gap-x-2' : 'grid grid-cols-1'}
          >
            {row.map((field) => {
              // Custom fields — always visible, self-managed state
              if (field.type === 'custom:keywords') {
                return (
                  <div key={field.key} className="rounded-md px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
                      {field.label}
                    </p>
                    <KeywordsTagInput
                      projectId={projectId}
                      initialValue={data[field.key] ?? null}
                    />
                  </div>
                )
              }

              if (field.type === 'custom:competitors') {
                return (
                  <div key={field.key} className="rounded-md px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
                      {field.label}
                    </p>
                    <CompetitorsTagInput
                      projectId={projectId}
                      initialValue={data[field.key] ?? null}
                    />
                  </div>
                )
              }

              // Select — direct click saves, no edit mode
              if (field.type === 'select') {
                return (
                  <SelectField
                    key={field.key}
                    field={field}
                    value={data[field.key] ?? null}
                    saving={saving && editingField === field.key}
                    error={editingField === field.key ? error : null}
                    onDirectSave={(optionValue) => handleDirectSave(field.key, optionValue)}
                  />
                )
              }

              // Input / Textarea
              return (
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
                  onSave={() => save(field.key, editValue)}
                  onCancel={cancelEdit}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
