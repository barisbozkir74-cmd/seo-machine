'use client'

interface ApprovalKeywordRowProps {
  keyword: { id: string; keyword: string; volume: number | null }
  onRemove: () => void
  isPending: boolean
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'K'
  return v.toString()
}

export function ApprovalKeywordRow({ keyword, onRemove, isPending }: ApprovalKeywordRowProps) {
  return (
    <div className="group flex items-center px-4 py-2 border-b border-border/50 hover:bg-secondary/20 gap-2">
      <span className="flex-1 text-sm truncate">{keyword.keyword}</span>
      <span className="text-sm text-muted-foreground w-16 text-right shrink-0 tabular-nums">
        {keyword.volume !== null ? formatVolume(keyword.volume) : '—'}
      </span>
      <button
        className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 shrink-0 disabled:cursor-not-allowed"
        onClick={onRemove}
        disabled={isPending}
        aria-label="Keyword'ü kümeden kaldır"
      >
        ✕ Kaldır
      </button>
    </div>
  )
}
