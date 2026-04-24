import { Badge } from '@/components/ui/badge'

// D-11 + UI-SPEC renk atamaları — className ile direkt, variant prop kullanılmaz
const intentConfig: Record<string, { className: string; label: string }> = {
  commercial:    { className: 'bg-blue-500/20 text-blue-400',      label: 'Commercial' },
  informational: { className: 'bg-emerald-500/20 text-emerald-400', label: 'Informational' },
  navigational:  { className: 'bg-gray-500/20 text-gray-400',      label: 'Navigational' },
  transactional: { className: 'bg-orange-500/20 text-orange-400',  label: 'Transactional' },
}

export function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-sm text-muted-foreground">—</span>

  // DataForSEO farklı case döndürebilir — normalize et
  const key = intent.toLowerCase().trim()
  const config = intentConfig[key]

  if (!config) return <span className="text-sm text-muted-foreground">{intent}</span>

  // variant prop kullanılmaz — STATE.md karar notu
  return (
    <Badge className={`${config.className} text-xs border-0`}>
      {config.label}
    </Badge>
  )
}
