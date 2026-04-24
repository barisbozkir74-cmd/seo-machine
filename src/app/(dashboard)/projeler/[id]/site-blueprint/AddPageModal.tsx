'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { addPage, type Priority } from './actions'

type PageOption = {
  id: string
  title: string
}

type Props = {
  projectId: string
  existingPages: PageOption[]
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'yüksek', label: 'Yüksek' },
  { value: 'orta', label: 'Orta' },
  { value: 'düşük', label: 'Düşük' },
]

const EMPTY_FORM = {
  title: '',
  slug: '',
  page_type: '',
  parent_id: '',
  priority: 'orta' as Priority,
}

export function AddPageModal({ projectId, existingPages }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError('Sayfa adı zorunludur.')
      return
    }
    if (!form.slug.trim()) {
      setError('Slug zorunludur.')
      return
    }
    if (!form.page_type.trim()) {
      setError('Sayfa tipi zorunludur.')
      return
    }

    startTransition(async () => {
      const result = await addPage(projectId, {
        title: form.title.trim(),
        slug: form.slug.trim(),
        page_type: form.page_type.trim(),
        parent_id: form.parent_id || null,
        priority: form.priority,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setForm(EMPTY_FORM)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        + Sayfa Ekle
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Sayfa Ekle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Sayfa Adı */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Sayfa Adı</Label>
            <Input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Örn: Anasayfa"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              value={form.slug}
              onChange={handleChange}
              placeholder="Örn: /anasayfa"
            />
          </div>

          {/* Sayfa Tipi */}
          <div className="space-y-1.5">
            <Label htmlFor="page_type">Sayfa Tipi</Label>
            <Input
              id="page_type"
              name="page_type"
              value={form.page_type}
              onChange={handleChange}
              placeholder="Örn: landing, blog, kategori"
            />
          </div>

          {/* Üst Sayfa */}
          <div className="space-y-1.5">
            <Label htmlFor="parent_id">Üst Sayfa (opsiyonel)</Label>
            <select
              id="parent_id"
              name="parent_id"
              value={form.parent_id}
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">— Yok (Ana Sayfa) —</option>
              {existingPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </div>

          {/* Öncelik */}
          <div className="space-y-1.5">
            <Label htmlFor="priority">Öncelik</Label>
            <select
              id="priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hata */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Butonlar */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
                setForm(EMPTY_FORM)
                setError(null)
              }}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Ekleniyor…' : 'Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
