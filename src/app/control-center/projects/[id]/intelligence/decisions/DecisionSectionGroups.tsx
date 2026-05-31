'use client'

import { useTransition } from 'react'
import type { LockedDecision } from '@/core/decision/locking-engine'
import { reactivateDecision } from './actions'

// ─────────────────────────────────────────────────────────────────────────────
// Section mapping
// decision_type values: 'seo_rule' | 'strategy' | 'architecture' | 'content' | 'brand'
// section column: free-text or null
// We map to display groups using both columns.
// ─────────────────────────────────────────────────────────────────────────────

type SectionKey = 'proje' | 'arastirma' | 'keyword' | 'mimari' | 'icerik' | 'diger'

const SECTION_CONFIG: Record<SectionKey, { label: string; icon: string }> = {
  proje:     { label: 'Proje Kararları',           icon: '🏢' },
  arastirma: { label: 'Araştırma Kararları',        icon: '🔬' },
  keyword:   { label: 'Keyword & Strateji Kararları', icon: '🔑' },
  mimari:    { label: 'Mimari Kararları',           icon: '📐' },
  icerik:    { label: 'İçerik Kararları',           icon: '📋' },
  diger:     { label: 'Diğer',                      icon: '🔗' },
}

const SECTION_ORDER: SectionKey[] = ['proje', 'arastirma', 'keyword', 'mimari', 'icerik', 'diger']

function classifyDecision(d: LockedDecision): SectionKey {
  const section  = (d.section ?? '').toLowerCase()
  const dtype    = (d.decision_type ?? '').toLowerCase()
  const scope    = (d.scope_type ?? '').toLowerCase()

  // Explicit section hints
  if (section.includes('araştırma') || section.includes('arastirma') || section.includes('research')) return 'arastirma'
  if (section.includes('keyword') || section.includes('strateji') || section.includes('strategy')) return 'keyword'
  if (section.includes('mimari') || section.includes('architecture') || section.includes('blueprint')) return 'mimari'
  if (section.includes('içerik') || section.includes('icerik') || section.includes('content')) return 'icerik'
  if (section.includes('proje') || section.includes('project') || scope === 'global') return 'proje'

  // decision_type mapping
  if (dtype === 'strategy')     return 'keyword'
  if (dtype === 'architecture') return 'mimari'
  if (dtype === 'content')      return 'icerik'
  if (dtype === 'seo_rule')     return 'proje'
  if (dtype === 'brand')        return 'proje'

  // scope fallback
  if (scope === 'project') return 'proje'

  return 'diger'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    })
  } catch {
    return ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single decision card
// ─────────────────────────────────────────────────────────────────────────────

function DecisionCard({
  decision,
  projectId,
  showReactivate,
}: {
  decision:       LockedDecision
  projectId:      string
  showReactivate: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleReactivate() {
    startTransition(async () => {
      await reactivateDecision(decision.id, projectId)
    })
  }

  const isActive = decision.is_active
  const isLocked = decision.lifecycle_status === 'locked'

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/30 bg-background/60 px-4 py-3 hover:border-border/60 transition-colors">
      {/* Status dot */}
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
          isActive && !isLocked
            ? 'bg-emerald-400/70'
            : isActive && isLocked
            ? 'bg-amber-400/70'
            : 'bg-muted-foreground/25'
        }`}
        aria-hidden="true"
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-foreground/90 leading-relaxed">{decision.decision}</p>

        {decision.reason && (
          <p className="text-xs text-muted-foreground/60 leading-relaxed">{decision.reason}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {/* Status badge */}
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              isActive && !isLocked
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : isActive && isLocked
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-border/40 bg-secondary/30 text-muted-foreground/50'
            }`}
          >
            {isActive && !isLocked ? 'Aktif' : isActive && isLocked ? 'Kilitli' : 'Geçmiş'}
          </span>

          {/* Type badge */}
          {decision.decision_type && (
            <span className="inline-flex items-center rounded-full border border-border/30 bg-secondary/20 px-2 py-0.5 text-[10px] text-muted-foreground/50">
              {decision.decision_type}
            </span>
          )}

          {/* Scope badge when non-project */}
          {decision.scope_type && decision.scope_type !== 'project' && (
            <span className="inline-flex items-center rounded-full border border-border/30 bg-secondary/20 px-2 py-0.5 text-[10px] text-muted-foreground/40">
              {decision.scope_type}
            </span>
          )}

          {/* Date */}
          <span className="text-[10px] text-muted-foreground/30 ml-auto shrink-0">
            {formatDate(decision.created_at)}
          </span>
        </div>
      </div>

      {/* Reactivate button */}
      {showReactivate && !isActive && (
        <button
          onClick={handleReactivate}
          disabled={pending}
          className="shrink-0 rounded-md border border-border/40 bg-secondary/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/60 hover:text-foreground disabled:cursor-wait disabled:opacity-50"
        >
          {pending ? '...' : 'Yeniden Aktif Et'}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section group
// ─────────────────────────────────────────────────────────────────────────────

function SectionGroup({
  sectionKey,
  decisions,
  projectId,
  showReactivate,
}: {
  sectionKey:     SectionKey
  decisions:      LockedDecision[]
  projectId:      string
  showReactivate: boolean
}) {
  const { label, icon } = SECTION_CONFIG[sectionKey]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <h2 className="text-xs font-semibold text-foreground/70">{label}</h2>
        <span className="text-[10px] text-muted-foreground/40">({decisions.length})</span>
      </div>
      <div className="space-y-1.5 pl-1">
        {decisions.map((d) => (
          <DecisionCard
            key={d.id}
            decision={d}
            projectId={projectId}
            showReactivate={showReactivate}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function DecisionSectionGroups({
  decisions,
  projectId,
  showReactivate,
}: {
  decisions:      LockedDecision[]
  projectId:      string
  showReactivate: boolean
}) {
  // Build groups
  const groups: Record<SectionKey, LockedDecision[]> = {
    proje:     [],
    arastirma: [],
    keyword:   [],
    mimari:    [],
    icerik:    [],
    diger:     [],
  }

  for (const d of decisions) {
    const key = classifyDecision(d)
    groups[key].push(d)
  }

  // Only render sections that have decisions, in fixed order
  const visibleSections = SECTION_ORDER.filter((k) => groups[k].length > 0)

  if (visibleSections.length === 0) return null

  return (
    <div className="space-y-8">
      {visibleSections.map((key) => (
        <SectionGroup
          key={key}
          sectionKey={key}
          decisions={groups[key]}
          projectId={projectId}
          showReactivate={showReactivate}
        />
      ))}
    </div>
  )
}
