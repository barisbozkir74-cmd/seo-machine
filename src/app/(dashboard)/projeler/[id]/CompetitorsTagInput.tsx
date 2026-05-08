'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateProjectField } from '../actions'

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

export function CompetitorsTagInput({ projectId, initialValue }: Props) {
  const [items, setItems] = useState<string[]>(() => parseList(initialValue))
  const [input, setInput] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const persist = async (newItems: string[]) => {
    setSaving(true)
    await updateProjectField(projectId, 'initial_competitors', serializeList(newItems))
    setSaving(false)
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = input.trim().replace(/^https?:\/\//, '').replace(/^www\./, '')
      if (!val || items.includes(val)) {
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
    const val = editValue.trim().replace(/^https?:\/\//, '').replace(/^www\./, '')
    if (!val) {
      cancelEdit()
      return
    }
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

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Rakipler</p>
      <Input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="domain.com yazıp Enter'a basın"
        className="text-sm h-8"
        disabled={saving}
      />

      {items.length > 0 && (
        <ul className="space-y-1 mt-1">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50 group"
            >
              {editingIndex === index ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="h-6 text-sm flex-1"
                    autoFocus
                    disabled={saving}
                  />
                  <Button size="sm" className="h-6 text-xs px-2" onClick={saveEdit} disabled={saving}>
                    Kaydet
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={cancelEdit} disabled={saving}>
                    İptal
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm flex-1 font-mono">{item}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(index)}
                    >
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(index)}
                      disabled={saving}
                    >
                      Sil
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground/50 italic px-1">Henüz rakip eklenmemiş</p>
      )}
    </div>
  )
}
