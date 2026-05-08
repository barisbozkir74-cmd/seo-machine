import { Badge } from '@/components/ui/badge'

// D-11 + UI-SPEC renk atamaları — className ile direkt, variant prop kullanılmaz
const revenueConfig: Record<string, { className: string; label: string }> = {
  bilgi:  { className: 'bg-emerald-500/20 text-emerald-400', label: 'Bilgi' },
  mixed:  { className: 'bg-yellow-500/20 text-yellow-400',  label: 'Mixed' },
  ticari: { className: 'bg-red-500/20 text-red-400',        label: 'Ticari' },
}

export function RevenueBadge({ revenueType }: { revenueType: string | null }) {
  if (!revenueType) return <span className="text-sm text-muted-foreground">—</span>

  const key = revenueType.toLowerCase().trim()
  const config = revenueConfig[key]

  if (!config) return <span className="text-sm text-muted-foreground">{revenueType}</span>

  // variant prop kullanılmaz — STATE.md karar notu
  return (
    <Badge className={`${config.className} text-xs border-0`}>
      {config.label}
    </Badge>
  )
}
