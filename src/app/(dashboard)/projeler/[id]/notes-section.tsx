'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { addNote } from './actions'

interface Note {
  id: string
  created_at: string
  payload: { content: string }
}

interface NotesSectionProps {
  stageId: string
  projectId: string
  initialNotes: Note[]
}

export function NotesSection({ stageId, projectId, initialNotes }: NotesSectionProps) {
  const [content, setContent] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setIsPending(true)
    setError(null)
    try {
      const result = await addNote(stageId, projectId, content)
      if (result.success) {
        setContent('')
        // revalidatePath server'da çalıştı — Server Component yeniden render edilir
        // ve güncel initialNotes prop'u gelir
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
      <h2 className="text-base font-semibold">Notlar</h2>

      {/* Not ekleme formu */}
      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Bu aşama için notunuzu buraya yazın..."
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
            <div key={note.id} className="space-y-1 border-l-2 border-border pl-3">
              <p className="text-xs text-muted-foreground">
                {new Date(note.created_at).toLocaleString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-sm">{note.payload.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
