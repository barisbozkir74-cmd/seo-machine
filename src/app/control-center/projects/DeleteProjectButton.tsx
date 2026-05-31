'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProject } from './actions'

interface DeleteProjectButtonProps {
  projectId: string
}

export function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    setConfirming(true)
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
    setError(null)
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      const result = await deleteProject(projectId)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  if (isPending) {
    return (
      <span className="text-[11px] text-muted-foreground/50 select-none px-1">
        Siliniyor…
      </span>
    )
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {error && (
          <span className="text-[10px] text-destructive mr-1">{error}</span>
        )}
        <span className="text-[11px] text-muted-foreground/60 select-none">Sil?</span>
        <button
          onClick={handleConfirm}
          className="text-[11px] font-medium text-destructive/80 hover:text-destructive transition-colors px-1"
          type="button"
        >
          Evet
        </button>
        <span className="text-muted-foreground/30 text-[11px]">/</span>
        <button
          onClick={handleCancel}
          className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors px-1"
          type="button"
        >
          Hayır
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={handleDeleteClick}
      type="button"
      title="Projeyi sil"
      className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors rounded"
      aria-label="Projeyi sil"
    >
      {/* Trash icon — inline SVG, no external dependency */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  )
}
