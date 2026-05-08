'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateProjectField } from '../actions'

const MAX_KEYWORDS = 5

type Props = {
  projectId: string
  initialValue: string | null
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value.split('\n').map((s) => s.trim()).filter(Boolean)
}

function serializeList(list: string[]): string {
  return list.join('\n')
}

export function KeywordsTagInput({ projectId, initialValue }: Props) {
  const [items, setItems] = useState<string[]>(() => parseList(initialValue))
  const [input, setInput] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const persist = async (newItems: string[]) => {
    setSaving(true)
    await updateProjectField(projectId, 'target_keywords', serializeList(newItems))
    setSaving(false)
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = input.trim()
      if (!val || items.includes(val) || items.length >= MAX_KEYWORDS) {
        setInput('')
        return
      }
      const next = [...items, val]
      setItems(next)
      setInput('')
      persist(next)
    }
  }

  const handleDelete = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    setItems(next)
    persist(next)
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(items[index])
  }

  const saveEdit = () => {
    if (editingIndex === null) return
    const val = editValue.trim()
    if (!val) { cancelEdit(); return }
    const next = items.map((item, i) => (i === editingIndex ? val : item))
    setItems(next)
    setEditingIndex(null)
    setEditValue('')
    persist(next)
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditValue('')
  }

  const isFull = items.length >= MAX_KEYWORDS

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-muted-foreground">Anahtar Kelimeler</p>
        <span className="text-xs text-muted-foreground/60">{items.length}/{MAX_KEYWORDS}</span>
      </div>

      {!isFull && (
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Anahtar kelime yazıp Enter'a basın"
          className="text-sm h-8"
          disabled={saving}
        />
      )}

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) =>
            editingIndex === index ? (
              <div key={index} className="flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  className="h-7 text-sm w-36"
                  autoFocus
                  disabled={saving}
                />
                <Button size="sm" className="h-7 text-xs px-2" onClick={saveEdit} disabled={saving}>Kaydet</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={cancelEdit}>İptal</Button>
              </div>
            ) : (
              <span
                key={index}
                className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-sm"
              >
                {item}
                <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-1">
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    className="text-muted-foreground hover:text-foreground text-xs leading-none"
                    title="Düzenle"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="text-destructive hover:text-destructive/80 text-xs leading-none"
                    title="Sil"
                    disabled={saving}
                  >
                    ×
                  </button>
                </span>
              </span>
            )
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic">
          En önemli anahtar kelimelerinizi yazın — yoksa bir sonraki adımda birlikte oluşturacağız.
        </p>
      )}
    </div>
  )
}
