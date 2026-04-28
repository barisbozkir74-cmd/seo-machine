'use client'

import { cn } from '@/lib/utils'

const CHIPS = [
  { key: 'flag_orphan',           label: 'Orphan' },
  { key: 'flag_weak_page',        label: 'Zayıf' },
  { key: 'flag_outdated',         label: 'Eski İçerik' },
  { key: 'flag_missing_metadata', label: 'Meta Eksik' },
  { key: 'flag_missing_keyword',  label: 'Anahtar Kelime Yok' },
  { key: 'flag_duplicate_intent', label: 'Tekrarlı Intent' },
] as const

type FlagKey = typeof CHIPS[number]['key']

interface AuditFlagChipsProps {
  activeFlags: Set<FlagKey>
  onToggle: (flag: FlagKey) => void
  onClearAll: () => void
}

export function AuditFlagChips({ activeFlags, onToggle, onClearAll }: AuditFlagChipsProps) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <div className="inline-flex items-center gap-1 bg-card border border-border rounded-lg p-1 flex-wrap">
        {CHIPS.map(chip => {
          const isActive = activeFlags.has(chip.key)
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggle(chip.key)}
              className={cn(
                'px-4 py-2 rounded-md text-sm transition-colors min-h-[44px]',
                isActive
                  ? 'bg-blue-500/20 text-blue-400 font-medium border border-blue-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
      {activeFlags.size > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Filtreleri temizle
        </button>
      )}
    </div>
  )
}
