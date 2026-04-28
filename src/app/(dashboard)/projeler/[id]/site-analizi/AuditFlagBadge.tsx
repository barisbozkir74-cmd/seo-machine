import { Badge } from '@/components/ui/badge'

// UI-SPEC §Color — hardcoded className, variant prop kullanılmaz
const FLAG_BADGE_CONFIG: Record<string, { className: string; label: string }> = {
  flag_orphan:           { className: 'bg-yellow-500/20 text-yellow-400', label: 'Orphan' },
  flag_weak_page:        { className: 'bg-red-500/20 text-red-400', label: 'Zayıf' },
  flag_outdated:         { className: 'bg-orange-500/20 text-orange-400', label: 'Eski İçerik' },
  flag_missing_metadata: { className: 'bg-slate-700 text-slate-400', label: 'Meta Eksik' },
  flag_missing_keyword:  { className: 'bg-slate-700 text-slate-400', label: 'Anahtar Kelime Yok' },
  flag_duplicate_intent: { className: 'bg-slate-700 text-slate-400', label: 'Tekrarlı Intent' },
}

interface AuditFlagBadgeProps {
  flag: keyof typeof FLAG_BADGE_CONFIG
}

export function AuditFlagBadge({ flag }: AuditFlagBadgeProps) {
  const config = FLAG_BADGE_CONFIG[flag]
  if (!config) return null
  return (
    <Badge className={`px-2 py-0.5 text-xs font-normal ${config.className}`}>
      {config.label}
    </Badge>
  )
}
