'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertMenu, type MenuType, type MenuItem } from './actions'

type Props = {
  projectId: string
  menuType: MenuType
  menuTitle: string
  initialItems: MenuItem[]
}

const EMPTY_ITEM: { label: string; href: string } = { label: '', href: '' }

export function MenuEditor({
  projectId,
  menuType,
  menuTitle,
  initialItems,
}: Props) {
  const [items, setItems] = useState<MenuItem[]>(initialItems)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

  function handleNewItemChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setNewItem((prev) => ({ ...prev, [name]: value }))
  }

  function handleAddItem() {
    if (!newItem.label.trim() || !newItem.href.trim()) return
    setItems((prev) => [...prev, { label: newItem.label.trim(), href: newItem.href.trim() }])
    setNewItem(EMPTY_ITEM)
  }

  function handleDeleteItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    setSaveStatus('idle')
    startTransition(async () => {
      const result = await upsertMenu(projectId, menuType, items)
      setSaveStatus(result.success ? 'saved' : 'error')
    })
  }

  function handleNewItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddItem()
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{menuTitle}</h3>

      {/* Mevcut item'lar */}
      <div className="rounded-md border border-border divide-y divide-border">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">
            Henüz item yok.
          </p>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-2 text-sm"
            >
              <span className="font-medium min-w-[120px] truncate">
                {item.label}
              </span>
              <span className="text-muted-foreground truncate flex-1">
                {item.href}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteItem(index)}
                className="h-7 px-2 text-muted-foreground hover:text-destructive shrink-0"
              >
                Sil
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Yeni item ekle — inline form */}
      <div className="flex items-center gap-2">
        <Input
          name="label"
          value={newItem.label}
          onChange={handleNewItemChange}
          onKeyDown={handleNewItemKeyDown}
          placeholder="Başlık"
          className="h-8 text-sm max-w-[180px]"
        />
        <Input
          name="href"
          value={newItem.href}
          onChange={handleNewItemChange}
          onKeyDown={handleNewItemKeyDown}
          placeholder="/link"
          className="h-8 text-sm max-w-[200px]"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={!newItem.label.trim() || !newItem.href.trim()}
          className="h-8"
        >
          Ekle
        </Button>
      </div>

      {/* Kaydet */}
      <div className="flex items-center gap-3">
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
