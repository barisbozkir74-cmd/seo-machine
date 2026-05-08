'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { addNote, deleteNote, updateNote } from './actions'

interface Note {
  id: string
  created_at: string
  payload: { content: string }
}

interface NotesSectionProps {
  stageId: string
  projectId: string
  initialNotes: Note[]
  stageName?: string
}

function NoteItem({
  note,
  projectId,
}: {
  note: Note
  projectId: string
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.payload.content)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!editContent.trim() || editContent.trim() === note.payload.content) {
      setEditing(false)
      setEditContent(note.payload.content)
      return
    }
    setIsPending(true)
    setError(null)
    const result = await updateNote(note.id, projectId, editContent)
    setIsPending(false)
    if (result.success) {
      setEditing(false)
    } else {
      setError(result.error)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setEditContent(note.payload.content)
    setError(null)
  }

  const handleDelete = async () => {
    await deleteNote(note.id, projectId)
  }

  return (
    <div className="space-y-1 border-l-2 border-border pl-3 group">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {new Date(note.created_at).toLocaleString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        {!editing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              Düzenle
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  />
                }
              >
                Sil
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Notu sil</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bu notu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            disabled={isPending}
            autoFocus
            className="text-sm"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending || !editContent.trim()}>
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
              İptal
            </Button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm cursor-text hover:bg-secondary/50 rounded px-1 -mx-1 py-0.5 transition-colors"
          onClick={() => setEditing(true)}
          title="Düzenlemek için tıklayın"
        >
          {note.payload.content}
        </p>
      )}
    </div>
  )
}

export function NotesSection({ stageId, projectId, initialNotes, stageName }: NotesSectionProps) {
  const [content, setContent] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isProjectCore = stageName === 'Proje Bilgileri'
  const sectionTitle = isProjectCore ? 'Proje Vizyonu & İsteklerim' : 'Notlar'
  const placeholder = isProjectCore
    ? 'Bu projede ne istiyorum? Nasıl bir site olmalı, hangi hedef kitleye hitap etmeli, ton ve yaklaşım nasıl olmalı? Aklımdaki her şeyi buraya yazıyorum...'
    : 'Bu aşama için notunuzu buraya yazın...'

  const handleSubmit = async () => {
    setIsPending(true)
    setError(null)
    try {
      const result = await addNote(stageId, projectId, content)
      if (result.success) {
        setContent('')
      } else {
        setError(result.error)
      }
    } catch {
      setError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{sectionTitle}</h2>
      {isProjectCore && (
        <p className="text-sm text-muted-foreground -mt-2">
          Bu proje için kişisel beklentilerinizi, vizyonunuzu ve isteklerinizi buraya not edin.
        </p>
      )}

      {/* Not ekleme formu */}
      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={3}
          disabled={isPending}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || !content.trim()}
        >
          {isPending ? 'Kaydediliyor...' : 'Notu Ekle'}
        </Button>
      </div>

      {/* Geçmiş notlar */}
      <div className="space-y-3 mt-6">
        {initialNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bu aşama için henüz not eklenmemiş.
          </p>
        ) : (
          initialNotes.map((note) => (
            <NoteItem key={note.id} note={note} projectId={projectId} />
          ))
        )}
      </div>
    </div>
  )
}
